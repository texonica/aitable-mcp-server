#!/usr/bin/env node

// Script to check the MCP SDK version installed in the project
import fs from 'fs';
import path from 'path';

// Try to read package.json
try {
  const packageJsonPath = path.join(process.cwd(), 'package.json');
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  
  console.log('Checking MCP SDK version:');
  
  // Display MCP SDK version information
  const mcpSdkVersion = packageJson.dependencies['@modelcontextprotocol/sdk'] || 
                        packageJson.devDependencies['@modelcontextprotocol/sdk'];
                        
  if (mcpSdkVersion) {
    console.log(`MCP SDK version: ${mcpSdkVersion}`);
  } else {
    console.log('MCP SDK not found in package.json dependencies');
  }
  
  // Try to get the actual installed version
  try {
    const mcpPackageJsonPath = path.join(process.cwd(), 'node_modules', '@modelcontextprotocol', 'sdk', 'package.json');
    const mcpPackageJson = JSON.parse(fs.readFileSync(mcpPackageJsonPath, 'utf8'));
    
    console.log(`Installed MCP SDK version: ${mcpPackageJson.version}`);
    console.log(`Description: ${mcpPackageJson.description}`);
  } catch (err) {
    console.error('Unable to read installed MCP SDK version:', err.message);
  }
  
  // Log other relevant dependencies
  console.log('\nRelevant dependencies:');
  const relevantDeps = ['node-fetch', 'zod', 'typescript'];
  
  for (const dep of relevantDeps) {
    const version = packageJson.dependencies[dep] || packageJson.devDependencies[dep] || 'not found';
    console.log(`${dep}: ${version}`);
  }
  
} catch (err) {
  console.error('Error reading package.json:', err.message);
} 