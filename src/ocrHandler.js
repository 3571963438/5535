#!/usr/bin/env node

import { createWorker } from 'tesseract.js';
import { readFile } from 'fs/promises';
import { existsSync } from 'fs';

/**
 * 处理 OCR 请求的主函数
 */
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

/**
 * 图像质量检测与评估
 */
function detectImageQuality(data) {
  const avgConfidence = data.confidence;
  const wordCount = data.words.length;
  const avgWordConfidence = wordCount > 0
    ? data.words.reduce((sum, w) => sum + w.confidence, 0) / wordCount
    : 0;

  // 计算置信度标准差
  const confidenceVariance = wordCount > 0
    ? Math.sqrt(data.words.reduce((sum, w) => sum + Math.pow(w.confidence - avgWordConfidence, 2), 0) / wordCount)
    : 0;

  // 质量评分 (0-100)
  let qualityScore = avgConfidence;

  // 如果方差太大，说明识别不稳定，降低评分
  if (confidenceVariance > 20) {
    qualityScore -= 10;
  }

  // 如果词数太少但置信度高，可能是误识别
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

/**
 * 获取多阈值策略参数
 */
function getMultiThresholdParams(strategy = 'otsu') {
  const strategies = {
    // 策略1: Otsu自适应阈值 (适合一般图像)
    otsu: {
      tessedit_thresholding_method: '1'
    },
    // 策略2: 局部自适应阈值 (适合光照不均)
    adaptive: {
      tessedit_thresholding_method: '2'
    },
    // 策略3: Sauvola阈值 (适合低对比度)
    sauvola: {
      tessedit_thresholding_method: '3'
    }
  };

  return strategies[strategy] || strategies.otsu;
}

/**
 * 获取增强的识别参数
 */
function getEnhancedParams(language, enhance_quality = false, thresholdStrategy = 'otsu') {
  const baseParams = {
    preserve_interword_spaces: '1',
    tessedit_char_blacklist: '', // 不禁用字符
  };

  if (!enhance_quality) {
    return baseParams;
  }

  // 增强识别参数
  return {
    ...baseParams,
    // 使用多阈值自适应策略
    ...getMultiThresholdParams(thresholdStrategy),
    // 优化识别质量
    tessedit_enable_dict_correction: '1', // 启用字典纠错
    tessedit_enable_bigram_correction: '1', // 启用双字母组合纠错
    // 字符分割优化
    textord_heavy_nr: '1', // 降噪
    // 页面分析优化
    textord_noise_rejwords: '1', // 拒绝噪声词
    textord_noise_rejrows: '1', // 拒绝噪声行
    // 质量控制
    tessedit_reject_bad_qual_wds: '1', // 拒绝低质量词
    // 字符白名单根据语言优化
    ...(language.includes('chi') ? {
      // 中文优化
      textord_min_linesize: '1.5',
    } : {
      // 英文等其他语言优化
      textord_min_linesize: '2.0',
    })
  };
}

/**
 * 置信度加权合并多次识别结果
 */
function mergeResultsWithConfidence(results) {
  if (results.length === 1) {
    return results[0];
  }

  // 按置信度排序
  const sorted = [...results].sort((a, b) => b.data.confidence - a.data.confidence);

  // 如果最高置信度明显优于其他，直接返回
  if (sorted[0].data.confidence - sorted[1].data.confidence > 10) {
    return sorted[0];
  }

  // 否则进行加权合并
  const bestResult = sorted[0];

  // 收集所有识别到的词，按位置分组
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

  // 对每个位置的词选择置信度最高的
  const mergedWords = [];
  wordMap.forEach(words => {
    const best = words.reduce((a, b) => a.confidence > b.confidence ? a : b);
    mergedWords.push(best);
  });

  // 重新组合文本
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

/**
 * 基础图片识别
 */
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

    // 策略1: 使用初始参数识别
    const params = {
      tessedit_pageseg_mode: psm,
      tessedit_ocr_engine_mode: oem,
      ...getEnhancedParams(language, enhance_quality, 'otsu')
    };

    await worker.setParameters(params);
    const { data } = await worker.recognize(image_path);

    // 检测图像质量
    const quality = detectImageQuality(data);
    console.error(`图像质量评估: ${quality.quality} (${quality.score.toFixed(1)}/100)`);

    // 如果启用增强质量且质量检测显示需要改进
    if (enhance_quality && quality.needsImprovement) {
      console.error(`质量较低，启动多策略识别...`);

      const results = [{ data, strategy: 'otsu', psm }];

      // 策略2: 尝试不同的 PSM 模式
      const altPsm = psm === 3 ? 6 : 3;
      await worker.setParameters({
        ...params,
        tessedit_pageseg_mode: altPsm
      });
      const { data: data2 } = await worker.recognize(image_path);
      results.push({ data: data2, strategy: 'otsu', psm: altPsm });

      // 策略3: 尝试自适应阈值 (如果质量很差)
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

      // 策略4: 尝试 Sauvola 阈值 (如果是低对比度)
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

      // 合并结果
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

/**
 * Base64 图片识别
 */
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

    // 检测图像质量
    const quality = detectImageQuality(data);

    await worker.terminate();

    return formatOutput(data, output_format, language, psm, enhance_quality, { quality });
  } catch (error) {
    throw new Error(`Base64 OCR 识别失败: ${error.message}`);
  }
}

/**
 * 高级预处理 OCR 识别
 */
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

    // 预处理自动启用增强质量
    const worker = await createWorker(language, oem, {
      logger: m => {
        if (m.status === 'recognizing text') {
          console.error(`识别进度: ${(m.progress * 100).toFixed(0)}%`);
        }
      }
    });

    // 根据预处理选项选择最佳阈值策略
    let thresholdStrategy = 'otsu';
    if (preprocessing.enhance_contrast) {
      thresholdStrategy = 'adaptive'; // 对比度增强时使用自适应阈值
    }

    // 设置高级参数
    const params = {
      tessedit_pageseg_mode: psm,
      tessedit_ocr_engine_mode: oem,
      ...getEnhancedParams(language, true, thresholdStrategy), // 自动启用增强
    };

    // 根据预处理选项调整参数
    if (preprocessing.remove_noise) {
      params.textord_heavy_nr = '1';
      params.textord_noise_rejwords = '1';
    }

    await worker.setParameters(params);

    const { data } = await worker.recognize(image_path);

    // 检测图像质量
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

/**
 * 批量识别
 */
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

    const summary = `批量识别完成${enhance_quality ? ' (增强算法)' : ''}\n总数: ${results.length} | 成功: ${successCount} | 失败: ${results.filter(r => r.error).length} | 平均置信度: ${avgConfidence}%\n质量分布: 优秀${qualityStats.excellent} 良好${qualityStats.good} 一般${qualityStats.fair} 较差${qualityStats.poor}`;

    return {
      content: [{
        type: 'text',
        text: `${summary}\n\n${textOutput}`
      }]
    };
  } catch (error) {
    throw new Error(`批量 OCR 失败: ${error.message}`);
  }
}

