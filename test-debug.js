#!/usr/bin/env node

// Test-debug.js - Direct API test to debug AITable connection issues
import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import fetch from 'node-fetch';

// Create logs directory if it doesn't exist
const logDir = path.join(process.cwd(), 'logs');
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

// Create debug log file
const timestamp = new Date().toISOString().replace(/:/g, '-');
const logFile = path.join(logDir, `aitable-debug-${timestamp}.log`);

// Helper to log to console and file
function log(message, obj) {
  const timestamp = new Date().toISOString();
  let msg = `[${timestamp}] ${message}`;
  
  if (obj !== undefined) {
    let objStr;
    if (typeof obj === 'string') {
      objStr = obj;
    } else {
      try {
        objStr = JSON.stringify(obj, null, 2);
      } catch (err) {
        objStr = `[Error stringifying object: ${err.message}]`;
      }
    }
    msg += `\n${objStr}`;
  }
  
  console.log(msg);
  fs.appendFileSync(logFile, msg + '\n');
}

async function testDirectApiAccess() {
  log('Starting direct AITable API test');
  
  // Check for API key
  const apiKey = process.env.AITABLE_API_KEY;
  log(`API key defined: ${apiKey ? 'YES' : 'NO'}`);
  
  if (!apiKey) {
    log('ERROR: API key is not defined. Please set AITABLE_API_KEY in .env file');
    return;
  }
  
  // Test space/base listing
  log('Testing API connection to list bases/spaces...');
  
  try {
    // Try AITable spaces endpoint
    const spacesUrl = 'https://aitable.ai/fusion/v1/spaces';
    log(`Making request to: ${spacesUrl}`);
    
    const headers = {
      'Authorization': `Bearer ${apiKey}`,
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'User-Agent': 'aitable-mcp-debug/0.1.0'
    };
    
    log('Request headers:', headers);
    
    const response = await fetch(spacesUrl, { headers });
    log(`Response status: ${response.status} ${response.statusText}`);
    log('Response headers:', Object.fromEntries([...response.headers.entries()]));
    
    const contentType = response.headers.get('content-type');
    log(`Content-Type: ${contentType}`);
    
    let body;
    if (contentType && contentType.includes('application/json')) {
      body = await response.json();
    } else {
      const text = await response.text();
      log(`Raw response (first 1000 chars): ${text.substring(0, 1000)}`);
      try {
        body = JSON.parse(text);
      } catch (err) {
        log(`ERROR: Failed to parse response as JSON: ${err.message}`);
        return;
      }
    }
    
    log('Response body:', body);
    
    if (response.ok) {
      log('SUCCESS: API connection successful');
      
      // If spaces are returned, try getting a datasheet
      if (body.data && body.data.spaces && body.data.spaces.length > 0) {
        const firstSpace = body.data.spaces[0];
        log(`Found space: ${firstSpace.name} (${firstSpace.id})`);
        
        // Try to get datasheets for this space
        await testGetDatasheets(firstSpace.id, apiKey);
      }
    } else {
      log('ERROR: API request failed', body);
    }
  } catch (error) {
    log('ERROR: Exception during API request', error);
  }
}

async function testGetDatasheets(spaceId, apiKey) {
  log(`Testing retrieval of datasheets for space ${spaceId}...`);
  
  try {
    const url = `https://aitable.ai/fusion/v1/spaces/${spaceId}/nodes?type=Datasheet`;
    log(`Making request to: ${url}`);
    
    const headers = {
      'Authorization': `Bearer ${apiKey}`,
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'User-Agent': 'aitable-mcp-debug/0.1.0'
    };
    
    const response = await fetch(url, { headers });
    log(`Response status: ${response.status} ${response.statusText}`);
    
    const body = await response.json();
    log('Response body (truncated):', {
      success: body.success,
      code: body.code,
      message: body.message,
      dataCount: body.data?.nodes?.length
    });
    
    if (response.ok && body.data && body.data.nodes) {
      log(`SUCCESS: Found ${body.data.nodes.length} nodes`);
      const datasheets = body.data.nodes.filter(node => node.type === 'Datasheet');
      log(`Datasheets: ${datasheets.length}`);
      
      for (const ds of datasheets.slice(0, 3)) { // Show first 3 datasheets only
        log(`Datasheet: ${ds.name} (${ds.id})`);
      }
    } else {
      log('ERROR: Failed to get datasheets', body);
    }
  } catch (error) {
    log('ERROR: Exception during datasheet retrieval', error);
  }
}

// Run the test
testDirectApiAccess().then(() => {
  log('Test completed, see logs for details');
  log(`Log file: ${logFile}`);
}).catch(err => {
  log('Unhandled error during test', err);
}); 