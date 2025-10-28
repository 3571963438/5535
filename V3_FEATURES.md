# OCR MCP v3.0 - 终极增强版

## 🚀 版本历程

- **v1.0** - 基础 OCR 功能 (4 工具)
- **v2.0** - 高级预处理和区域识别 (6 工具)
- **v3.0** - 智能识别和专业功能 (12 工具) ⭐ **当前版本**

## 📊 完整功能清单

### 核心识别工具 (6个)

#### 1. ocr_image - 基础图片识别
最常用的基础识别工具
- 支持所有常见图片格式
- 可自定义 OEM/PSM 参数
- 支持多语言混合识别

#### 2. ocr_image_base64 - Base64 图片识别
处理内存中的图片数据
- 无需保存临时文件
- 适合网络传输场景
- API 集成友好

#### 3. ocr_with_preprocessing - 高级预处理识别
针对低质量图片优化
- ✅ 对比度增强
- ✅ 噪点去除
- ✅ 倾斜纠正
- ✅ 智能缩放

#### 4. ocr_batch - 批量处理
高效批量识别
- Worker 自动复用
- 并发处理优化
- 统计信息输出
- 错误处理健全

#### 5. ocr_region - 区域识别
精确识别指定区域
- 像素级坐标定位
- 排除干扰区域
- 提高识别速度
- 适合结构化文档

#### 6. ocr_auto_rotate 🆕 - 自动旋转识别
智能方向检测
- 自动检测图片旋转角度
- 自动纠正方向后识别
- 输出旋转信息
- 适合拍照文档

### 智能分析工具 (3个)

#### 7. ocr_detect_text 🆕 - 文字检测定位
检测所有文字位置
- 返回每个词的坐标
- 置信度过滤
- 边界框信息
- 适合文字定位标注

#### 8. ocr_compare 🆕 - 图片内容比较
比较两张图片文字
- 计算相似度百分比
- 高亮差异部分
- 编辑距离算法
- 适合版本对比

#### 9. ocr_extract_numbers 🆕 - 数字提取
专门提取数字信息
- 📞 电话号码识别
- 💰 金额识别
- 📅 日期识别
- 🔢 整数识别
- 支持多种格式

### 专业功能工具 (2个)

#### 10. ocr_table 🆕 - 表格识别
结构化表格数据
- JSON 格式输出
- CSV 格式输出
- 自动行列识别
- 适合表单处理

#### 11. ocr_smart 🆕 - 智能识别
自动选择最佳参数
- 🚀 fast - 快速模式
- ⚖️ balanced - 平衡模式
- 🎯 accurate - 精确模式
- 无需手动调参

### 辅助工具 (1个)

#### 12. get_supported_languages - 语言列表
查看支持的语言
- 18 种语言支持
- 多语言混合识别
- 语言代码查询

## 🎯 应用场景

### 文档处理
```
- 扫描件识别 → ocr_with_preprocessing
- 表单识别 → ocr_table
- 证件识别 → ocr_region + ocr_extract_numbers
- 多页文档 → ocr_batch
```

### 拍照识别
```
- 随手拍照 → ocr_auto_rotate
- 模糊图片 → ocr_with_preprocessing
- 快速识别 → ocr_smart (fast)
```

### 数据提取
```
- 电话号码 → ocr_extract_numbers (phone)
- 金额提取 → ocr_extract_numbers (money)
- 日期提取 → ocr_extract_numbers (date)
- 表格数据 → ocr_table (csv)
```

### 质量对比
```
- 版本对比 → ocr_compare
- 翻译校对 → ocr_compare
- 文字定位 → ocr_detect_text
```

## 💡 使用示例

### 场景 1: 拍照识别名片
```json
{
  "name": "ocr_auto_rotate",
  "arguments": {
    "image_path": "/path/to/business_card.jpg",
    "language": "eng+chi_sim"
  }
}
```

### 场景 2: 提取发票金额
```json
{
  "name": "ocr_extract_numbers",
  "arguments": {
    "image_path": "/path/to/invoice.jpg",
    "number_type": "money"
  }
}
```

### 场景 3: 识别模糊表格
```json
{
  "name": "ocr_table",
  "arguments": {
    "image_path": "/path/to/table.jpg",
    "language": "eng",
    "output_format": "csv"
  }
}
```

### 场景 4: 智能快速识别
```json
{
  "name": "ocr_smart",
  "arguments": {
    "image_path": "/path/to/document.jpg",
    "quality": "fast",
    "language": "eng"
  }
}
```

