#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

import { ocrTools } from './ocrTools.js';
import { handleOCR } from './ocrHandler.js';

const server = new Server(
  {
    name: 'ocr-mcp-server',
    version: '3.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: ocrTools,
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  try {
    const result = await handleOCR(request.params);
    return result;
  } catch (error) {
    console.error('OCR 错误:', error);
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

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('OCR MCP 服务器 v3.0.0 已启动');
}

main().catch((error) => {
  console.error('服务器启动失败:', error);
  process.exit(1);
});
