import nodeFetch from 'node-fetch';
import dotenv from 'dotenv';
import fs from 'fs';
import { AITableService } from './dist/aitableService.js';

dotenv.config();

const apiKey = process.env.AITABLE_API_KEY || 'test-key';

if (!apiKey) {
  console.error('Error: AITABLE_API_KEY environment variable is not set');
  process.exit(1);
}

console.log(`Using API Key: ${apiKey.substring(0, 5)}...${apiKey.substring(apiKey.length - 3)}`);

// Create a custom mock fetch function
const mockFetch = async (url, options = {}) => {
  console.log('Mock fetch called with URL:', url);
  console.log('Request headers:', options.headers);
  
  // Special handling for text() method
  const createResponse = (data) => {
    const jsonData = typeof data === 'string' ? JSON.parse(data) : data;
    const stringData = typeof data === 'string' ? data : JSON.stringify(data);
    
    return {
      ok: true,
      status: 200,
      statusText: 'OK',
      headers: {
        get: (name) => name.toLowerCase() === 'content-type' ? 'application/json' : null
      },
      json: async () => jsonData,
      text: async () => stringData
    };
  };
  
  // Extract URL patterns
  const basePatternMatch = url.match(/\/v0\/meta\/bases\/([^\/]+)\/tables/);
  const recordsPatternMatch = url.match(/\/v0\/([^\/]+)\/([^\/]+)\/records/);
  const singleRecordPatternMatch = url.match(/\/v0\/([^\/]+)\/([^\/]+)\/([^\/\?]+)$/);
  
  // Mock responses based on the URL
  if (url.includes('/v0/meta/bases')) {
    if (basePatternMatch) {
      // Airtable-style table listing endpoint
      return createResponse({
        tables: [
          {
            id: 'dst123456',
            name: 'Test Datasheet',
            description: 'A test datasheet',
            primaryFieldId: 'fld123456',
            fields: [
              {
                id: 'fld123456',
                name: 'Name',
                type: 'text',
                description: 'Primary field',
                options: {}
              },
              {
                id: 'fld234567',
                name: 'Description',
                type: 'text',
                description: 'Description field',
                options: {}
              }
            ],
            views: [
              {
                id: 'viw123456',
                name: 'Grid View',
                type: 'grid'
              }
            ]
          }
        ]
      });
    } else {
      // Airtable-style base listing endpoint
      return createResponse({
        bases: [
          {
            id: 'spc123456',
            name: 'Test Space',
            permissionLevel: 'owner'
          }
        ]
      });
    }
  } else if (recordsPatternMatch) {
    // Airtable-style list records endpoint
    return createResponse({
      records: [
        {
          id: 'rec123456',
          fields: {
            'Name': 'Test Record 1',
            'Description': 'This is a test record'
          },
          createdTime: '2021-01-01T00:00:00.000Z'
        }
      ],
      offset: null
    });
  } else if (singleRecordPatternMatch) {
    // Airtable-style get single record endpoint
    return createResponse({
      id: 'rec123456',
      fields: {
        'Name': 'Test Record 1',
        'Description': 'This is a test record'
      },
      createdTime: '2021-01-01T00:00:00.000Z'
    });
  } else if (url.includes('/spaces') && !url.includes('/nodes')) {
    // AITable-style spaces listing endpoint
    return createResponse({
      success: true,
      code: 200,
      data: {
        spaces: [
          {
            id: 'spc123456',
            name: 'Test Space',
            isAdmin: true
          }
        ]
      },
      message: 'Success'
    });
  } else if (url.includes('/nodes')) {
    // Get datasheets in a space
    return createResponse({
      success: true,
      code: 200,
      data: {
        nodes: [
          {
            id: 'dst123456',
            name: 'Test Datasheet',
            type: 'Datasheet',
            icon: 'icon'
          }
        ]
      },
      message: 'Success'
    });
  } else if (url.includes('/fields')) {
    // Get fields for a datasheet
    return createResponse({
      success: true,
      code: 200,
      data: {
        fields: [
          {
            id: 'fld123456',
            name: 'Name',
            type: 'Text',
            property: {},
            editable: true,
            isPrimary: true,
            desc: 'Primary field'
          },
          {
            id: 'fld234567',
            name: 'Description',
            type: 'Text',
            property: {},
            editable: true,
            isPrimary: false,
            desc: 'Description field'
          }
        ]
      },
      message: 'Success'
    });
  } else if (url.includes('/views')) {
    // Get views for a datasheet
    return createResponse({
      success: true,
      code: 200,
      data: {
        views: [
          {
            id: 'viw123456',
            name: 'Grid View',
            type: 'Grid'
          }
        ]
      },
      message: 'Success'
    });
  } else if (url.includes('/records')) {
    // For AITable-style format
    if (url.includes('/records/') && options.method !== 'DELETE') {
      // Get a single record
      return createResponse({
        success: true,
        code: 200,
        data: {
          record: {
            recordId: 'rec123456',
            fields: {
              'Name': 'Test Record 1',
              'Description': 'This is a test record'
            },
            createdAt: 1612345678,
            updatedAt: 1623456789
          }
        },
        message: 'Success'
      });
    } else {
      // List records
      return createResponse({
        success: true,
        code: 200,
        data: {
          records: [
            {
              recordId: 'rec123456',
              fields: {
                'Name': 'Test Record 1',
                'Description': 'This is a test record'
              },
              createdAt: 1612345678,
              updatedAt: 1623456789
            }
          ],
          pageNum: 1,
          pageSize: 100
        },
        message: 'Success'
      });
    }
  } else {
    // Default response for unknown endpoints
    console.log(`Unhandled URL in mock: ${url}`);
    return createResponse({
      success: true,
      code: 200,
      data: {},
      message: 'Success'
    });
  }
};

