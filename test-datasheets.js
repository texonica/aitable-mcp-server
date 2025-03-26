import 'dotenv/config';
import fetch from 'node-fetch';

// Get API key and space from environment
const apiKey = process.env.AITABLE_API_KEY;
const defaultSpaceId = process.env.SPACE;

if (!apiKey) {
  console.error('Error: AITABLE_API_KEY environment variable is required');
  process.exit(1);
}

console.log(`Using API Key: ${apiKey.substring(0, 5)}...${apiKey.substring(apiKey.length - 3)}`);
if (defaultSpaceId) {
  console.log(`Using default Space ID: ${defaultSpaceId}`);
}

// Track all found datasheets
const allDatasheets = [];

// Helper function to display results
const displayResults = (name, data) => {
  console.log(`\n----- ${name} -----`);
  console.log(JSON.stringify(data, null, 2));
  console.log('-'.repeat(50));
};

// Helper function to perform API requests
async function fetchFromAPI(endpoint) {
  const response = await fetch(`https://aitable.ai/fusion/v1/${endpoint}`, {
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    }
  });
  
  if (!response.ok) {
    console.error(`API request failed with status: ${response.status}`);
    const text = await response.text();
    console.error('Response text:', text.substring(0, 500));
    throw new Error(`API request failed with status ${response.status}`);
  }
  
  return response.json();
}

// Recursive function to process a folder node and find datasheets
async function processNode(spaceId, nodeId, nodePath = '') {
  try {
    // Get node details
    const nodeDetails = await fetchFromAPI(`spaces/${spaceId}/nodes/${nodeId}`);
    
    if (!nodeDetails.success || !nodeDetails.data) {
      console.error(`Error fetching node details for ${nodeId}`);
      return;
    }
    
    const node = nodeDetails.data;
    const currentPath = nodePath ? `${nodePath} > ${node.name}` : node.name;
    
    if (node.type === 'Datasheet') {
      console.log(`Found datasheet: ${currentPath} (ID: ${node.id})`);
      allDatasheets.push({
        id: node.id,
        name: node.name,
        path: currentPath,
        spaceId: spaceId
      });
      return;
    }
    
    // If it's a folder and has children, process each child
    if (node.type === 'Folder' && node.children && node.children.length > 0) {
      console.log(`Processing folder: ${currentPath} (${node.children.length} children)`);
      
      for (const childNode of node.children) {
        await processNode(spaceId, childNode.id, currentPath);
      }
    }
  } catch (error) {
    console.error(`Error processing node ${nodeId}:`, error.message);
  }
}

// Process all nodes in a space to find datasheets
async function findDatasheetsInSpace(spaceId, spaceName) {
  try {
    console.log(`\n===== Processing Space: ${spaceName} (ID: ${spaceId}) =====`);
    
    // Get top-level nodes in the space
    const nodesData = await fetchFromAPI(`spaces/${spaceId}/nodes`);
    
    if (!nodesData.success || !nodesData.data || !nodesData.data.nodes) {
      console.error(`No nodes found in space ${spaceId}`);
      return;
    }
    
    // First, directly check for datasheets at the root level
    const rootDatasheets = nodesData.data.nodes.filter(node => node.type === 'Datasheet');
    for (const datasheet of rootDatasheets) {
      console.log(`Found root datasheet: ${datasheet.name} (ID: ${datasheet.id})`);
      allDatasheets.push({
        id: datasheet.id,
        name: datasheet.name,
        path: datasheet.name,
        spaceId: spaceId
      });
    }
    
    // Then process all folders to find nested datasheets
    const folders = nodesData.data.nodes.filter(node => node.type === 'Folder');
    console.log(`Processing ${folders.length} folders in space ${spaceName}`);
    
    for (const folder of folders) {
      await processNode(spaceId, folder.id, '');
    }
    
  } catch (error) {
    console.error(`Error finding datasheets in space ${spaceId}:`, error.message);
  }
}

async function testGetDatasheets() {
  try {
    console.log('Testing AITable API access for datasheets...');
    
    // If default space is provided, just use that
    if (defaultSpaceId) {
      const spacesData = await fetchFromAPI('spaces');
      const spaceName = spacesData.data.spaces.find(space => space.id === defaultSpaceId)?.name || 'Default Space';
      
      await findDatasheetsInSpace(defaultSpaceId, spaceName);
    } else {
      // Otherwise, get all spaces and check each one
      const spacesData = await fetchFromAPI('spaces');
      displayResults('Spaces Found', spacesData);
      
      // Check if we have spaces
      if (!spacesData.success || !spacesData.data || !spacesData.data.spaces || spacesData.data.spaces.length === 0) {
        console.log('No spaces found. Cannot retrieve datasheets.');
        return;
      }
      
      // Process each space
      for (const space of spacesData.data.spaces) {
        await findDatasheetsInSpace(space.id, space.name);
      }
    }
    
    // Print summary of all datasheets found
    console.log('\n===== All Datasheets Found =====');
    console.log(`Total: ${allDatasheets.length} datasheets`);
    allDatasheets.forEach((ds, index) => {
      console.log(`${index + 1}. ${ds.path} (ID: ${ds.id})`);
    });
    
    console.log('\n✅ AITable datasheet retrieval test completed');
    
  } catch (error) {
    console.error('Error testing AITable API:', error);
  }
}

// Run the test
testGetDatasheets(); 