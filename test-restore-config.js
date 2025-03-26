#!/usr/bin/env node

// Script to restore the original Cursor MCP configuration with sequential-thinking server
import fs from 'fs';
import path from 'path';
import os from 'os';

// Set up the paths
const homeDir = os.homedir();
const cursorConfigDir = path.join(homeDir, '.cursor');
const mcpConfigFile = path.join(cursorConfigDir, 'mcp.json');

// Get the current working directory
const cwd = process.cwd();
const scriptPath = path.join(cwd, 'dist', 'index.js');

console.log('Restoring Cursor MCP configuration...');

// Create the complete configuration 
const fullConfig = {
  mcpServers: {
    "sequential-thinking": {
      "command": "npx",
      "args": [
        "-y",
        "@modelcontextprotocol/server-sequential-thinking"
      ]
    },
    "aitable": {
      "command": "node",
      "args": [
        scriptPath
      ],
      "env": {
        "AITABLE_API_KEY": "usk3Yk0DwQRo5BWrNNCAubm",
        "SPACE": "spc12q5HY4ay5"
      },
      "timeout": {
        "startup": 10000,
        "response": 30000
      }
    }
  }
};

// Serialize to JSON with pretty formatting
const configJson = JSON.stringify(fullConfig, null, 2);

// Write to stdout for debugging/review
console.log('\nRestored configuration with both servers:');
console.log(configJson);

// Create the cursor directory if it doesn't exist
if (!fs.existsSync(cursorConfigDir)) {
  fs.mkdirSync(cursorConfigDir, { recursive: true });
}

// Write the configuration
fs.writeFileSync(mcpConfigFile, configJson, 'utf8');
console.log(`\nConfiguration written to: ${mcpConfigFile}`);
console.log('You need to restart Cursor for the changes to take effect.');
console.log('\nBoth the sequential-thinking server and AITable server should now be available.'); 