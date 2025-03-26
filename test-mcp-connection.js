#!/usr/bin/env node

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';

// Get the directory of the current module
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Setup logging
const logsDir = join(__dirname, 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

const logFile = join(logsDir, `mcp-connection-test-${new Date().toISOString().replace(/:/g, '-')}.log`);
const log = fs.createWriteStream(logFile, { flags: 'a' });

function logMessage(message) {
  const timestamp = new Date().toISOString();
  const formattedMsg = `[${timestamp}] ${message}`;
  console.log(formattedMsg);
  log.write(formattedMsg + '\n');
}

logMessage('Starting MCP connection test');

// Start the server process
const serverProcess = spawn('node', ['dist/index.js'], {
  env: {
    ...process.env,
    AITABLE_API_KEY: 'usk3Yk0DwQRo5BWrNNCAubm',
    SPACE: 'spc12q5HY4ay5',
    LOG_LEVEL: 'debug',
    DEBUG: 'true'
  },
  stdio: ['pipe', 'pipe', 'pipe']
});

// Track process state
let isServerReady = false;
let messagesSent = 0;
let responsesReceived = 0;
const MAX_TEST_MESSAGES = 3;

// Log process events
serverProcess.on('error', (err) => {
  logMessage(`Server process error: ${err.message}`);
});

serverProcess.on('exit', (code, signal) => {
  logMessage(`Server process exited with code ${code} and signal ${signal}`);
});

// Capture stdout
serverProcess.stdout.on('data', (data) => {
  const output = data.toString();
  logMessage(`Server stdout: ${output.trim()}`);
  
  // Check for MCP responses
  try {
    const lines = output.split('\n').filter(line => line.trim());
    for (const line of lines) {
      if (line.includes('"id":')) {
        responsesReceived++;
        logMessage(`Received MCP response #${responsesReceived}`);
      }
    }
    
    // If we've received responses to all our test messages, exit successfully
    if (responsesReceived >= MAX_TEST_MESSAGES) {
      logMessage('✅ Connection test SUCCESSFUL - received responses to all test messages');
      serverProcess.kill();
      process.exit(0);
    }
  } catch (err) {
    logMessage(`Error parsing server output: ${err.message}`);
  }
});

// Capture stderr
serverProcess.stderr.on('data', (data) => {
  const output = data.toString();
  logMessage(`Server stderr: ${output.trim()}`);
  
  // Check if server is ready
  if (output.includes('AITable MCP Server Ready')) {
    isServerReady = true;
    logMessage('Server is ready. Sending test MCP messages...');
    sendTestMessages();
  }
});

// Function to send test MCP messages
function sendTestMessages() {
  // Send a list_bases request
  const listBasesRequest = {
    jsonrpc: '2.0',
    id: 'test-1',
    method: 'mcp/tool',
    params: {
      name: 'list_bases',
      input: {}
    }
  };
  
  // Check if stdout is writable and send the message
  if (serverProcess.stdin.writable) {
    serverProcess.stdin.write(JSON.stringify(listBasesRequest) + '\n');
    messagesSent++;
    logMessage(`Sent test message #${messagesSent}: list_bases`);
    
    // Send subsequent test messages with a delay
    setTimeout(() => {
      if (messagesSent < MAX_TEST_MESSAGES) {
        const listTablesRequest = {
          jsonrpc: '2.0',
          id: 'test-2',
          method: 'mcp/tool',
          params: {
            name: 'list_tables',
            input: {
              baseId: 'spc12q5HY4ay5'
            }
          }
        };
        
        serverProcess.stdin.write(JSON.stringify(listTablesRequest) + '\n');
        messagesSent++;
        logMessage(`Sent test message #${messagesSent}: list_tables`);
        
        // Send one more test message
        setTimeout(() => {
          if (messagesSent < MAX_TEST_MESSAGES) {
            const describeTableRequest = {
              jsonrpc: '2.0',
              id: 'test-3',
              method: 'mcp/tool',
              params: {
                name: 'describe_table',
                input: {
                  baseId: 'spc12q5HY4ay5',
                  tableId: 'dstq4onAEtjMleaeCm'
                }
              }
            };
            
            serverProcess.stdin.write(JSON.stringify(describeTableRequest) + '\n');
            messagesSent++;
            logMessage(`Sent test message #${messagesSent}: describe_table`);
          }
        }, 1000);
      }
    }, 1000);
  } else {
    logMessage('ERROR: Server stdin is not writable');
  }
}

// Set a timeout to exit if the test doesn't complete
const testTimeout = setTimeout(() => {
  logMessage('❌ Test FAILED: Timeout exceeded. Not all messages received responses.');
  serverProcess.kill();
  process.exit(1);
}, 30000);

// Handle process termination
process.on('SIGINT', () => {
  logMessage('Test interrupted by user');
  clearTimeout(testTimeout);
  serverProcess.kill();
  process.exit(1);
}); 