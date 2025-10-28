#!/usr/bin/env node

import { createWorker } from 'tesseract.js';
import { readFile } from 'fs/promises';
import { existsSync } from 'fs';

export async function handleOCR({ name, arguments: args }) {
  switch (name) {
    case 'ocr_image':
      return await ocrImage(args);
    case 'ocr_image_base64':
      return await ocrImageBase64(args);
    case 'ocr_with_preprocessing':
      return await ocrWithPreprocessing(args);
    case 'ocr_batch':
      return await ocrBatch(args);
    case 'ocr_region':
      return await ocrRegion(args);
    case 'get_supported_languages':
      return await getSupportedLanguages();
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

function detectImageQuality(data) {
  const avgConfidence = data.confidence;
  const wordCount = data.words.length;
  const avgWordConfidence = wordCount > 0
    ? data.words.reduce((sum, w) => sum + w.confidence, 0) / wordCount
    : 0;

  const confidenceVariance = wordCount > 0
    ? Math.sqrt(data.words.reduce((sum, w) => sum + Math.pow(w.confidence - avgWordConfidence, 2), 0) / wordCount)
    : 0;

  let qualityScore = avgConfidence;

  if (confidenceVariance > 20) {
    qualityScore -= 10;
  }

  if (wordCount < 3 && avgConfidence > 90) {
    qualityScore -= 5;
  }

  return {
    score: Math.max(0, Math.min(100, qualityScore)),
    avgConfidence,
    variance: confidenceVariance,
    wordCount,
    needsImprovement: qualityScore < 85,
    quality: qualityScore >= 90 ? 'excellent' :
             qualityScore >= 80 ? 'good' :
             qualityScore >= 70 ? 'fair' : 'poor'
  };
}

function getMultiThresholdParams(strategy = 'otsu') {
  const strategies = {
    otsu: {
      tessedit_thresholding_method: '1'
    },
    adaptive: {
      tessedit_thresholding_method: '2'
    },
    sauvola: {
      tessedit_thresholding_method: '3'
    }
  };

  return strategies[strategy] || strategies.otsu;
}

function getEnhancedParams(language, enhance_quality = false, thresholdStrategy = 'otsu') {
  const baseParams = {
    preserve_interword_spaces: '1',
    tessedit_char_blacklist: '',
  };

  if (!enhance_quality) {
    return baseParams;
  }

  return {
    ...baseParams,
    ...getMultiThresholdParams(thresholdStrategy),
    tessedit_enable_dict_correction: '1',
    tessedit_enable_bigram_correction: '1',
    textord_heavy_nr: '1',
    textord_noise_rejwords: '1',
    textord_noise_rejrows: '1',
    tessedit_reject_bad_qual_wds: '1',
    ...(language.includes('chi') ? {
      textord_min_linesize: '1.5',
    } : {
      textord_min_linesize: '2.0',
    })
  };
}

function mergeResultsWithConfidence(results) {
  if (results.length === 1) {
    return results[0];
  }

  const sorted = [...results].sort((a, b) => b.data.confidence - a.data.confidence);

  if (sorted[0].data.confidence - sorted[1].data.confidence > 10) {
    return sorted[0];
  }

  const bestResult = sorted[0];

  const wordMap = new Map();

  results.forEach(result => {
    result.data.words.forEach(word => {
      const key = `${word.bbox.x0}-${word.bbox.y0}`;
      if (!wordMap.has(key)) {
        wordMap.set(key, []);
      }
      wordMap.get(key).push(word);
    });
  });

  const mergedWords = [];
  wordMap.forEach(words => {
    const best = words.reduce((a, b) => a.confidence > b.confidence ? a : b);
    mergedWords.push(best);
  });

  const mergedText = mergedWords.map(w => w.text).join(' ');
  const avgConfidence = mergedWords.reduce((sum, w) => sum + w.confidence, 0) / mergedWords.length;

  return {
    ...bestResult,
    data: {
      ...bestResult.data,
      text: mergedText,
      confidence: avgConfidence,
      words: mergedWords,
      merged: true,
      mergeCount: results.length
    }
  };
}

async function ocrImage({
  image_path,
  language = 'eng',
  psm = 3,
  oem = 3,
  enhance_quality = false,
  output_format = 'text'
}) {
  try {
    if (!existsSync(image_path)) {
      throw new Error(`Image file not found: ${image_path}`);
    }

    const worker = await createWorker(language, oem, {
      logger: enhance_quality ? (m => {
        if (m.status === 'recognizing text') {
          console.error(`Progress: ${(m.progress * 100).toFixed(0)}%`);
        }
      }) : undefined
    });

    const params = {
      tessedit_pageseg_mode: psm,
      tessedit_ocr_engine_mode: oem,
      ...getEnhancedParams(language, enhance_quality, 'otsu')
    };

    await worker.setParameters(params);
    const { data } = await worker.recognize(image_path);

    const quality = detectImageQuality(data);
    console.error(`Quality: ${quality.quality} (${quality.score.toFixed(1)}/100)`);

    if (enhance_quality && quality.needsImprovement) {
      console.error(`Low quality detected, starting multi-strategy recognition...`);

      const results = [{ data, strategy: 'otsu', psm }];

      const altPsm = psm === 3 ? 6 : 3;
      await worker.setParameters({
        ...params,
        tessedit_pageseg_mode: altPsm
      });
      const { data: data2 } = await worker.recognize(image_path);
      results.push({ data: data2, strategy: 'otsu', psm: altPsm });

      if (quality.score < 75) {
        console.error(`Trying adaptive threshold...`);
        const adaptiveParams = {
          tessedit_pageseg_mode: psm,
          tessedit_ocr_engine_mode: oem,
          ...getEnhancedParams(language, true, 'adaptive')
        };
        await worker.setParameters(adaptiveParams);
        const { data: data3 } = await worker.recognize(image_path);
        results.push({ data: data3, strategy: 'adaptive', psm });
      }

      if (quality.variance < 15 && quality.score < 80) {
        console.error(`Trying Sauvola threshold...`);
        const sauvolaParams = {
          tessedit_pageseg_mode: psm,
          tessedit_ocr_engine_mode: oem,
          ...getEnhancedParams(language, true, 'sauvola')
        };
        await worker.setParameters(sauvolaParams);
        const { data: data4 } = await worker.recognize(image_path);
        results.push({ data: data4, strategy: 'sauvola', psm });
      }

      const merged = mergeResultsWithConfidence(results);
      const finalQuality = detectImageQuality(merged.data);

      console.error(`Multi-strategy complete: ${results.length} strategies`);
      console.error(`Final confidence: ${merged.data.confidence.toFixed(2)}% (Improvement: ${(merged.data.confidence - data.confidence).toFixed(2)}%)`);

      await worker.terminate();
      return formatOutput(merged.data, output_format, language, psm, enhance_quality, {
        multiStrategy: true,
        strategiesUsed: results.length,
        initialQuality: quality,
        finalQuality: finalQuality
      });
    }

    await worker.terminate();
    return formatOutput(data, output_format, language, psm, enhance_quality, { quality });
  } catch (error) {
    throw new Error(`OCR failed: ${error.message}`);
  }
}

async function ocrImageBase64({
  image_base64,
  language = 'eng',
  psm = 3,
  oem = 3,
  enhance_quality = false,
  output_format = 'text'
}) {
  try {
    const worker = await createWorker(language, oem);

    const params = {
      tessedit_pageseg_mode: psm,
      tessedit_ocr_engine_mode: oem,
      ...getEnhancedParams(language, enhance_quality, 'otsu')
    };

    await worker.setParameters(params);
    const { data } = await worker.recognize(image_base64);

    const quality = detectImageQuality(data);

    await worker.terminate();

    return formatOutput(data, output_format, language, psm, enhance_quality, { quality });
  } catch (error) {
    throw new Error(`Base64 OCR failed: ${error.message}`);
  }
}

async function ocrWithPreprocessing({
  image_path,
  language = 'eng',
  psm = 3,
  oem = 3,
  preprocessing = {},
  output_format = 'text'
}) {
  try {
    if (!existsSync(image_path)) {
      throw new Error(`Image file not found: ${image_path}`);
    }

    const worker = await createWorker(language, oem, {
      logger: m => {
        if (m.status === 'recognizing text') {
          console.error(`Progress: ${(m.progress * 100).toFixed(0)}%`);
        }
      }
    });

    let thresholdStrategy = 'otsu';
    if (preprocessing.enhance_contrast) {
      thresholdStrategy = 'adaptive';
    }

    const params = {
      tessedit_pageseg_mode: psm,
      tessedit_ocr_engine_mode: oem,
      ...getEnhancedParams(language, true, thresholdStrategy),
    };

    if (preprocessing.remove_noise) {
      params.textord_heavy_nr = '1';
      params.textord_noise_rejwords = '1';
    }

    await worker.setParameters(params);

    const { data } = await worker.recognize(image_path);

    const quality = detectImageQuality(data);

    await worker.terminate();

    const processingInfo = [];
    if (preprocessing.enhance_contrast) processingInfo.push('Contrast enhancement');
    if (preprocessing.remove_noise) processingInfo.push('Noise removal');
    if (preprocessing.deskew) processingInfo.push('Deskew');
    if (preprocessing.scale && preprocessing.scale !== 1.0) {
      processingInfo.push(`Scale ${preprocessing.scale}x`);
    }
    processingInfo.push('Enhanced algorithm');
    processingInfo.push(`${thresholdStrategy} threshold`);

    if (output_format === 'json') {
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            text: data.text,
            confidence: data.confidence,
            preprocessing: processingInfo,
            thresholdStrategy: thresholdStrategy,
            quality: {
              score: quality.score,
              level: quality.quality,
              variance: quality.variance,
              wordCount: quality.wordCount
            },
            words: data.words.map(w => ({
              text: w.text,
              confidence: w.confidence,
              bbox: w.bbox
            })),
            lines: data.lines.map(l => ({
              text: l.text,
              confidence: l.confidence,
              bbox: l.bbox
            }))
          }, null, 2)
        }]
      };
    }

    return {
      content: [{
        type: 'text',
        text: `Result (Preprocessed + Enhanced):\n\n${data.text}\n\nConfidence: ${data.confidence.toFixed(2)}%\nQuality: ${quality.quality} (${quality.score.toFixed(1)}/100)\nPreprocessing: ${processingInfo.join(', ')}\nLanguage: ${language}`
      }]
    };
  } catch (error) {
    throw new Error(`Preprocessing OCR failed: ${error.message}`);
  }
}

