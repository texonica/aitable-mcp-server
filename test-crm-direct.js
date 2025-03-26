#!/usr/bin/env node

// Get API key and space ID from environment variables
const apiKey = process.env.AITABLE_API_KEY || '';
const defaultSpaceId = process.env.SPACE || '';

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

// Helper function to fetch from API
async function fetchFromAPI(endpoint, options = {}) {
  const url = `https://aitable.ai/fusion/v1${endpoint}`;
  console.log('Making API request to:', url);
  
  const response = await fetch(url, {
    ...options,
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'User-Agent': 'aitable-mcp-server/0.1.0',
      ...options.headers,
    },
  });
  
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`API request failed with status ${response.status}: ${text}`);
  }
  
  return response.json();
}

async function testGetCRMDatasheet() {
  try {
    console.log('Testing direct access to CRM datasheet...');
    
    // Step 1: Get all datasheets
    console.log('Step 1: Getting all datasheets...');
    const spaceId = defaultSpaceId;
    
    // Get nodes from the space
    const nodesResponse = await fetchFromAPI(`/spaces/${spaceId}/nodes`);
    
    if (!nodesResponse.success || !nodesResponse.data.nodes) {
      console.error('No nodes found in the space');
      return;
    }
    
    // Find all datasheets
    const datasheets = nodesResponse.data.nodes.filter(node => node.type === 'Datasheet');
    
    console.log(`\nFound ${datasheets.length} datasheets at root level in space ${spaceId}:`);
    datasheets.forEach((ds, index) => {
      console.log(`${index + 1}. ${ds.name} (ID: ${ds.id})`);
    });
    
    // Step 2: Find the CRM datasheet
    console.log('\nStep 2: Looking for CRM datasheet...');
    const crmDatasheet = datasheets.find(ds => ds.name === 'CRM');
    
    if (!crmDatasheet) {
      console.error('ERROR: No datasheet named "CRM" was found at the root level.');
      console.log('Available datasheets:');
      datasheets.forEach(ds => console.log(` - ${ds.name}`));
      return;
    }
    
    console.log(`Found CRM datasheet with ID: ${crmDatasheet.id}`);
    
    // Step 3: Get records from the CRM datasheet
    console.log('\nStep 3: Getting records from CRM datasheet...');
    const recordsResponse = await fetchFromAPI(`/datasheets/${crmDatasheet.id}/records?pageSize=10`);
    
    if (!recordsResponse.success) {
      console.error('Failed to get records from CRM datasheet:', recordsResponse.message);
      return;
    }
    
    const records = recordsResponse.data.records.map(record => ({
      id: record.recordId,
      fields: record.fields
    }));
    
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