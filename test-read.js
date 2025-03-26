import 'dotenv/config';
import fetch from 'node-fetch';

// Get API key from environment
const apiKey = process.env.AITABLE_API_KEY;

if (!apiKey) {
  console.error('Error: AITABLE_API_KEY environment variable is required');
  process.exit(1);
}

console.log(`Using API Key: ${apiKey.substring(0, 5)}...${apiKey.substring(apiKey.length - 3)}`);

// Helper function to display results
const displayResults = (name, data) => {
  console.log(`\n----- ${name} -----`);
  console.log(JSON.stringify(data, null, 2));
  console.log('-'.repeat(50));
};

async function testAITableAPI() {
  try {
    // Test direct API access first
    console.log('Testing direct API access to AITable...');
    
    // Get spaces (according to documentation)
    const spacesResponse = await fetch('https://aitable.ai/fusion/v1/spaces', {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (!spacesResponse.ok) {
      console.error(`Spaces API test failed with status: ${spacesResponse.status}`);
      const text = await spacesResponse.text();
      console.error('Response text:', text.substring(0, 500) + '...');
      throw new Error(`API request failed with status ${spacesResponse.status}`);
    }
    
    const spacesData = await spacesResponse.json();
    displayResults('Spaces API Result', spacesData);
    
    // If we have spaces, try to get datasheets for the first space
    if (spacesData.success && spacesData.data && spacesData.data.spaces && spacesData.data.spaces.length > 0) {
      const spaceId = spacesData.data.spaces[0].id;
      console.log(`Using Space ID: ${spaceId}`);
      
      // Get nodes/datasheets in this space
      const nodesResponse = await fetch(`https://aitable.ai/fusion/v1/spaces/${spaceId}/nodes?type=Datasheet`, {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (!nodesResponse.ok) {
        console.error(`Nodes API test failed with status: ${nodesResponse.status}`);
        const text = await nodesResponse.text();
        console.error('Response text:', text.substring(0, 500) + '...');
        throw new Error(`API request failed with status ${nodesResponse.status}`);
      }
      
      const nodesData = await nodesResponse.json();
      displayResults('Nodes/Datasheets API Result', nodesData);
      
      // If we have datasheets, try to get records from the first one
      if (nodesData.success && nodesData.data && nodesData.data.nodes && nodesData.data.nodes.length > 0) {
        // Find the first datasheet node
        const datasheetNode = nodesData.data.nodes.find(node => node.type === 'Datasheet');
        
        if (datasheetNode) {
          const datasheetId = datasheetNode.id;
          console.log(`Using Datasheet ID: ${datasheetId}`);
          
          // Get records from this datasheet
          const recordsResponse = await fetch(`https://aitable.ai/fusion/v1/datasheets/${datasheetId}/records`, {
            headers: {
              'Authorization': `Bearer ${apiKey}`,
              'Content-Type': 'application/json'
            }
          });
          
          if (!recordsResponse.ok) {
            console.error(`Records API test failed with status: ${recordsResponse.status}`);
            const text = await recordsResponse.text();
            console.error('Response text:', text.substring(0, 500) + '...');
            throw new Error(`API request failed with status ${recordsResponse.status}`);
          }
          
          const recordsData = await recordsResponse.json();
          displayResults('Records API Result', recordsData);
          
          // Get fields from this datasheet
          const fieldsResponse = await fetch(`https://aitable.ai/fusion/v1/datasheets/${datasheetId}/fields`, {
            headers: {
              'Authorization': `Bearer ${apiKey}`,
              'Content-Type': 'application/json'
            }
          });
          
          if (!fieldsResponse.ok) {
            console.error(`Fields API test failed with status: ${fieldsResponse.status}`);
            const text = await fieldsResponse.text();
            console.error('Response text:', text.substring(0, 500) + '...');
            throw new Error(`API request failed with status ${fieldsResponse.status}`);
          }
          
          const fieldsData = await fieldsResponse.json();
          displayResults('Fields API Result', fieldsData);
          
          // Get views from this datasheet
          const viewsResponse = await fetch(`https://aitable.ai/fusion/v1/datasheets/${datasheetId}/views`, {
            headers: {
              'Authorization': `Bearer ${apiKey}`,
              'Content-Type': 'application/json'
            }
          });
          
          if (!viewsResponse.ok) {
            console.error(`Views API test failed with status: ${viewsResponse.status}`);
            const text = await viewsResponse.text();
            console.error('Response text:', text.substring(0, 500) + '...');
            throw new Error(`API request failed with status ${viewsResponse.status}`);
          }
          
          const viewsData = await viewsResponse.json();
          displayResults('Views API Result', viewsData);
        } else {
          console.log('No datasheets found in the nodes list. Cannot test datasheet-related functions.');
        }
      } else {
        console.log('No nodes found in this space. Cannot test datasheet-related functions.');
      }
    } else {
      console.log('No spaces found. Cannot test further functions.');
    }
    
  } catch (error) {
    console.error('Error testing AITable API:', error);
  }
}

// Run the tests
testAITableAPI(); 