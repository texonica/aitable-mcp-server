#!/usr/bin/env node

import { AITableService } from './dist/aitableService.js';

// Get default space ID from environment variables
const defaultSpaceId = process.env.SPACE || '';
const apiKey = process.env.AITABLE_API_KEY || '';

if (!apiKey) {
  console.error('ERROR: No API key found. Please set the AITABLE_API_KEY environment variable.');
  process.exit(1);
}

// Helper function to display results nicely
function displayResults(title, data) {
  console.log(`\n=== ${title} ===`);
  console.log(JSON.stringify(data, null, 2));
  console.log('='.repeat(40));
}

async function testGetDatasheetByName() {
  try {
    console.log('Testing getDatasheetRecordsByName method...');
    
    // Create the AITableService instance
    const aitableService = new AITableService(apiKey);
    
    // Get a list of datasheets first to see what's available
    console.log('Getting all available datasheets first...');
    const spaceId = defaultSpaceId;
    const datasheets = await aitableService.getAllDatasheets(spaceId);
    
    console.log(`\nFound ${datasheets.length} datasheets in space ${spaceId}:`);
    datasheets.forEach((ds, index) => {
      console.log(`${index + 1}. ${ds.name} (Path: ${ds.path})`);
    });
    
    // Test getting records directly by datasheet name
    const datasheetName = 'CRM'; // Try to get the CRM datasheet
    console.log(`\nTrying to get records from datasheet "${datasheetName}" directly by name...`);
    
    try {
      const records = await aitableService.getDatasheetRecordsByName(
        spaceId,
        datasheetName,
        { maxRecords: 10 }
      );
      
      console.log(`\nSuccess! Retrieved ${records.length} records from "${datasheetName}" datasheet:`);
      displayResults(`${datasheetName} Records`, records);
    } catch (error) {
      console.error(`\nFailed to get records from "${datasheetName}" datasheet:`, error.message);
      
      // Suggest some available datasheets to try instead
      console.log('\nAvailable datasheets you could try instead:');
      datasheets.slice(0, 5).forEach(ds => console.log(` - ${ds.name}`));
    }
    
    console.log('\n✅ Test completed');
    
  } catch (error) {
    console.error('Error testing datasheet by name access:', error);
  }
}

// Run the test
testGetDatasheetByName(); 