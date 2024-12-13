#!/usr/bin/env node

import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { AirtableService } from './airtableService.js';
import { AirtableMCPServer } from './mcpServer.js';

const main = async () => {
  const apiKey = process.argv.slice(2)[0];
  const airtableService = new AirtableService(apiKey);
  const server = new AirtableMCPServer(airtableService);
  const transport = new StdioServerTransport();
  await server.connect(transport);
};

await main();
