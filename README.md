# OCR MCP 服务器

基于 Tesseract.js 的 OCR（光学字符识别）MCP 服务器，支持从图片中提取文字。

## 功能特性

### 核心功能
- ✅ **ocr_image** - 识别图片中的文字
- ✅ **ocr_image_base64** - 识别 Base64 编码图片中的文字
- ✅ **ocr_batch** - 批量识别多张图片
- ✅ **ocr_with_preprocessing** - 预处理后识别（提高准确度）
- ✅ **get_supported_languages** - 获取支持的语言列表

### 支持特性
- 📷 支持多种图片格式：JPG, PNG, BMP, TIFF 等
- 🌍 支持多种语言识别：英文、中文、日文、韩文等
- 🔧 图片预处理：灰度化、二值化、降噪、缩放
- 📊 输出格式：纯文本或 JSON（包含置信度）
- ⚡ 批量处理支持

## 项目结构

```
/storage/emulated/0/7点/ocr-mcp/
├── package.json          # 项目配置
├── README.md            # 文档
└── src/
    ├── index.js         # 主服务器
    ├── ocrTools.js      # OCR 工具定义
    └── ocrHandler.js    # OCR 处理逻辑
```

## 安装

```bash
cd /storage/emulated/0/7点/ocr-mcp/
npm install
```

## 运行

```bash
npm start
```

## 配置使用

在 MCP 客户端配置文件中添加：

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

## 使用示例

### 1. 基本图片识别

```javascript
{
  "name": "ocr_image",
  "arguments": {
    "image_path": "/path/to/image.jpg",
    "language": "eng"
  }
}
```

### 2. 识别中文图片

```javascript
{
  "name": "ocr_image",
  "arguments": {
    "image_path": "/path/to/chinese.jpg",
    "language": "chi_sim",
    "output_format": "json"
  }
}
```

### 3. Base64 图片识别

```javascript
{
  "name": "ocr_image_base64",
  "arguments": {
    "image_base64": "data:image/jpeg;base64,/9j/4AAQ...",
    "language": "eng"
  }
}
```

### 4. 批量识别

```javascript
{
  "name": "ocr_batch",
  "arguments": {
    "image_paths": [
      "/path/to/image1.jpg",
      "/path/to/image2.jpg",
      "/path/to/image3.jpg"
    ],
    "language": "eng"
  }
}
```

### 5. 预处理后识别（提高准确度）

```javascript
{
  "name": "ocr_with_preprocessing",
  "arguments": {
    "image_path": "/path/to/image.jpg",
    "language": "eng",
    "preprocessing": {
      "grayscale": true,
      "threshold": true,
      "denoise": true,
      "resize": 2
    }
  }
}
```

### 6. 获取支持的语言

```javascript
{
  "name": "get_supported_languages",
  "arguments": {}
}
```

## 支持的语言

| 语言代码 | 语言名称 |
|---------|---------|
| eng | 英文 |
| chi_sim | 简体中文 |
| chi_tra | 繁体中文 |
| jpn | 日语 |
| kor | 韩语 |
| fra | 法语 |
| deu | 德语 |
| spa | 西班牙语 |
| rus | 俄语 |
| ara | 阿拉伯语 |
| hin | 印地语 |
| tha | 泰语 |
| vie | 越南语 |

## 页面分割模式（PSM）

- 0: 仅方向和脚本检测
- 1: 自动页面分割，带OSD
- 3: 完全自动页面分割（默认）
- 6: 假设单个文本块
- 7: 单行文本
- 8: 单个单词
- 11: 稀疏文本

## 预处理选项

### grayscale（灰度化）
将图片转换为灰度图，减少颜色干扰

### threshold（二值化）
将图片转换为黑白二值图，提高文字对比度

### denoise（降噪）
去除图片噪点，提高识别准确度

### resize（缩放）
放大或缩小图片，适应不同分辨率

## 技术栈

- **Tesseract.js** ^5.0.0 - OCR 引擎
- **Sharp** ^0.33.0 - 图片处理
- **@modelcontextprotocol/sdk** ^0.5.0 - MCP 协议
- Node.js >= 18.0.0

## 性能优化建议

1. **图片预处理**：对于低质量图片，使用预处理功能
2. **批量处理**：使用 `ocr_batch` 减少 Worker 创建开销
3. **语言选择**：仅加载需要的语言以提高速度
4. **图片质量**：使用高分辨率、清晰的图片

## 常见问题

### Q: 识别准确度低怎么办？
A: 尝试以下方法：
- 使用 `ocr_with_preprocessing` 进行预处理
- 调整 PSM 模式
- 确保图片清晰、文字对比度高
- 使用正确的语言代码

### Q: 支持哪些图片格式？
A: 支持 JPG, PNG, BMP, TIFF, GIF 等常见格式

### Q: 可以同时识别多种语言吗？
A: 可以，使用 `+` 连接多个语言代码，如 `eng+chi_sim`

### Q: 识别速度慢怎么办？
A:
- 使用适当的图片尺寸
- 批量处理时复用 Worker
- 避免频繁创建和销毁 Worker

## 许可证

MIT License

## 更新日志

### v1.0.0
- 初始版本
- 支持基本 OCR 功能
- 支持多语言识别
- 支持图片预处理
- 支持批量处理
