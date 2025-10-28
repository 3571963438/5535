#!/usr/bin/env node

export const ocrTools = [
  {
    name: 'ocr_image',
    description: 'Recognize text from image with multi-language and enhanced algorithm support',
    inputSchema: {
      type: 'object',
      properties: {
        image_path: {
          type: 'string',
          description: 'Image file path (supports jpg, png, bmp, tiff, etc.)'
        },
        language: {
          type: 'string',
          description: 'Language code (default: eng). Multiple languages: eng+chi_sim',
          default: 'eng'
        },
        psm: {
          type: 'number',
          description: 'Page segmentation mode (0-13). 3=auto, 6=block, 7=line, 8=word, 11=sparse',
          default: 3
        },
        oem: {
          type: 'number',
          description: 'OCR engine mode (0-3). 3=default LSTM, 2=legacy, 1=neural, 0=legacy only',
          default: 3
        },
        enhance_quality: {
          type: 'boolean',
          description: 'Enable enhanced recognition algorithm',
          default: false
        },
        output_format: {
          type: 'string',
          description: 'Output format: text or json (with confidence and coordinates)',
          enum: ['text', 'json'],
          default: 'text'
        }
      },
      required: ['image_path']
    }
  },
  {
    name: 'ocr_image_base64',
    description: 'Recognize text from Base64 encoded image',
    inputSchema: {
      type: 'object',
      properties: {
        image_base64: {
          type: 'string',
          description: 'Base64 encoded image data (with or without data:image prefix)'
        },
        language: {
          type: 'string',
          description: 'Language code',
          default: 'eng'
        },
        psm: {
          type: 'number',
          description: 'Page segmentation mode',
          default: 3
        },
        oem: {
          type: 'number',
          description: 'OCR engine mode',
          default: 3
        },
        enhance_quality: {
          type: 'boolean',
          description: 'Enable enhanced algorithm',
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
    description: 'OCR with advanced image preprocessing for better accuracy',
    inputSchema: {
      type: 'object',
      properties: {
        image_path: {
          type: 'string',
          description: 'Image file path'
        },
        language: {
          type: 'string',
          description: 'Language code',
          default: 'eng'
        },
        psm: {
          type: 'number',
          description: 'Page segmentation mode',
          default: 3
        },
        oem: {
          type: 'number',
          description: 'OCR engine mode',
          default: 3
        },
        preprocessing: {
          type: 'object',
          description: 'Preprocessing options',
          properties: {
            enhance_contrast: {
              type: 'boolean',
              description: 'Enhance contrast',
              default: true
            },
            remove_noise: {
              type: 'boolean',
              description: 'Remove noise',
              default: true
            },
            deskew: {
              type: 'boolean',
              description: 'Correct skew',
              default: true
            },
            scale: {
              type: 'number',
              description: 'Scale factor (1.0-3.0, recommended: 2.0)',
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
    description: 'Batch OCR for multiple images',
    inputSchema: {
      type: 'object',
      properties: {
        image_paths: {
          type: 'array',
          items: {
            type: 'string'
          },
          description: 'Array of image file paths'
        },
        language: {
          type: 'string',
          description: 'Language code',
          default: 'eng'
        },
        psm: {
          type: 'number',
          description: 'Page segmentation mode',
          default: 3
        },
        oem: {
          type: 'number',
          description: 'OCR engine mode',
          default: 3
        },
        enhance_quality: {
          type: 'boolean',
          description: 'Enable enhanced algorithm',
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
    description: 'Recognize text in specified region of image',
    inputSchema: {
      type: 'object',
      properties: {
        image_path: {
          type: 'string',
          description: 'Image file path'
        },
        region: {
          type: 'object',
          description: 'Recognition region (pixel coordinates)',
          properties: {
            x: {
              type: 'number',
              description: 'Top-left X coordinate'
            },
            y: {
              type: 'number',
              description: 'Top-left Y coordinate'
            },
            width: {
              type: 'number',
              description: 'Region width'
            },
            height: {
              type: 'number',
              description: 'Region height'
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
          description: 'Enable enhanced algorithm',
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
    description: 'Get list of all supported OCR languages',
    inputSchema: {
      type: 'object',
      properties: {},
      required: []
    }
  }
];
