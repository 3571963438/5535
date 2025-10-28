#!/usr/bin/env node

export const ocrTools = [
  {
    name: 'ocr_image',
    description: '从图片中识别文字，支持多语言和增强识别算法',
    inputSchema: {
      type: 'object',
      properties: {
        image_path: {
          type: 'string',
          description: '图片文件路径（支持 jpg, png, bmp, tiff 等格式）'
        },
        language: {
          type: 'string',
          description: '识别语言代码（默认: eng）。多语言: eng+chi_sim',
          default: 'eng'
        },
        psm: {
          type: 'number',
          description: '页面分割模式 (0-13)。3=自动, 6=文本块, 7=单行, 8=单词, 11=稀疏文本',
          default: 3
        },
        oem: {
          type: 'number',
          description: 'OCR 引擎模式 (0-3)。3=默认 LSTM, 2=传统, 1=神经网络, 0=仅传统',
          default: 3
        },
        enhance_quality: {
          type: 'boolean',
          description: '启用增强识别算法',
          default: false
        },
        output_format: {
          type: 'string',
          description: '输出格式: text 或 json（包含置信度和坐标）',
          enum: ['text', 'json'],
          default: 'text'
        }
      },
      required: ['image_path']
    }
  },
  {
    name: 'ocr_image_base64',
    description: '识别 Base64 编码的图片',
    inputSchema: {
      type: 'object',
      properties: {
        image_base64: {
          type: 'string',
          description: 'Base64 编码的图片数据（可带或不带 data:image 前缀）'
        },
        language: {
          type: 'string',
          description: '识别语言代码',
          default: 'eng'
        },
        psm: {
          type: 'number',
          description: '页面分割模式',
          default: 3
        },
        oem: {
          type: 'number',
          description: 'OCR 引擎模式',
          default: 3
        },
        enhance_quality: {
          type: 'boolean',
          description: '启用增强算法',
          default: false
        },
        output_format: {
          type: 'string',
          enum: ['text', 'json'],
          default: 'text'
        }
      },
      required: ['image_base64']
    }
  },
  {
    name: 'ocr_with_preprocessing',
    description: '使用高级图像预处理进行 OCR 识别以提高准确度',
    inputSchema: {
      type: 'object',
      properties: {
        image_path: {
          type: 'string',
          description: '图片文件路径'
        },
        language: {
          type: 'string',
          description: '识别语言代码',
          default: 'eng'
        },
        psm: {
          type: 'number',
          description: '页面分割模式',
          default: 3
        },
        oem: {
          type: 'number',
          description: 'OCR 引擎模式',
          default: 3
        },
        preprocessing: {
          type: 'object',
          description: '预处理选项',
          properties: {
            enhance_contrast: {
              type: 'boolean',
              description: '增强对比度',
              default: true
            },
            remove_noise: {
              type: 'boolean',
              description: '去除噪点',
              default: true
            },
            deskew: {
              type: 'boolean',
              description: '纠正倾斜',
              default: true
            },
            scale: {
              type: 'number',
              description: '缩放比例 (1.0-3.0，推荐: 2.0)',
              default: 2.0
            }
          }
        },
        output_format: {
          type: 'string',
          enum: ['text', 'json'],
          default: 'text'
        }
      },
      required: ['image_path']
    }
  },
  {
    name: 'ocr_batch',
    description: '批量识别多张图片',
    inputSchema: {
      type: 'object',
      properties: {
        image_paths: {
          type: 'array',
          items: {
            type: 'string'
          },
          description: '图片文件路径数组'
        },
        language: {
          type: 'string',
          description: '识别语言代码',
          default: 'eng'
        },
        psm: {
          type: 'number',
          description: '页面分割模式',
          default: 3
        },
        oem: {
          type: 'number',
          description: 'OCR 引擎模式',
          default: 3
        },
        enhance_quality: {
          type: 'boolean',
          description: '启用增强算法',
          default: false
        },
        output_format: {
          type: 'string',
          enum: ['text', 'json'],
          default: 'text'
        }
      },
      required: ['image_paths']
    }
  },
  {
    name: 'ocr_region',
    description: '识别图片中指定区域的文字',
    inputSchema: {
      type: 'object',
      properties: {
        image_path: {
          type: 'string',
          description: '图片文件路径'
        },
        region: {
          type: 'object',
          description: '识别区域（像素坐标）',
          properties: {
            x: {
              type: 'number',
              description: '左上角 X 坐标'
            },
            y: {
              type: 'number',
              description: '左上角 Y 坐标'
            },
            width: {
              type: 'number',
              description: '区域宽度'
            },
            height: {
              type: 'number',
              description: '区域高度'
            }
          },
          required: ['x', 'y', 'width', 'height']
        },
        language: {
          type: 'string',
          default: 'eng'
        },
        enhance_quality: {
          type: 'boolean',
          description: '启用增强算法',
          default: false
        },
        output_format: {
          type: 'string',
          enum: ['text', 'json'],
          default: 'text'
        }
      },
      required: ['image_path', 'region']
    }
  },
  {
    name: 'get_supported_languages',
    description: '获取所有支持的 OCR 语言列表',
    inputSchema: {
      type: 'object',
      properties: {},
      required: []
    }
  }
];
