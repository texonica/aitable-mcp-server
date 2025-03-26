import nodeFetch from 'node-fetch';

// Test if nodeFetch is a function
console.log('nodeFetch is a function:', typeof nodeFetch === 'function');

// Try to use nodeFetch to make a simple request
async function testFetch() {
  try {
    console.log('Testing simple fetch request to example.com...');
    const response = await nodeFetch('https://example.com');
    const status = response.status;
    console.log('Fetch request successful:', status);
    const text = await response.text();
    console.log('Response body length:', text.length);
    console.log('Fetch is working properly!');
  } catch (error) {
    console.error('Error with fetch:', error);
  }
}

testFetch(); 