#!/usr/bin/env node

// Test script that specifically tests tool execution with the AITable MCP server
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

// Create logs directory if it doesn't exist
const logDir = path.join(process.cwd(), 'logs');
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

const logFile = path.join(logDir, `cursor-execute-test-${Date.now()}.log`);
const logger = fs.createWriteStream(logFile, { flags: 'a' });

function log(msg) {
  const timestamp = new Date().toISOString();
  const message = `[${timestamp}] ${msg}`;
  console.log(message);
  logger.write(message + '\n');
}

log('Starting Cursor MCP Execute Test');

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
          
          // Try tool execute
          setTimeout(() => {
            testToolExecute();
          }, 1000);
        }
        
        // Check for successful tool execution
        if (response.id && response.id.startsWith('execute-test-')) {
          const index = parseInt(response.id.split('-')[2]);
          
          if (response.error) {
            log(`❌ Tool execution failed for method ${index}: ${JSON.stringify(response.error)}`);
          } else {
            log('✅ Tool execution succeeded!');
            log(`Tool result: ${JSON.stringify(response.result, null, 2)}`);
            
            // Clean exit
            setTimeout(() => {
              log('🎉 Test completed successfully!');
              serverProcess.kill();
              process.exit(0);
            }, 500);
            
            // Stop trying more methods
            return;
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
        name: 'Cursor Execution Test',
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

// Test tool execution using the method that Cursor would use
function testToolExecute() {
  log('Testing tool execution...');
  
  // Try different method formats
  tryMethod(0);
  
  function tryMethod(index) {
    if (index >= 2) {
      log('❌ All method formats failed');
      return;
    }
    
    const methodName = index === 0 ? 'tools/execute' : 'tools/call';
    log(`Trying method: ${methodName}`);
    
    const executeRequest = {
      jsonrpc: '2.0',
      id: `execute-test-${index}`,
      method: methodName,
      params: {
        name: 'list_bases',
        input: {},
        arguments: {}  // Include both input and arguments
      }
    };
    
    serverProcess.stdin.write(JSON.stringify(executeRequest) + '\n');
    
    // Set a timeout to try the next method if we don't get a successful response
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