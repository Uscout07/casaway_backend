const http = require('http');

function testEndpoint(path, description) {
  return new Promise((resolve) => {
    const options = {
      hostname: 'localhost',
      port: 5000,
      path: `/api/speedtest${path}`,
      method: 'GET',
      timeout: 30000
    };

    console.log(`\n🧪 Testing: ${description}`);
    console.log(`📍 Endpoint: http://localhost:5000/api/speedtest${path}`);

    const startTime = Date.now();
    const req = http.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        const endTime = Date.now();
        console.log(`✅ Status: ${res.statusCode}`);
        console.log(`⏱️  Response Time: ${endTime - startTime}ms`);
        
        try {
          const jsonData = JSON.parse(data);
          console.log(`📊 Response:`, JSON.stringify(jsonData, null, 2));
          resolve({ success: true, data: jsonData, responseTime: endTime - startTime });
        } catch (e) {
          console.log(`📊 Raw Response:`, data);
          resolve({ success: false, error: 'Invalid JSON response' });
        }
      });
    });

    req.on('error', (error) => {
      console.log(`❌ Error: ${error.message}`);
      resolve({ success: false, error: error.message });
    });

    req.on('timeout', () => {
      console.log(`❌ Timeout: Request timed out`);
      req.destroy();
      resolve({ success: false, error: 'Request timeout' });
    });

    req.end();
  });
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
    const result = await testEndpoint(test.endpoint, test.description);
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
