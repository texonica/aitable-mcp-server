#!/usr/bin/env node

// Test script that simulates how Cursor might try to communicate with the MCP server
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

// Create logs directory if it doesn't exist
const logDir = path.join(process.cwd(), 'logs');
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

const logFile = path.join(logDir, `cursor-simulation-${Date.now()}.log`);
const logger = fs.createWriteStream(logFile, { flags: 'a' });

function log(msg) {
  const timestamp = new Date().toISOString();
  const message = `[${timestamp}] ${msg}`;
  console.log(message);
  logger.write(message + '\n');
}

log('Starting Cursor MCP Simulation');

// Start the MCP server process
const serverProcess = spawn('node', ['dist/index.js'], {
  env: {
    ...process.env,
    AITABLE_API_KEY: 'REMOVED_TOKEN',
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
  
  try {
    // Sometimes multiple responses might be in one data chunk
    const lines = text.trim().split('\n');
    for (const line of lines) {
      if (!line) continue;
      
      try {
        const response = JSON.parse(line);
        log(`Got response: ${JSON.stringify(response, null, 2)}`);
        
        if (response.id === 'init') {
          log('✅ Got response to initialize request');
          
          // Send initialized notification
          sendInitializedNotification();
          
          // Try tools list next
          setTimeout(() => {
            sendToolsListRequest();
          }, 1000);
        }
        
        if (response.id === 'tools-list') {
          log('✅ Got response to tools list request');
          
          // Try tool execute next
          setTimeout(() => {
            sendToolExecuteRequest();
          }, 1000);
        }
        
        // Check for tool-execute responses with different indices
        if (response.id && response.id.startsWith('tool-execute-')) {
          const index = parseInt(response.id.split('-')[2]);
          log(`✅ Got response to tool execute request with method ${index}`);
          
          // If the response doesn't have an error, we found the right method!
          if (!response.error) {
            log(`🎉 Found working method: ${['tools/execute', 'mcp/tools/execute', 'tooling/execute_tool', 'mcp/tooling/execute_tool'][index]}`);
            log('Test completed successfully!');
            
            // Exit with success
            setTimeout(() => {
              serverProcess.kill();
              process.exit(0);
            }, 1000);
          }
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
  
  // First, send initialize request
  const initializeRequest = {
    jsonrpc: '2.0',
    id: 'init',
    method: 'initialize',
    params: {
      protocolVersion: '0.1.0',
      clientInfo: {
        name: 'Cursor Simulation',
        version: '1.0.0'
      },
      capabilities: {
        tools: {},
        resources: {}
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

// Function to send tools list request
function sendToolsListRequest() {
  log('Sending tools list request...');
  
  // Try several method formats
  const methods = [
    'tools/list',
    'mcp/tools/list',
    'tooling/list_tools',
    'mcp/tooling/list_tools'
  ];
  
  const method = methods[0]; // Try the first one
  
  const toolsListRequest = {
    jsonrpc: '2.0',
    id: 'tools-list',
    method: method,
    params: {}
  };
  
  log(`Using method: ${method}`);
  serverProcess.stdin.write(JSON.stringify(toolsListRequest) + '\n');
}

// Function to send tool execute request
function sendToolExecuteRequest() {
  log('Sending tool execute request...');
  
  // Try several method formats
  const methods = [
    'tools/execute',
    'mcp/tools/execute',
    'tooling/execute_tool',
    'mcp/tooling/execute_tool'
  ];
  
  // Try testing each method one at a time
  tryMethod(0);
  
  function tryMethod(index) {
    if (index >= methods.length) {
      log('❌ All method formats failed');
      return;
    }
    
    const method = methods[index];
    log(`Trying method: ${method}`);
    
    const toolExecuteRequest = {
      jsonrpc: '2.0',
      id: `tool-execute-${index}`,
      method: method,
      params: {
        name: 'list_bases',
        input: {}
      }
    };
    
    serverProcess.stdin.write(JSON.stringify(toolExecuteRequest) + '\n');
    
    // Set a timeout to try the next method if we don't get a response
    setTimeout(() => {
      tryMethod(index + 1);
    }, 1000);
  }
}

// Set a timeout
setTimeout(() => {
  log('❌ Test timed out');
  serverProcess.kill();
  process.exit(1);
}, 30000); 