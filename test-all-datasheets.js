import 'dotenv/config';
import { AITableService } from './dist/aitableService.js';

// Get API key and space from environment
const apiKey = process.env.AITABLE_API_KEY;
const defaultSpaceId = process.env.SPACE;

if (!apiKey) {
  console.error('Error: AITABLE_API_KEY environment variable is required');
  process.exit(1);
}

if (!defaultSpaceId) {
  console.error('Error: SPACE environment variable is required');
  process.exit(1);
}

console.log(`Using API Key: ${apiKey.substring(0, 5)}...${apiKey.substring(apiKey.length - 3)}`);
console.log(`Using Space ID: ${defaultSpaceId}`);

// Helper function to display results
const displayResults = (name, data) => {
  console.log(`\n----- ${name} -----`);
  console.log(JSON.stringify(data, null, 2));
  console.log('-'.repeat(50));
};

async function testGetAllDatasheets() {
  try {
    console.log('Testing the getAllDatasheets method...');
    
    // Create the AITableService instance
    const aitableService = new AITableService(apiKey);
    
    // Use our new method
    const datasheets = await aitableService.getAllDatasheets(defaultSpaceId);
    
    // Display the results
    console.log(`\nFound ${datasheets.length} datasheets in space ${defaultSpaceId}:`);
    datasheets.forEach((ds, index) => {
      console.log(`${index + 1}. ${ds.path} (ID: ${ds.id})`);
    });
    
    console.log('\n✅ Test completed successfully');
    
  } catch (error) {
    console.error('Error testing getAllDatasheets:', error);
  }
}

// Run the test
testGetAllDatasheets(); 