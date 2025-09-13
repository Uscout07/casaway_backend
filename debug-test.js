const http = require('http');

function testEndpoint(path, description) {
  return new Promise((resolve) => {
    const options = {
      hostname: 'localhost',
      port: 5000,
      path: `/api/speedtest${path}`,
      method: 'GET',
      timeout: 10000
    };

    console.log(`\n🧪 Testing: ${description}`);
    console.log(`📍 Endpoint: http://localhost:5000/api/speedtest${path}`);

    const startTime = Date.now();
    const req = http.request(options, (res) => {
      let data = '';
      
      console.log(`📡 Response Status: ${res.statusCode}`);
      console.log(`📡 Response Headers:`, res.headers);
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        const endTime = Date.now();
        console.log(`⏱️  Response Time: ${endTime - startTime}ms`);
        console.log(`📊 Raw Response:`, data);
        
        try {
          const jsonData = JSON.parse(data);
          console.log(`📊 Parsed Response:`, JSON.stringify(jsonData, null, 2));
          resolve({ success: true, data: jsonData, responseTime: endTime - startTime });
        } catch (e) {
          console.log(`❌ JSON Parse Error:`, e.message);
          resolve({ success: false, error: 'Invalid JSON response', rawData: data });
        }
      });
    });

    req.on('error', (error) => {
      console.log(`❌ Connection Error: ${error.message}`);
      console.log(`❌ Error Code: ${error.code}`);
      resolve({ success: false, error: error.message, code: error.code });
    });

    req.on('timeout', () => {
      console.log(`❌ Timeout: Request timed out after 10 seconds`);
      req.destroy();
      resolve({ success: false, error: 'Request timeout' });
    });

    req.end();
  });
}

async function runDebugTest() {
  console.log('🔍 Debug Test - Checking server connectivity...\n');
  
  // Test basic connectivity first
  const basicTest = await testEndpoint('/health', 'Health Check (Debug)');
  
  if (!basicTest.success) {
    console.log('\n❌ Basic connectivity test failed. Server might not be running or accessible.');
    console.log('Please ensure the server is running on port 5000.');
    return;
  }
  
  console.log('\n✅ Basic connectivity successful! Testing other endpoints...\n');
  
  const tests = [
    { endpoint: '/ping', description: 'Ping Test' },
    { endpoint: '/download-test', description: 'Download Test' },
    { endpoint: '/speedtest', description: 'Full Speed Test' }
  ];
  
  for (const test of tests) {
    await testEndpoint(test.endpoint, test.description);
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
}

runDebugTest().catch(console.error);
