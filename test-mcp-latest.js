#!/usr/bin/env node

// Test script that uses the latest MCP protocol to test the server
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

// Create logs directory if it doesn't exist
const logDir = path.join(process.cwd(), 'logs');
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

const logFile = path.join(logDir, `mcp-test-latest-${Date.now()}.log`);
const logger = fs.createWriteStream(logFile, { flags: 'a' });

function log(msg) {
  const timestamp = new Date().toISOString();
  const message = `[${timestamp}] ${msg}`;
  console.log(message);
  logger.write(message + '\n');
}

log('Starting MCP protocol test with latest protocol version');

// Start the MCP server process
const serverProcess = spawn('node', ['dist/index.js'], {
  env: {
    ...process.env,
    AITABLE_API_KEY: 'usk3Yk0DwQRo5BWrNNCAubm',
    SPACE: 'spc12q5HY4ay5',
  },
  stdio: ['pipe', 'pipe', 'pipe']
});

// Listen for process events
serverProcess.on('error', (err) => {
  log(`Process error: ${err}`);
});

serverProcess.on('exit', (code) => {
  log(`Process exited with code ${code}`);
});

// Collect stderr output
serverProcess.stderr.on('data', (data) => {
  const text = data.toString();
  log(`STDERR: ${text.trim()}`);
});

// Collect stdout output
serverProcess.stdout.on('data', (data) => {
  const text = data.toString();
  log(`STDOUT: ${text.trim()}`);
  
  // Check for responses
  try {
    // Sometimes multiple responses might be in one data chunk
    const lines = text.trim().split('\n');
    for (const line of lines) {
      if (!line) continue;
      
      try {
        const response = JSON.parse(line);
        log(`Got JSON-RPC response: ${JSON.stringify(response, null, 2)}`);
        
        if (response.id === 'init') {
          log('✅ Got response to initialize request');
          
          // Send initialized notification
          sendInitializedNotification();
          
          // Try list_bases next
          setTimeout(() => {
            sendListBasesRequest();
          }, 1000);
        }
        
        if (response.id === 'list-bases') {
          log('✅ Got response to list_bases request');
          
          // Try list_tables next
          setTimeout(() => {
            sendListTablesRequest();
          }, 1000);
        }
        
        if (response.id === 'list-tables') {
          log('✅ Got response to list_tables request');
          log('Test completed successfully!');
          
          // Exit with success
          setTimeout(() => {
            serverProcess.kill();
            process.exit(0);
          }, 1000);
        }
      } catch (e) {
        log(`Error parsing JSON response: ${e.message}`);
      }
    }
  } catch (err) {
    log(`Error processing response: ${err.message}`);
  }
});

// Wait for server to start
setTimeout(() => {
  log('Sending initialize request...');
  
  // First, send initialize request (new protocol)
  const initializeRequest = {
    jsonrpc: '2.0',
    id: 'init',
    method: 'initialize',
    params: {
      protocolVersion: '0.1.0',
      clientInfo: {
        name: 'MCP Test Client',
        version: '0.1.0'
      },
      capabilities: {
        tools: true,
        resources: true
      }
    }
  };
  
  serverProcess.stdin.write(JSON.stringify(initializeRequest) + '\n');
}, 2000);

// Function to send initialized notification
function sendInitializedNotification() {
  log('Sending initialized notification...');
  
  const initializedNotification = {
    jsonrpc: '2.0',
    method: 'initialized',
    params: {}
  };
  
  serverProcess.stdin.write(JSON.stringify(initializedNotification) + '\n');
}

// Function to send list_bases request
function sendListBasesRequest() {
  log('Sending list_bases request...');
  
  const listBasesRequest = {
    jsonrpc: '2.0',
    id: 'list-bases',
    method: 'mcp/tools/execute',
    params: {
      name: 'list_bases',
      input: {}
    }
  };
  
  serverProcess.stdin.write(JSON.stringify(listBasesRequest) + '\n');
}

// Function to send list_tables request
function sendListTablesRequest() {
  log('Sending list_tables request...');
  
  const listTablesRequest = {
    jsonrpc: '2.0',
    id: 'list-tables',
    method: 'mcp/tools/execute',
    params: {
      name: 'list_tables',
      input: {
        baseId: 'spc12q5HY4ay5'
      }
    }
  };
  
  serverProcess.stdin.write(JSON.stringify(listTablesRequest) + '\n');
}

// Set a timeout
setTimeout(() => {
  log('❌ Test timed out');
  serverProcess.kill();
  process.exit(1);
}, 30000); 