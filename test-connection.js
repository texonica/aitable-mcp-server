#!/usr/bin/env node

// This script directly tests the JSON-RPC communication with the MCP server
// by using standard input/output pipes

import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

// Create a log file
const logDir = path.join(process.cwd(), 'logs');
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

const logFile = path.join(logDir, `connection-test-${Date.now()}.log`);
const logger = fs.createWriteStream(logFile, { flags: 'a' });

function log(msg) {
  const timestamp = new Date().toISOString();
  const message = `[${timestamp}] ${msg}`;
  console.log(message);
  logger.write(message + '\n');
}

log('Starting MCP server connection test');

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
let stderrBuffer = '';
serverProcess.stderr.on('data', (data) => {
  const text = data.toString();
  stderrBuffer += text;
  log(`STDERR: ${text.trim()}`);
});

// Collect stdout output
let stdoutBuffer = '';
serverProcess.stdout.on('data', (data) => {
  const text = data.toString();
  stdoutBuffer += text;
  log(`STDOUT: ${text.trim()}`);
  
  // Check for response to our request
  if (text.includes('"id":"test-request"')) {
    log('✅ Got response to our test request');
    
    // Try one more request
    setTimeout(() => {
      const listTablesRequest = {
        jsonrpc: '2.0',
        id: 'list-tables-request',
        method: 'mcp/tool',
        params: {
          name: 'list_tables',
          input: {
            baseId: 'spc12q5HY4ay5'
          }
        }
      };
      
      log('Sending list_tables request...');
      serverProcess.stdin.write(JSON.stringify(listTablesRequest) + '\n');
    }, 1000);
  }
  
  if (text.includes('"id":"list-tables-request"')) {
    log('✅ Got response to list_tables request');
    log('Test completed successfully!');
    
    // Wait a moment to finish writing logs, then exit
    setTimeout(() => {
      serverProcess.kill();
      process.exit(0);
    }, 1000);
  }
});

// Wait a bit for server to start up
setTimeout(() => {
  log('Server should be started by now, sending test request...');
  
  // Send a JSON-RPC request to the list_bases tool
  const request = {
    jsonrpc: '2.0',
    id: 'test-request',
    method: 'mcp/tool',
    params: {
      name: 'list_bases',
      input: {}
    }
  };
  
  log(`Sending request: ${JSON.stringify(request)}`);
  serverProcess.stdin.write(JSON.stringify(request) + '\n');
}, 2000);

// Set a timeout to kill the process if test takes too long
setTimeout(() => {
  log('❌ Test timed out');
  serverProcess.kill();
  process.exit(1);
}, 30000); 