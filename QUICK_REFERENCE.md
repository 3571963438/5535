# OCR MCP 快速参考指南 v3.0

## 🚀 12 个工具速查

### 1️⃣ ocr_image - 标准识别
```json
{"name": "ocr_image", "arguments": {"image_path": "...", "language": "eng"}}
```

### 2️⃣ ocr_image_base64 - Base64 识别
```json
{"name": "ocr_image_base64", "arguments": {"image_base64": "data:image/..."}}
```

### 3️⃣ ocr_with_preprocessing - 预处理识别（低质量图片）
```json
{
  "name": "ocr_with_preprocessing",
  "arguments": {
    "image_path": "...",
    "preprocessing": {"enhance_contrast": true, "scale": 2.0}
  }
}
```

### 4️⃣ ocr_batch - 批量识别
```json
{
  "name": "ocr_batch",
  "arguments": {"image_paths": ["img1.jpg", "img2.jpg"]}
}
```

### 5️⃣ ocr_region - 区域识别
```json
{
  "name": "ocr_region",
  "arguments": {
    "image_path": "...",
    "region": {"x": 100, "y": 200, "width": 500, "height": 300}
  }
}
```

### 6️⃣ ocr_auto_rotate - 自动旋转 🆕
```json
{"name": "ocr_auto_rotate", "arguments": {"image_path": "..."}}
```

### 7️⃣ ocr_detect_text - 文字定位 🆕
```json
{
  "name": "ocr_detect_text",
  "arguments": {"image_path": "...", "min_confidence": 80}
}
```

### 8️⃣ ocr_table - 表格识别 🆕
```json
{
  "name": "ocr_table",
  "arguments": {"image_path": "...", "output_format": "csv"}
}
```

### 9️⃣ ocr_compare - 图片比较 🆕
```json
{
  "name": "ocr_compare",
  "arguments": {"image_path1": "v1.jpg", "image_path2": "v2.jpg"}
}
```

### 🔟 ocr_extract_numbers - 数字提取 🆕
```json
{
  "name": "ocr_extract_numbers",
  "arguments": {"image_path": "...", "number_type": "phone"}
}
```
**类型:** phone, money, date, integer, all

### 1️⃣1️⃣ ocr_smart - 智能识别 🆕
```json
{
  "name": "ocr_smart",
  "arguments": {"image_path": "...", "quality": "accurate"}
}
```
**质量:** fast, balanced, accurate

### 1️⃣2️⃣ get_supported_languages - 语言列表
```json
{"name": "get_supported_languages", "arguments": {}}
```

## 🎯 场景速查

| 场景 | 推荐工具 |
|------|----------|
| 📄 清晰文档 | ocr_image |
| 📷 拍照文档 | ocr_auto_rotate |
| 🌫️ 模糊图片 | ocr_with_preprocessing |
| 📊 表格数据 | ocr_table |
| 🔢 提取数字 | ocr_extract_numbers |
| 📍 文字定位 | ocr_detect_text |
| 🔍 版本对比 | ocr_compare |
| ⚡ 快速识别 | ocr_smart (fast) |
| 🎯 精确识别 | ocr_smart (accurate) |
| 📦 批量处理 | ocr_batch |
| 🎪 局部识别 | ocr_region |

## 🌍 语言代码

| 代码 | 语言 | 代码 | 语言 |
|------|------|------|------|
| eng | 英语 | chi_sim | 简体中文 |
| chi_tra | 繁体中文 | jpn | 日语 |
| kor | 韩语 | fra | 法语 |
| deu | 德语 | spa | 西班牙语 |
| rus | 俄语 | ara | 阿拉伯语 |

**多语言:** `"language": "eng+chi_sim"`

## ⚙️ PSM 模式

| PSM | 描述 | 使用场景 |
|-----|------|---------|
| 3 | 自动分割 | 默认，通用 |
| 6 | 单文本块 | 段落、表格 |
| 7 | 单行文本 | 标题、单行 |
| 8 | 单词 | 单个单词 |
| 11 | 稀疏文本 | 分散文字 |

## 📤 输出格式

### text（默认）
纯文本 + 置信度信息

### json
```json
{
  "text": "...",
  "confidence": 95.6,
  "words": [...],
  "lines": [...]
}
```

### csv（仅 ocr_table）
```
列1 | 列2 | 列3
数据1 | 数据2 | 数据3
```

## 💡 性能优化

### 提高准确度
1. 使用 `ocr_with_preprocessing`
2. 调整 PSM 模式
3. 提高图片分辨率
4. 正确的语言代码

### 提高速度
1. 使用 `ocr_batch` 批量处理
2. 使用 `ocr_smart (fast)`
3. 限制识别区域 `ocr_region`
4. 避免过大的图片

## 🔧 常用参数组合

### 高质量识别
```json
{
  "oem": 1,
  "psm": 1,
  "preprocessing": {
    "enhance_contrast": true,
    "remove_noise": true,
    "scale": 2.0
  }
}
```

### 快速识别
```json
{
  "oem": 0,
  "psm": 3
}
```

### 表格识别
```json
{
  "psm": 6,
  "output_format": "csv"
}
```

### 单行文本
```json
{
  "psm": 7,
  "oem": 1
}
```

## 📞 技术支持

- 📖 完整文档: README.md
- 🚀 功能详解: V3_FEATURES.md
- 📝 更新日志: ENHANCEMENT_SUMMARY.md
- 💻 源代码: src/

## ⚡ 安装运行

```bash
npm install
npm start
```

---

**版本:** v3.0.0
**工具数:** 12 个
**语言数:** 18 种
