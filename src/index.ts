#!/usr/bin/env node

import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { AITableService } from './aitableService.js';
import { AITableMCPServer } from './mcpServer.js';

/**
 * Main entry point for the AITable MCP Server
 */
const main = async () => {
  const apiKey = process.argv.slice(2)[0];
  if (apiKey) {
    // Deprecation warning
    console.warn('warning (aitable-mcp-server): Passing in an API key as a command-line argument is deprecated and may be removed in a future version. Instead, set the `AITABLE_API_KEY` environment variable. See documentation for details.');
  }
  
  try {
    const aitableService = new AITableService(apiKey);
    const server = new AITableMCPServer(aitableService);
    const transport = new StdioServerTransport();
    
    console.log('AITable MCP Server starting...');
    await server.connect(transport);
    console.log('AITable MCP Server connected and ready');
    
    // Handle process termination
    process.on('SIGINT', async () => {
      console.log('Shutting down AITable MCP Server...');
      await server.close();
      process.exit(0);
    });
    
    process.on('SIGTERM', async () => {
      console.log('Shutting down AITable MCP Server...');
      await server.close();
      process.exit(0);
    });
  } catch (error) {
    console.error('Error starting AITable MCP Server:', error);
    process.exit(1);
  }
};

await main();