### 场景 5: 检测文字位置
```json
{
  "name": "ocr_detect_text",
  "arguments": {
    "image_path": "/path/to/image.jpg",
    "min_confidence": 80
  }
}
```

### 场景 6: 比较两个版本
```json
{
  "name": "ocr_compare",
  "arguments": {
    "image_path1": "/path/to/version1.jpg",
    "image_path2": "/path/to/version2.jpg",
    "language": "eng"
  }
}
```

## 📈 性能对比

| 版本 | 工具数 | 核心功能 | 特色功能 |
|------|--------|----------|----------|
| v1.0 | 4 | 基础识别 | - |
| v2.0 | 6 | +预处理 +区域 | 高级参数 |
| v3.0 | **12** | +智能识别 | **表格/比较/数字提取** |

### 功能矩阵

| 功能 | v1.0 | v2.0 | v3.0 |
|------|------|------|------|
| 基础识别 | ✅ | ✅ | ✅ |
| Base64 | ✅ | ✅ | ✅ |
| 批量处理 | ✅ | ✅ | ✅ (优化) |
| 语言列表 | ✅ | ✅ | ✅ |
| 预处理 | ❌ | ✅ | ✅ |
| 区域识别 | ❌ | ✅ | ✅ |
| 自动旋转 | ❌ | ❌ | ✅ 🆕 |
| 文字定位 | ❌ | ❌ | ✅ 🆕 |
| 表格识别 | ❌ | ❌ | ✅ 🆕 |
| 内容比较 | ❌ | ❌ | ✅ 🆕 |
| 数字提取 | ❌ | ❌ | ✅ 🆕 |
| 智能模式 | ❌ | ❌ | ✅ 🆕 |

## 🎨 特色亮点

### 1. 智能化
- 🤖 自动参数选择
- 🔄 自动方向纠正
- 🎯 自动质量优化

### 2. 专业化
- 📊 表格结构化输出
- 🔢 专业数字提取
- 📍 精确位置定位

### 3. 易用性
- 📝 详细文档
- 💡 丰富示例
- 🛠️ 灵活参数

### 4. 性能
- ⚡ Worker 复用
- 🚀 批量优化
- 💾 内存高效

## 🔧 技术优势

### 算法增强
- Levenshtein 距离算法（文本相似度）
- Otsu 阈值算法（图像二值化）
- LSTM 神经网络（高精度识别）

### 架构优化
- 模块化设计
- 可扩展架构
- 错误处理健全

### 代码质量
- TypeScript 类型定义
- 详细注释文档
- 单元测试支持

## 📦 工具分类

```
OCR MCP v3.0 (12 工具)
├── 核心识别 (6)
│   ├── ocr_image
│   ├── ocr_image_base64
│   ├── ocr_with_preprocessing
│   ├── ocr_batch
│   ├── ocr_region
│   └── ocr_auto_rotate 🆕
├── 智能分析 (3)
│   ├── ocr_detect_text 🆕
│   ├── ocr_compare 🆕
│   └── ocr_extract_numbers 🆕
├── 专业功能 (2)
│   ├── ocr_table 🆕
│   └── ocr_smart 🆕
└── 辅助工具 (1)
    └── get_supported_languages
```

## 🌟 未来展望

### 计划中的功能
- 🎬 视频帧文字识别
- 🖼️ 手写文字识别
- 🌈 彩色文档增强
- 📄 PDF 多页批量处理
- 🔐 验证码识别
- 🎯 二维码/条形码识别

## 📊 统计数据

- **工具数量:** 12 个
- **新增工具:** 6 个（v2.0 → v3.0）
- **代码行数:** ~900 行
- **支持语言:** 18 种
- **输出格式:** text, json, csv

## 🎓 适用人群

- 📝 文档处理人员
- 💼 数据录入人员
- 🔬 研究人员
- 👨‍💻 开发者
- 📊 数据分析师

## ⚡ 快速开始

```bash
# 安装
cd /storage/emulated/0/7点/ocr-mcp
npm install

# 运行
npm start

# 配置 MCP 客户端
{
  "mcpServers": {
    "ocr": {
      "command": "node",
      "args": ["/storage/emulated/0/7点/ocr-mcp/src/index.js"]
    }
  }
}
```

---

**版本:** v3.0.0
**发布日期:** 2025-10-27
**许可证:** MIT
**工具数:** 12 个
**状态:** ✅ 生产就绪
