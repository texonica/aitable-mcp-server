#!/usr/bin/env node

import { AITableService } from './aitableService.js';
import { AITableMCPServer } from './mcpServer.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/transport.js';

/**
 * Main function for the AITable MCP server
 */
export async function main(): Promise<void> {
  try {
    // Get the API key from command line arguments or environment variable
    let apiKey = process.env.AITABLE_API_KEY;
    
    if (!apiKey && process.argv.length > 2) {
      apiKey = process.argv[2];
      console.warn('WARNING: Passing API key as command line argument is deprecated. Please set the AITABLE_API_KEY environment variable instead.');
    }
    
    // Create service and server instances
    const aitableService = new AITableService(apiKey);
    const mcpServer = new AITableMCPServer(aitableService);
    
    // Create a transport for stdin/stdout
    const transport = new StdioServerTransport();
    
    // Connect the server to the transport
    await mcpServer.connect(transport);
    
    console.log('AITable MCP server started and listening on stdin/stdout');
    
    // Handle termination signals
    const handleTermination = async () => {
      console.log('Shutting down AITable MCP server...');
      await mcpServer.close();
      process.exit(0);
    };
    
    process.on('SIGINT', handleTermination);
    process.on('SIGTERM', handleTermination);
    
  } catch (error) {
    console.error('Error starting AITable MCP server:', error);
    process.exit(1);
  }
}

// Run the main function if this is the entry point
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