// Helper function to display results in a readable format
function displayResults(label, data) {
  console.log(`\n=== ${label} ===`);
  console.log(JSON.stringify(data, null, 2));
  console.log('='.repeat(label.length + 8));
}

// Create a service instance with the mock fetch implementation
console.log('Creating AITableService with mock fetch implementation...');
const aitableService = new AITableService(apiKey, 'https://aitable.ai/fusion/v1', mockFetch);

async function testAITableService() {
  try {
    console.log('Testing AITableService with mock data...');
    
    // Test listBases (spaces)
    console.log('Fetching spaces (bases)...');
    const bases = await aitableService.listBases();
    displayResults('Spaces/Bases', bases);
    
    if (bases.bases.length === 0) {
      console.log('No spaces/bases found. Cannot test further functions.');
      return;
    }

    // Get the first space ID for further testing
    const spaceId = bases.bases[0].id;
    console.log(`Using Space ID: ${spaceId}`);

    // Test getBaseSchema (gets datasheets and their fields/views)
    console.log('Fetching schema for space...');
    const schema = await aitableService.getBaseSchema(spaceId);
    displayResults('Space Schema (Datasheets)', schema);

    if (schema.tables.length === 0) {
      console.log('No datasheets found in this space. Cannot test datasheet-related functions.');
      return;
    }

    // Get the first datasheet ID for further testing
    const datasheetId = schema.tables[0].id;
    console.log(`Using Datasheet ID: ${datasheetId}`);

    // Test listRecords
    console.log('Fetching records from datasheet...');
    const records = await aitableService.listRecords(spaceId, datasheetId, { maxRecords: 5 });
    displayResults('Records (first 5)', records);

    if (records.length === 0) {
      console.log('No records found in this datasheet. Cannot test record-related functions.');
      return;
    }

    // Test getRecord with the first record ID
    const recordId = records[0].id;
    console.log(`Using Record ID: ${recordId}`);
    
    console.log('Fetching single record...');
    const record = await aitableService.getRecord(spaceId, datasheetId, recordId);
    displayResults('Single Record', record);

    console.log('\n✅ All mock tests completed successfully!');
    console.log('\nNOTE: These tests were performed with mock data and do not represent actual API responses.');
    console.log('For production use, please ensure you have a valid API key and correct API endpoint.');
    
  } catch (error) {
    console.error('Error testing AITableService:', error);
    if (error.response) {
      console.error('Response data:', error.response.data);
    }
  }
}

// Run the tests
testAITableService(); 