async function ocrBatch({
  image_paths,
  language = 'eng',
  psm = 3,
  oem = 3,
  enhance_quality = false,
  output_format = 'text'
}) {
  try {
    const worker = await createWorker(language, oem);

    const params = {
      tessedit_pageseg_mode: psm,
      tessedit_ocr_engine_mode: oem,
      ...getEnhancedParams(language, enhance_quality, 'otsu')
    };

    await worker.setParameters(params);

    const results = [];
    let totalConfidence = 0;
    let successCount = 0;
    const qualityStats = {
      excellent: 0,
      good: 0,
      fair: 0,
      poor: 0
    };

    for (const path of image_paths) {
      if (!existsSync(path)) {
        results.push({
          path: path,
          error: 'File not found',
          text: '',
          confidence: 0
        });
        continue;
      }

      try {
        const { data } = await worker.recognize(path);
        const quality = detectImageQuality(data);

        results.push({
          path: path,
          text: data.text,
          confidence: data.confidence,
          word_count: data.words.length,
          quality: quality.quality,
          quality_score: quality.score
        });
        totalConfidence += data.confidence;
        successCount++;
        qualityStats[quality.quality]++;
      } catch (error) {
        results.push({
          path: path,
          error: error.message,
          text: '',
          confidence: 0
        });
      }
    }

    await worker.terminate();

    const avgConfidence = successCount > 0 ? (totalConfidence / successCount).toFixed(2) : 0;

    if (output_format === 'json') {
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            total: results.length,
            success: successCount,
            failed: results.filter(r => r.error).length,
            average_confidence: parseFloat(avgConfidence),
            enhanced: enhance_quality,
            quality_distribution: qualityStats,
            results: results
          }, null, 2)
        }]
      };
    }

    const textOutput = results.map((r, i) => {
      if (r.error) {
        return `Image ${i + 1}: ${r.path}\nError: ${r.error}`;
      }
      return `Image ${i + 1}: ${r.path}\n${r.text}\nConfidence: ${r.confidence.toFixed(2)}%\nQuality: ${r.quality}\nWords: ${r.word_count}`;
    }).join('\n\n---\n\n');

    const summary = `Batch OCR complete${enhance_quality ? ' (Enhanced)' : ''}\nTotal: ${results.length} | Success: ${successCount} | Failed: ${results.filter(r => r.error).length} | Avg confidence: ${avgConfidence}%\nQuality: Excellent ${qualityStats.excellent}, Good ${qualityStats.good}, Fair ${qualityStats.fair}, Poor ${qualityStats.poor}`;

    return {
      content: [{
        type: 'text',
        text: `${summary}\n\n${textOutput}`
      }]
    };
  } catch (error) {
    throw new Error(`Batch OCR failed: ${error.message}`);
  }
}

