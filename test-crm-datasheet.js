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

async function testGetCRMDatasheet() {
  try {
    console.log('Testing access to CRM datasheet...');
    
    // Create the AITableService instance
    const aitableService = new AITableService(apiKey);
    
    // Step 1: Get all datasheets
    console.log('Step 1: Getting all datasheets...');
    const spaceId = defaultSpaceId;
    const datasheets = await aitableService.getAllDatasheets(spaceId);
    
    // Display summary of all datasheets
    console.log(`\nFound ${datasheets.length} datasheets in space ${spaceId}:`);
    datasheets.forEach((ds, index) => {
      console.log(`${index + 1}. ${ds.path} (ID: ${ds.id})`);
    });
    
    // Step 2: Find the CRM datasheet
    console.log('\nStep 2: Looking for CRM datasheet...');
    const crmDatasheet = datasheets.find(ds => ds.name === 'CRM');
    
    if (!crmDatasheet) {
      console.error('ERROR: No datasheet named "CRM" was found.');
      console.log('Available datasheets:');
      datasheets.forEach(ds => console.log(` - ${ds.name}`));
      return;
    }
    
    console.log(`Found CRM datasheet with ID: ${crmDatasheet.id}`);
    
    // Step 3: Get records from the CRM datasheet
    console.log('\nStep 3: Getting records from CRM datasheet...');
    const records = await aitableService.listRecords(
      spaceId,  // baseId is the same as spaceId in AITable
      crmDatasheet.id,  // tableId is the datasheet ID
      { maxRecords: 10 }  // Optional: limit to 10 records
    );
    
    // Display the records
    console.log(`\nRetrieved ${records.length} records from CRM datasheet:`);
    displayResults('CRM Records', records);
    
    console.log('\n✅ Test completed successfully');
    
  } catch (error) {
    console.error('Error testing CRM datasheet access:', error);
  }
}

// Run the test
testGetCRMDatasheet(); 