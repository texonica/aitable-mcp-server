import nodeFetch from 'node-fetch';

// Simple service class for testing
class SimpleService {
  constructor(apiKey, baseUrl, fetch) {
    console.log('Constructor called with:');
    console.log('- apiKey:', apiKey);
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
      const text = await response.text();
      console.log('Response length:', text.length);
      return true;
    } catch (error) {
      console.error('Error in fetch:', error);
      return false;
    }
  }
}

// Test with different parameter combinations
async function runTests() {
  console.log('========= Test 1: All parameters =========');
  const service1 = new SimpleService('test-key', 'https://example.com', nodeFetch);
  await service1.testFetch();
  
  console.log('\n========= Test 2: Default fetch =========');
  const service2 = new SimpleService('test-key', 'https://example.com');
  // This should error since we didn't provide fetch in this example
  try {
    await service2.testFetch();
  } catch (error) {
    console.error('Expected error:', error.message);
  }
}

runTests(); 