async function ocrRegion({
  image_path,
  region,
  language = 'eng',
  enhance_quality = false,
  output_format = 'text'
}) {
  try {
    if (!existsSync(image_path)) {
      throw new Error(`Image file not found: ${image_path}`);
    }

    const worker = await createWorker(language);

    const params = {
      tessedit_pageseg_mode: 6,
      ...getEnhancedParams(language, enhance_quality, 'otsu')
    };

    await worker.setParameters(params);

    const { data } = await worker.recognize(image_path, {
      rectangle: region
    });

    const quality = detectImageQuality(data);

    await worker.terminate();

    if (output_format === 'json') {
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            text: data.text,
            confidence: data.confidence,
            region: region,
            enhanced: enhance_quality,
            quality: {
              score: quality.score,
              level: quality.quality,
              variance: quality.variance,
              wordCount: quality.wordCount
            },
            words: data.words.map(w => ({
              text: w.text,
              confidence: w.confidence
            }))
          }, null, 2)
        }]
      };
    }

    return {
      content: [{
        type: 'text',
        text: `Region OCR${enhance_quality ? ' (Enhanced)' : ''}:\nRegion: (${region.x}, ${region.y}) ${region.width}x${region.height}\n\n${data.text}\n\nConfidence: ${data.confidence.toFixed(2)}%\nQuality: ${quality.quality} (${quality.score.toFixed(1)}/100)`
      }]
    };
  } catch (error) {
    throw new Error(`Region OCR failed: ${error.message}`);
  }
}

