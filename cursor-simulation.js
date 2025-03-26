#!/usr/bin/env node

// This script simulates how Cursor might interact with the MCP server
// It spawns the server and communicates with it using the JSON-RPC protocol

import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import readline from 'readline';

// Create a log file
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

log('Starting Cursor MCP simulation');

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
  
  // When we see the ready message, start the simulation
  if (text.includes('READY')) {
    startSimulation();
  }
});

// Create readline interface for interactive testing
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Process stdout from server (JSON-RPC responses)
serverProcess.stdout.on('data', (data) => {
  const text = data.toString();
  log(`STDOUT: ${text.trim()}`);
  
  try {
    // Process each line (in case multiple responses)
    const lines = text.trim().split('\n');
    for (const line of lines) {
      if (!line) continue;
      
      try {
        const response = JSON.parse(line);
        log(`Parsed response: ${JSON.stringify(response, null, 2)}`);
      } catch (err) {
        log(`Error parsing JSON: ${err.message}`);
      }
    }
  } catch (err) {
    log(`Error processing stdout: ${err.message}`);
  }
});

// Function to send hello
function sendHello() {
  const hello = {
    jsonrpc: '2.0',
    id: 'hello',
    method: 'hello',
    params: {
      version: '0.1.0',
      description: 'Cursor MCP Simulation'
    }
  };
  
  log(`Sending hello: ${JSON.stringify(hello)}`);
  serverProcess.stdin.write(JSON.stringify(hello) + '\n');
}

// Function to send list_bases request
function sendListBases() {
  const request = {
    jsonrpc: '2.0',
    id: 'list-bases',
    method: 'mcp/tool',
    params: {
      name: 'list_bases',
      input: {}
    }
  };
  
  log(`Sending list_bases: ${JSON.stringify(request)}`);
  serverProcess.stdin.write(JSON.stringify(request) + '\n');
}

// Function to send list_tables request
function sendListTables() {
  const request = {
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
  
  log(`Sending list_tables: ${JSON.stringify(request)}`);
  serverProcess.stdin.write(JSON.stringify(request) + '\n');
}

// Start the simulation
function startSimulation() {
  log('Starting MCP simulation sequence');
  
  // First send hello
  setTimeout(() => {
    sendHello();
    
    // Then list bases
    setTimeout(() => {
      sendListBases();
      
      // Then list tables
      setTimeout(() => {
        sendListTables();
        
        // Then switch to interactive mode
        log('\nEntering interactive mode:');
        log('Type "exit" to quit');
        log('Type "list_bases" to send list_bases request');
        log('Type "list_tables" to send list_tables request');
        log('Type any other text to send as raw JSON-RPC');
        
        promptUser();
      }, 1000);
    }, 1000);
  }, 1000);
}

// Interactive prompt
function promptUser() {
  rl.question('> ', (input) => {
    if (input.trim() === 'exit') {
      log('Exiting...');
      serverProcess.kill();
      rl.close();
      process.exit(0);
    } else if (input.trim() === 'list_bases') {
      sendListBases();
      promptUser();
    } else if (input.trim() === 'list_tables') {
      sendListTables();
      promptUser();
    } else {
      // Try to send as raw JSON-RPC
      try {
        log(`Sending raw input: ${input}`);
        serverProcess.stdin.write(input + '\n');
      } catch (err) {
        log(`Error sending input: ${err.message}`);
      }
      promptUser();
    }
  });
}

// Set a timeout to prevent hanging
setTimeout(() => {
  log('Timeout reached, killing server...');
  serverProcess.kill();
  rl.close();
  process.exit(1);
}, 60000); 