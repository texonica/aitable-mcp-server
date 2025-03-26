#!/usr/bin/env node

// This script directly tests the MCP protocol communication with the AITable MCP server

import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

// Create a log file
const logDir = path.join(process.cwd(), 'logs');
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

const logFile = path.join(logDir, `mcp-test-${Date.now()}.log`);
const logger = fs.createWriteStream(logFile, { flags: 'a' });

function log(msg) {
  const timestamp = new Date().toISOString();
  const message = `[${timestamp}] ${msg}`;
  console.log(message);
  logger.write(message + '\n');
}

log('Starting MCP protocol test');

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
        log(`Got JSON-RPC response: ${JSON.stringify(response)}`);
        
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
  log('Sending client hello...');
  
  // First, send a client hello
  const clientHello = {
    jsonrpc: '2.0',
    id: 'client-hello',
    method: 'hello',
    params: {
      version: '0.1.0',
      description: 'MCP Protocol Test Client'
    }
  };
  
  serverProcess.stdin.write(JSON.stringify(clientHello) + '\n');
  
  // After a short delay, send the actual request
  setTimeout(() => {
    sendListBasesRequest();
  }, 500);
}, 2000);

// Function to send list_bases request
function sendListBasesRequest() {
  log('Sending list_bases request...');
  
  const listBasesRequest = {
    jsonrpc: '2.0',
    id: 'list-bases',
    method: 'mcp/tool',
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
    method: 'mcp/tool',
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