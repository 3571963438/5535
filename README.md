# OCR 图片文字识别服务器

图片转文字工具，支持 18 种语言。

## 安装

```bash
npm install
```

## 启动

```bash
npm start
```

## 6 个功能

### 1. 识别图片文字

```json
{
  "name": "ocr_image",
  "arguments": {
    "image_path": "/path/to/image.jpg",
    "language": "chi_sim",
    "enhance_quality": true
  }
}
```

参数说明：
- image_path：图片路径
- language：语言（eng=英语，chi_sim=简体中文）
- enhance_quality：开启增强识别（准确度更高）
- output_format：text 或 json

### 2. Base64 图片识别

```json
{
  "name": "ocr_image_base64",
  "arguments": {
    "image_base64": "data:image/png;base64,iVBORw0KG...",
    "language": "eng"
  }
}
```

### 3. 预处理识别

适合模糊、低质量图片。

```json
{
  "name": "ocr_with_preprocessing",
  "arguments": {
    "image_path": "/path/to/image.jpg",
    "preprocessing": {
      "enhance_contrast": true,
      "remove_noise": true,
      "scale": 2.0
    }
  }
}
```

### 4. 批量识别

```json
{
  "name": "ocr_batch",
  "arguments": {
    "image_paths": [
      "/path/to/image1.jpg",
      "/path/to/image2.jpg"
    ]
  }
}
```

### 5. 区域识别

只识别图片的一部分。

```json
{
  "name": "ocr_region",
  "arguments": {
    "image_path": "/path/to/image.jpg",
    "region": {
      "x": 100,
      "y": 200,
      "width": 500,
      "height": 300
    }
  }
}
```

### 6. 查看支持的语言

```json
{
  "name": "get_supported_languages"
}
```

## 支持的语言

| 代码 | 语言 | 代码 | 语言 |
|------|------|------|------|
| eng | 英语 | chi_sim | 简体中文 |
| chi_tra | 繁体中文 | jpn | 日语 |
| kor | 韩语 | fra | 法语 |
| deu | 德语 | spa | 西班牙语 |
| rus | 俄语 | ara | 阿拉伯语 |
| hin | 印地语 | tha | 泰语 |
| vie | 越南语 | por | 葡萄牙语 |
| ita | 意大利语 | nld | 荷兰语 |
| pol | 波兰语 | tur | 土耳其语 |

多语言识别：eng+chi_sim

## PSM 模式

选择合适的识别模式可以提高准确度。

| PSM | 说明 | 适合 |
|-----|------|------|
| 3 | 自动（默认） | 一般图片 |
| 6 | 单个文本块 | 一段文字 |
| 7 | 单行 | 一行文字 |
| 8 | 单词 | 一个单词 |
| 11 | 稀疏文本 | 文字很少 |

## 提高准确度的方法

1. 设置 `enhance_quality: true`
2. 使用 `ocr_with_preprocessing` 处理低质量图片
3. 选择正确的语言
4. 选择合适的 PSM 模式
5. 使用高清晰度图片

## 配置文件

```json
{
  "mcpServers": {
    "ocr": {
      "command": "node",
      "args": ["/path/to/ocr-mcp/src/index.js"]
    }
  }
}
```

## 技术

- Tesseract.js v5.0.0
- Node.js >= 18.0.0

## 版本

v3.0.0

## 许可

MIT
