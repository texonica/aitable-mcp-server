#!/usr/bin/env node

// Script to generate a sample Cursor MCP configuration file
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

console.log('Generating Cursor MCP configuration...');
console.log(`Working directory: ${cwd}`);
console.log(`Script path: ${scriptPath}`);

// Read existing configuration if it exists
let existingConfig = { mcpServers: {} };
try {
  if (fs.existsSync(mcpConfigFile)) {
    const existingConfigStr = fs.readFileSync(mcpConfigFile, 'utf8');
    existingConfig = JSON.parse(existingConfigStr);
    console.log('Found existing Cursor MCP configuration');
  }
} catch (error) {
  console.error(`Error reading existing config: ${error.message}`);
  console.log('Creating new configuration file');
}

// Create the configuration object and merge with existing
const updatedConfig = {
  ...existingConfig,
  mcpServers: {
    ...existingConfig.mcpServers,
    aitable: {
      command: 'node',
      args: [
        scriptPath
      ],
      env: {
        AITABLE_API_KEY: 'REMOVED_TOKEN',
        SPACE: 'spc12q5HY4ay5'
      },
      timeout: {
        startup: 10000,
        response: 30000
      }
    }
  }
};

// Serialize to JSON with pretty formatting
const configJson = JSON.stringify(updatedConfig, null, 2);

// Write to stdout for debugging/review
console.log('\nGenerated configuration:');
console.log(configJson);

// Write to file if requested
if (process.argv.includes('--write')) {
  try {
    // Create the cursor directory if it doesn't exist
    if (!fs.existsSync(cursorConfigDir)) {
      fs.mkdirSync(cursorConfigDir, { recursive: true });
    }
    
    // Write the configuration
    fs.writeFileSync(mcpConfigFile, configJson, 'utf8');
    console.log(`\nConfiguration written to: ${mcpConfigFile}`);
    console.log('You may need to restart Cursor for the changes to take effect.');
  } catch (error) {
    console.error(`\nError writing configuration: ${error.message}`);
    process.exit(1);
  }
} else {
  console.log('\nTo write this configuration to your Cursor settings, run:');
  console.log(`  node ${path.basename(import.meta.url.split('/').pop())} --write`);
}

console.log('\nAfter updating the config, please restart Cursor and try using the AITable MCP server.'); 