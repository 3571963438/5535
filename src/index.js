#!/usr/bin/env node

/**
 * OCR MCP 服务器
 * 提供图片文字识别功能的 MCP 服务
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

import { ocrTools } from './ocrTools.js';
import { handleOCR } from './ocrHandler.js';

// 创建 MCP 服务器实例
const server = new Server(
  {
    name: 'ocr-mcp-server',
    version: '2.1.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

/**
 * 处理工具列表请求
 */
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: ocrTools,
  };
});

/**
 * 处理工具调用请求
 */
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  try {
    const result = await handleOCR(request.params);
    return result;
  } catch (error) {
    console.error('OCR 处理错误:', error);
    return {
      content: [
        {
          type: 'text',
          text: `错误: ${error.message}`,
        },
      ],
      isError: true,
    };
  }
});

/**
 * 启动服务器
 */
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);

  console.error('========================================');
  console.error('OCR MCP 服务器已启动 v2.1.0');
  console.error('🚀 增强识别算法:');
  console.error('  ✓ Otsu 自适应阈值');
  console.error('  ✓ 字典智能纠错');
  console.error('  ✓ 双字母组合纠错');
  console.error('  ✓ 智能降噪处理');
  console.error('  ✓ 低质量词过滤');
  console.error('  ✓ 自动参数优化');
  console.error('  ✓ 中英文差异化优化');
  console.error('');
  console.error('📌 使用提示:');
  console.error('  设置 enhance_quality: true 启用增强算法');
  console.error('========================================');
}

// 启动服务器
main().catch((error) => {
  console.error('服务器启动失败:', error);
  process.exit(1);
});
