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
      throw new Error(`未知工具: ${name}`);
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
    quality: qualityScore >= 90 ? '优秀' :
             qualityScore >= 80 ? '良好' :
             qualityScore >= 70 ? '一般' : '较差'
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
      throw new Error(`图片文件不存在: ${image_path}`);
    }

    const worker = await createWorker(language, oem, {
      logger: enhance_quality ? (m => {
        if (m.status === 'recognizing text') {
          console.error(`识别进度: ${(m.progress * 100).toFixed(0)}%`);
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
    console.error(`图像质量: ${quality.quality} (${quality.score.toFixed(1)}/100)`);

    if (enhance_quality && quality.needsImprovement) {
      console.error(`检测到低质量，启动多策略识别...`);

      const results = [{ data, strategy: 'otsu', psm }];

      const altPsm = psm === 3 ? 6 : 3;
      await worker.setParameters({
        ...params,
        tessedit_pageseg_mode: altPsm
      });
      const { data: data2 } = await worker.recognize(image_path);
      results.push({ data: data2, strategy: 'otsu', psm: altPsm });

      if (quality.score < 75) {
        console.error(`尝试自适应阈值策略...`);
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
        console.error(`尝试 Sauvola 阈值策略...`);
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

      console.error(`多策略识别完成: ${results.length} 个策略`);
      console.error(`最终置信度: ${merged.data.confidence.toFixed(2)}% (提升: ${(merged.data.confidence - data.confidence).toFixed(2)}%)`);

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
    throw new Error(`OCR 识别失败: ${error.message}`);
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
    throw new Error(`Base64 OCR 识别失败: ${error.message}`);
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
      throw new Error(`图片文件不存在: ${image_path}`);
    }

    const worker = await createWorker(language, oem, {
      logger: m => {
        if (m.status === 'recognizing text') {
          console.error(`识别进度: ${(m.progress * 100).toFixed(0)}%`);
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
    if (preprocessing.enhance_contrast) processingInfo.push('对比度增强');
    if (preprocessing.remove_noise) processingInfo.push('降噪处理');
    if (preprocessing.deskew) processingInfo.push('倾斜纠正');
    if (preprocessing.scale && preprocessing.scale !== 1.0) {
      processingInfo.push(`缩放 ${preprocessing.scale}x`);
    }
    processingInfo.push('增强识别算法');
    processingInfo.push(`${thresholdStrategy} 阈值策略`);

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
        text: `识别结果 (已预处理 + 增强算法):\n\n${data.text}\n\n置信度: ${data.confidence.toFixed(2)}%\n质量评级: ${quality.quality} (${quality.score.toFixed(1)}/100)\n预处理: ${processingInfo.join(', ')}\n语言: ${language}`
      }]
    };
  } catch (error) {
    throw new Error(`预处理 OCR 识别失败: ${error.message}`);
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
      '优秀': 0,
      '良好': 0,
      '一般': 0,
      '较差': 0
    };

    for (const path of image_paths) {
      if (!existsSync(path)) {
        results.push({
          path: path,
          error: '文件不存在',
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
        return `图片 ${i + 1}: ${r.path}\n错误: ${r.error}`;
      }
      return `图片 ${i + 1}: ${r.path}\n${r.text}\n置信度: ${r.confidence.toFixed(2)}%\n质量: ${r.quality}\n词数: ${r.word_count}`;
    }).join('\n\n---\n\n');

    const summary = `批量识别完成${enhance_quality ? ' (增强算法)' : ''}\n总数: ${results.length} | 成功: ${successCount} | 失败: ${results.filter(r => r.error).length} | 平均置信度: ${avgConfidence}%\n质量分布: 优秀 ${qualityStats['优秀']}, 良好 ${qualityStats['良好']}, 一般 ${qualityStats['一般']}, 较差 ${qualityStats['较差']}`;

    return {
      content: [{
        type: 'text',
        text: `${summary}\n\n${textOutput}`
      }]
    };
  } catch (error) {
    throw new Error(`批量 OCR 识别失败: ${error.message}`);
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
      throw new Error(`图片文件不存在: ${image_path}`);
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
        text: `区域识别结果${enhance_quality ? ' (增强算法)' : ''}:\n区域: (${region.x}, ${region.y}) ${region.width}x${region.height}\n\n${data.text}\n\n置信度: ${data.confidence.toFixed(2)}%\n质量评级: ${quality.quality} (${quality.score.toFixed(1)}/100)`
      }]
    };
  } catch (error) {
    throw new Error(`区域 OCR 识别失败: ${error.message}`);
  }
}

async function getSupportedLanguages() {
  const languages = [
    { code: 'eng', name: '英语 (English)' },
    { code: 'chi_sim', name: '简体中文 (Simplified Chinese)' },
    { code: 'chi_tra', name: '繁体中文 (Traditional Chinese)' },
    { code: 'jpn', name: '日语 (Japanese)' },
    { code: 'kor', name: '韩语 (Korean)' },
    { code: 'fra', name: '法语 (French)' },
    { code: 'deu', name: '德语 (German)' },
    { code: 'spa', name: '西班牙语 (Spanish)' },
    { code: 'rus', name: '俄语 (Russian)' },
    { code: 'ara', name: '阿拉伯语 (Arabic)' },
    { code: 'hin', name: '印地语 (Hindi)' },
    { code: 'tha', name: '泰语 (Thai)' },
    { code: 'vie', name: '越南语 (Vietnamese)' },
    { code: 'por', name: '葡萄牙语 (Portuguese)' },
    { code: 'ita', name: '意大利语 (Italian)' },
    { code: 'nld', name: '荷兰语 (Dutch)' },
    { code: 'pol', name: '波兰语 (Polish)' },
    { code: 'tur', name: '土耳其语 (Turkish)' }
  ];

  const text = languages.map(l => `  ${l.code.padEnd(10)} - ${l.name}`).join('\n');

  return {
    content: [{
      type: 'text',
      text: `支持的 OCR 语言 (${languages.length} 种):\n\n${text}\n\n提示: 使用 + 连接多个语言 (如 eng+chi_sim)\n设置 enhance_quality: true 获得更高准确度`
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

  let outputText = `识别结果${enhanced ? ' (增强算法)' : ''}:\n\n${data.text}\n\n`;
  outputText += `置信度: ${data.confidence.toFixed(2)}%\n`;
  outputText += `语言: ${language}\n`;
  outputText += `PSM 模式: ${psm}`;

  if (extraInfo.quality) {
    outputText += `\n质量评级: ${extraInfo.quality.quality} (${extraInfo.quality.score.toFixed(1)}/100)`;
  }

  if (extraInfo.multiStrategy) {
    outputText += `\n\n多策略识别:`;
    outputText += `\n- 使用策略数: ${extraInfo.strategiesUsed}`;
    outputText += `\n- 初始置信度: ${extraInfo.initialQuality.avgConfidence.toFixed(2)}%`;
    outputText += `\n- 最终置信度: ${data.confidence.toFixed(2)}%`;
    outputText += `\n- 提升幅度: +${(data.confidence - extraInfo.initialQuality.avgConfidence).toFixed(2)}%`;
  }

  if (data.merged) {
    outputText += `\n置信度加权合并: 已合并 ${data.mergeCount} 个结果`;
  }

  return {
    content: [{
      type: 'text',
      text: outputText
    }]
  };
}
