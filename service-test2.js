import nodeFetch from 'node-fetch';

// More closely resembles AITableService
class TestService {
  constructor(
    apiKey = process.env.AITABLE_API_KEY || '',
    baseUrl = 'https://api.aitable.ai',
    fetch = nodeFetch
  ) {
    console.log('Constructor called with:');
    console.log('- apiKey:', apiKey.substring(0, 5) + '...');
    console.log('- baseUrl:', baseUrl);
    console.log('- fetch type:', typeof fetch);
    
    this.apiKey = apiKey;
    this.baseUrl = baseUrl;
    this.fetch = fetch;
  }
  
  async testFetch() {
    console.log('Testing fetch inside the class...');
    console.log('this.fetch type:', typeof this.fetch);
    
    try {
      const response = await this.fetch('https://example.com');
      console.log('Fetch successful! Status:', response.status);
      return true;
    } catch (error) {
      console.error('Error in fetch:', error);
      return false;
    }
  }
}

// Test with the parameters we're using in test-service.js
async function runTest() {
  const apiKey = process.env.AITABLE_API_KEY || 'test-key';
  
  // This mirrors our current usage in test-service.js
  const service = new TestService(apiKey, 'https://api.aitable.ai', nodeFetch);
  await service.testFetch();
}

runTest(); 