/**
 * 区域识别
 */
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

    // 设置识别区域，使用单文本块模式
    const params = {
      tessedit_pageseg_mode: 6, // 单文本块模式更适合区域识别
      ...getEnhancedParams(language, enhance_quality, 'otsu')
    };

    await worker.setParameters(params);

    const { data } = await worker.recognize(image_path, {
      rectangle: region
    });

    // 检测图像质量
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

/**
 * 获取支持的语言列表
 */
async function getSupportedLanguages() {
  const languages = [
    { code: 'eng', name: 'English (英语)' },
    { code: 'chi_sim', name: 'Simplified Chinese (简体中文)' },
    { code: 'chi_tra', name: 'Traditional Chinese (繁体中文)' },
    { code: 'jpn', name: 'Japanese (日语)' },
    { code: 'kor', name: 'Korean (韩语)' },
    { code: 'fra', name: 'French (法语)' },
    { code: 'deu', name: 'German (德语)' },
    { code: 'spa', name: 'Spanish (西班牙语)' },
    { code: 'rus', name: 'Russian (俄语)' },
    { code: 'ara', name: 'Arabic (阿拉伯语)' },
    { code: 'hin', name: 'Hindi (印地语)' },
    { code: 'tha', name: 'Thai (泰语)' },
    { code: 'vie', name: 'Vietnamese (越南语)' },
    { code: 'por', name: 'Portuguese (葡萄牙语)' },
    { code: 'ita', name: 'Italian (意大利语)' },
    { code: 'nld', name: 'Dutch (荷兰语)' },
    { code: 'pol', name: 'Polish (波兰语)' },
    { code: 'tur', name: 'Turkish (土耳其语)' }
  ];

  const text = languages.map(l => `  ${l.code.padEnd(10)} - ${l.name}`).join('\n');

  return {
    content: [{
      type: 'text',
      text: `支持的 OCR 语言 (${languages.length} 种):\n\n${text}\n\n提示:\n- 可以使用 + 连接多个语言代码，如 eng+chi_sim\n- 启用 enhance_quality 参数可获得更高识别准确度`
    }]
  };
}

/**
 * 格式化输出
 */
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

    // 添加质量信息
    if (extraInfo.quality) {
      result.quality = {
        score: extraInfo.quality.score,
        level: extraInfo.quality.quality,
        variance: extraInfo.quality.variance,
        wordCount: extraInfo.quality.wordCount
      };
    }

    // 添加多策略信息
    if (extraInfo.multiStrategy) {
      result.multiStrategy = {
        enabled: true,
        strategiesUsed: extraInfo.strategiesUsed,
        initialConfidence: extraInfo.initialQuality.avgConfidence,
        finalConfidence: data.confidence,
        improvement: data.confidence - extraInfo.initialQuality.avgConfidence
      };
    }

    // 添加合并信息
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

  // 文本输出
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
    outputText += `\n- 提升: +${(data.confidence - extraInfo.initialQuality.avgConfidence).toFixed(2)}%`;
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
