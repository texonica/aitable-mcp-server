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

async function testGetDatasheetRecords() {
  try {
    console.log('Testing access to datasheet records...');
    
    // Step 1: Get datasheets to find the correct IDs
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
    
    // Get the Projects datasheet or the first available one
    const projectsDatasheet = datasheets.find(ds => ds.name === 'Projects') || datasheets[0];
    
    if (!projectsDatasheet) {
      console.error('ERROR: No datasheets found in this space.');
      return;
    }
    
    console.log(`\nUsing datasheet: ${projectsDatasheet.name} (ID: ${projectsDatasheet.id})`);
    
    // Step 2: Get records from the datasheet using its ID
    console.log(`\nStep 2: Getting records from datasheet...`);
    const recordsResponse = await fetchFromAPI(`/datasheets/${projectsDatasheet.id}/records?pageSize=10`);
    
    if (!recordsResponse.success) {
      console.error('Failed to get records:', recordsResponse.message);
      return;
    }
    
    const records = recordsResponse.data.records.map(record => ({
      id: record.recordId,
      fields: record.fields
    }));
    
    // Display the records
    console.log(`\nRetrieved ${records.length} records from "${projectsDatasheet.name}" datasheet:`);
    displayResults(`${projectsDatasheet.name} Records`, records);
    
    // Step 3: Get fields for the datasheet
    console.log(`\nStep 3: Getting fields from datasheet...`);
    const fieldsResponse = await fetchFromAPI(`/datasheets/${projectsDatasheet.id}/fields`);
    
    if (!fieldsResponse.success) {
      console.error('Failed to get fields:', fieldsResponse.message);
      return;
    }
    
    // Display the fields
    console.log(`\nRetrieved ${fieldsResponse.data.fields.length} fields from "${projectsDatasheet.name}" datasheet:`);
    displayResults(`${projectsDatasheet.name} Fields`, fieldsResponse.data.fields);
    
    console.log('\n✅ Test completed successfully');
    
  } catch (error) {
    console.error('Error testing datasheet access:', error);
  }
}

// Run the test
testGetDatasheetRecords(); 