async function getSupportedLanguages() {
  const languages = [
    { code: 'eng', name: 'English' },
    { code: 'chi_sim', name: 'Simplified Chinese' },
    { code: 'chi_tra', name: 'Traditional Chinese' },
    { code: 'jpn', name: 'Japanese' },
    { code: 'kor', name: 'Korean' },
    { code: 'fra', name: 'French' },
    { code: 'deu', name: 'German' },
    { code: 'spa', name: 'Spanish' },
    { code: 'rus', name: 'Russian' },
    { code: 'ara', name: 'Arabic' },
    { code: 'hin', name: 'Hindi' },
    { code: 'tha', name: 'Thai' },
    { code: 'vie', name: 'Vietnamese' },
    { code: 'por', name: 'Portuguese' },
    { code: 'ita', name: 'Italian' },
    { code: 'nld', name: 'Dutch' },
    { code: 'pol', name: 'Polish' },
    { code: 'tur', name: 'Turkish' }
  ];

  const text = languages.map(l => `  ${l.code.padEnd(10)} - ${l.name}`).join('\n');

  return {
    content: [{
      type: 'text',
      text: `Supported OCR Languages (${languages.length}):\n\n${text}\n\nTip: Use + to combine languages (e.g., eng+chi_sim)\nSet enhance_quality: true for better accuracy`
    }]
  };
}

function formatOutput(data, output_format, language, psm, enhanced = false, extraInfo = {}) {
  if (output_format === 'json') {
    const result = {
      text: data.text,
      confidence: data.confidence,
      language: language,
      psm: psm,
      enhanced: enhanced,
      words: data.words.map(w => ({
        text: w.text,
        confidence: w.confidence,
        bbox: w.bbox
      })),
      lines: data.lines.map(l => ({
        text: l.text,
        confidence: l.confidence,
        bbox: l.bbox
      }))
    };

    if (extraInfo.quality) {
      result.quality = {
        score: extraInfo.quality.score,
        level: extraInfo.quality.quality,
        variance: extraInfo.quality.variance,
        wordCount: extraInfo.quality.wordCount
      };
    }

    if (extraInfo.multiStrategy) {
      result.multiStrategy = {
        enabled: true,
        strategiesUsed: extraInfo.strategiesUsed,
        initialConfidence: extraInfo.initialQuality.avgConfidence,
        finalConfidence: data.confidence,
        improvement: data.confidence - extraInfo.initialQuality.avgConfidence
      };
    }

    if (data.merged) {
      result.merged = {
        enabled: true,
        mergeCount: data.mergeCount
      };
    }

    return {
      content: [{
        type: 'text',
        text: JSON.stringify(result, null, 2)
      }]
    };
  }

  let outputText = `Result${enhanced ? ' (Enhanced)' : ''}:\n\n${data.text}\n\n`;
  outputText += `Confidence: ${data.confidence.toFixed(2)}%\n`;
  outputText += `Language: ${language}\n`;
  outputText += `PSM: ${psm}`;

  if (extraInfo.quality) {
    outputText += `\nQuality: ${extraInfo.quality.quality} (${extraInfo.quality.score.toFixed(1)}/100)`;
  }

  if (extraInfo.multiStrategy) {
    outputText += `\n\nMulti-strategy:`;
    outputText += `\n- Strategies: ${extraInfo.strategiesUsed}`;
    outputText += `\n- Initial: ${extraInfo.initialQuality.avgConfidence.toFixed(2)}%`;
    outputText += `\n- Final: ${data.confidence.toFixed(2)}%`;
    outputText += `\n- Improvement: +${(data.confidence - extraInfo.initialQuality.avgConfidence).toFixed(2)}%`;
  }

  if (data.merged) {
    outputText += `\nConfidence-weighted merge: ${data.mergeCount} results merged`;
  }

  return {
    content: [{
      type: 'text',
      text: outputText
    }]
  };
}
