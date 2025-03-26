#!/usr/bin/env node

import 'dotenv/config';
import { AITableService } from './aitableService.js';
import { AITableMCPServer } from './mcpServer.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

// Print startup message to stderr so it's visible outside JSON-RPC
process.stderr.write('AITable MCP Server starting...\n');

/**
 * Process debugging helper functions
 */
function logStartup(message: string): void {
  // Log to stderr to avoid interfering with JSON-RPC communication
  process.stderr.write(`[STARTUP] ${message}\n`);
}

/**
 * Main function for the AITable MCP server
 */
export async function main(): Promise<void> {
  try {
    // Debug process info
    logStartup(`Process ID: ${process.pid}`);
    logStartup(`Node version: ${process.version}`);
    logStartup(`Working directory: ${process.cwd()}`);
    
    // Get the API key from command line arguments or environment variable
    let apiKey = process.env.AITABLE_API_KEY;
    
    if (!apiKey && process.argv.length > 2) {
      apiKey = process.argv[2];
      logStartup('Using API key from command line argument');
    }
    
    if (!apiKey) {
      throw new Error('AITable API key is required. Set it using the AITABLE_API_KEY environment variable.');
    }
    
    // Create service and server instances
    logStartup('Creating AITableService...');
    const aitableService = new AITableService(apiKey);
    
    logStartup('Creating AITableMCPServer...');
    const mcpServer = new AITableMCPServer(aitableService);
    
    // Directly register additional method handlers for Cursor compatibility 
    if ((mcpServer as any).server && (mcpServer as any).server.protocol) {
      const protocol = (mcpServer as any).server.protocol;
      logStartup('Adding direct protocol handlers for Cursor compatibility');
      
      // Debug the protocol handlers
      const protocolMethods = Object.keys(protocol);
      logStartup(`Available protocol methods: ${protocolMethods.join(', ')}`);
      
      // Debug the router if available
      if (protocol.router) {
        const routerMethods = Object.keys(protocol.router);
        logStartup(`Available router methods: ${routerMethods.join(', ')}`);
        
        // Debug registered request handlers if available
        if (protocol.router.requestHandlers) {
          const requestHandlers = Object.keys(protocol.router.requestHandlers);
          logStartup(`Registered request handlers: ${requestHandlers.join(', ')}`);
        }
      }
      
      // Debug request handlers if available
      if (protocol.requestHandlers) {
        const requestHandlers = Object.keys(protocol.requestHandlers);
        logStartup(`Protocol request handlers: ${requestHandlers.join(', ')}`);
      }

      try {
        // Try to register the method directly with the protocol
        if (typeof protocol.addMethod === 'function') {
          logStartup('Adding request handlers via protocol.addMethod');
          
          // The standard MCP method name is tools/call, but Cursor also might use tools/execute
          protocol.addMethod('tools/call', async (params: any) => {
            logStartup(`Executing tool via protocol.addMethod (tools/call): ${params.name}`);
            return await mcpServer.executeToolDirectly(params.name, params.arguments || params.input);
          });
          
          // Also add the Cursor-specific method name
          protocol.addMethod('tools/execute', async (params: any) => {
            logStartup(`Executing tool via protocol.addMethod (tools/execute): ${params.name}`);
            return await mcpServer.executeToolDirectly(params.name, params.input);
          });
        } 
        // Try to access the router property
        else if (protocol.router && typeof protocol.router.addMethod === 'function') {
          logStartup('Adding request handlers via router.addMethod');
          
          // The standard MCP method name is tools/call, but Cursor also might use tools/execute
          protocol.router.addMethod('tools/call', async (params: any) => {
            logStartup(`Executing tool via router.addMethod (tools/call): ${params.name}`);
            return await mcpServer.executeToolDirectly(params.name, params.arguments || params.input);
          });
          
          // Also add the Cursor-specific method name
          protocol.router.addMethod('tools/execute', async (params: any) => {
            logStartup(`Executing tool via router.addMethod (tools/execute): ${params.name}`);
            return await mcpServer.executeToolDirectly(params.name, params.input);
          });
        }
        // Try to add the request handler
        else if (typeof protocol.addRequestHandler === 'function') {
          logStartup('Adding request handlers via addRequestHandler');
          
          // The standard MCP method name is tools/call, but Cursor also might use tools/execute
          protocol.addRequestHandler('tools/call', async (params: any) => {
            logStartup(`Executing tool via addRequestHandler (tools/call): ${params.name}`);
            return await mcpServer.executeToolDirectly(params.name, params.arguments || params.input);
          });
          
          // Also add the Cursor-specific method name
          protocol.addRequestHandler('tools/execute', async (params: any) => {
            logStartup(`Executing tool via addRequestHandler (tools/execute): ${params.name}`);
            return await mcpServer.executeToolDirectly(params.name, params.input);
          });
        }
        // Try to set the request handler
        else if (typeof protocol.setRequestHandler === 'function') {
          logStartup('Adding request handlers via setRequestHandler');
          
          // The standard MCP method name is tools/call, but Cursor also might use tools/execute
          protocol.setRequestHandler('tools/call', async (request: any) => {
            const params = request.params;
            logStartup(`Executing tool via setRequestHandler (tools/call): ${params.name}`);
            return await mcpServer.executeToolDirectly(params.name, params.arguments || params.input);
          });
          
          // Also add the Cursor-specific method name
          protocol.setRequestHandler('tools/execute', async (request: any) => {
            const params = request.params;
            logStartup(`Executing tool via setRequestHandler (tools/execute): ${params.name}`);
            return await mcpServer.executeToolDirectly(params.name, params.input);
          });
        }
        else {
          logStartup('Could not add direct handlers, methods not available');
        }
      } catch (error) {
        logStartup(`Error registering method: ${error}`);
      }
    }
    
    // Create transport
    console.error('[STARTUP] Creating StdioServerTransport...');
    const transport = new StdioServerTransport();

    // Connect to transport
    console.error('[STARTUP] Connecting to transport...');
    await mcpServer.connect(transport);
    
    // Announce we're ready on stderr
    process.stderr.write('AITable MCP Server READY\n');
    
    // Handle termination signals
    const handleTermination = async () => {
      logStartup('Shutting down AITable MCP server...');
      await mcpServer.close();
      process.exit(0);
    };
    
    process.on('SIGINT', handleTermination);
    process.on('SIGTERM', handleTermination);
    
    // Log uncaught exceptions
    process.on('uncaughtException', (error) => {
      process.stderr.write(`Uncaught exception: ${error.message}\n${error.stack}\n`);
    });

    // Log unhandled rejections
    process.on('unhandledRejection', (reason) => {
      process.stderr.write(`Unhandled rejection: ${reason}\n`);
    });
    
  } catch (error) {
    process.stderr.write(`Error starting AITable MCP server: ${error}\n`);
    process.exit(1);
  }
}

// Run the main function if this is the entry point
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
