const http = require('http');

function testEndpoint(path, description, timeout = 30000) {
  return new Promise((resolve) => {
    const options = {
      hostname: 'localhost',
      port: 5000,
      path: `/api/speedtest${path}`,
      method: 'GET',
      timeout: timeout
    };

    console.log(`\n🧪 Testing: ${description}`);
    console.log(`📍 Endpoint: http://localhost:5000/api/speedtest${path}`);
    console.log(`⏰ Timeout: ${timeout/1000}s`);

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
          console.log(`❌ JSON Parse Error:`, e.message);
          console.log(`📊 Raw Response:`, data);
          resolve({ success: false, error: 'Invalid JSON response', rawData: data });
        }
      });
    });

    req.on('error', (error) => {
      console.log(`❌ Error: ${error.message}`);
      resolve({ success: false, error: error.message });
    });

    req.on('timeout', () => {
      console.log(`❌ Timeout: Request timed out after ${timeout/1000} seconds`);
      req.destroy();
      resolve({ success: false, error: 'Request timeout' });
    });

    req.end();
  });
}

async function runComprehensiveTest() {
  console.log('🚀 Comprehensive Speed Test API Tests...\n');
  console.log('='.repeat(60));
  
  const tests = [
    { endpoint: '/health', description: 'Health Check', timeout: 5000 },
    { endpoint: '/ping', description: 'Ping Test', timeout: 10000 },
    { endpoint: '/download-test', description: 'Download Test', timeout: 60000 },
    { endpoint: '/speedtest', description: 'Full Speed Test', timeout: 120000 }
  ];
  
  const results = [];
  
  for (const test of tests) {
    const result = await testEndpoint(test.endpoint, test.description, test.timeout);
    results.push({ ...test, ...result });
    
    // Add delay between tests
    console.log(`\n⏳ Waiting 3 seconds before next test...`);
    await new Promise(resolve => setTimeout(resolve, 3000));
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('📋 Test Summary:');
  console.log('='.repeat(60));
  
  results.forEach((result, index) => {
    const status = result.success ? '✅' : '❌';
    const time = result.responseTime ? `(${result.responseTime}ms)` : '';
    console.log(`${index + 1}. ${status} ${result.description} ${time}`);
    
    if (result.success && result.data) {
      // Show key metrics for successful tests
      if (result.data.ping) console.log(`   📡 Ping: ${result.data.ping}ms`);
      if (result.data.download) console.log(`   ⬇️  Download: ${result.data.download} Mbps`);
      if (result.data.upload) console.log(`   ⬆️  Upload: ${result.data.upload} Mbps`);
      if (result.data.jitter) console.log(`   📊 Jitter: ${result.data.jitter}ms`);
    }
  });
  
  const successCount = results.filter(r => r.success).length;
  console.log(`\n🎯 Results: ${successCount}/${results.length} tests passed`);
  
  if (successCount === results.length) {
    console.log('🎉 All speed test APIs are working perfectly!');
  }
}

runComprehensiveTest().catch(console.error);
