const axios = require('axios');

const BASE_URL = 'http://localhost:5000/api/speedtest';

async function testAPI(endpoint, description) {
  try {
    console.log(`\n🧪 Testing: ${description}`);
    console.log(`📍 Endpoint: ${BASE_URL}${endpoint}`);
    
    const startTime = Date.now();
    const response = await axios.get(`${BASE_URL}${endpoint}`, {
      timeout: 30000
    });
    const endTime = Date.now();
    
    console.log(`✅ Status: ${response.status}`);
    console.log(`⏱️  Response Time: ${endTime - startTime}ms`);
    console.log(`📊 Response:`, JSON.stringify(response.data, null, 2));
    
    return { success: true, data: response.data, responseTime: endTime - startTime };
  } catch (error) {
    console.log(`❌ Error: ${error.message}`);
    if (error.response) {
      console.log(`📊 Error Response:`, JSON.stringify(error.response.data, null, 2));
    }
    return { success: false, error: error.message };
  }
}

async function runTests() {
  console.log('🚀 Starting Speed Test API Tests...\n');
  console.log('='.repeat(50));
  
  const tests = [
    { endpoint: '/health', description: 'Health Check' },
    { endpoint: '/ping', description: 'Ping Test' },
    { endpoint: '/download-test', description: 'Download Test' },
    { endpoint: '/speedtest', description: 'Full Speed Test' }
  ];
  
  const results = [];
  
  for (const test of tests) {
    const result = await testAPI(test.endpoint, test.description);
    results.push({ ...test, ...result });
    
    // Add delay between tests
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  
  console.log('\n' + '='.repeat(50));
  console.log('📋 Test Summary:');
  console.log('='.repeat(50));
  
  results.forEach((result, index) => {
    const status = result.success ? '✅' : '❌';
    const time = result.responseTime ? `(${result.responseTime}ms)` : '';
    console.log(`${index + 1}. ${status} ${result.description} ${time}`);
  });
  
  const successCount = results.filter(r => r.success).length;
  console.log(`\n🎯 Results: ${successCount}/${results.length} tests passed`);
}

runTests().catch(console.error);
