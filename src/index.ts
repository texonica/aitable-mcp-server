#!/usr/bin/env node

import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { AirtableService } from './airtableService.js';
import { AirtableMCPServer } from './mcpServer.js';

const main = async () => {
  const args = process.argv.slice(2);
  if (args.length !== 1) {
    console.error('Please provide Airtable API key as a command-line argument');
    console.error('Usage: airtable-mcp-server <API_KEY>');
    process.exit(1);
  }

  const apiKey = args[0];
  if (typeof apiKey !== 'string') {
    throw new Error('API key must be a string');
  }
  
  const airtableService = new AirtableService(apiKey);
  const server = new AirtableMCPServer(airtableService);
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main();
