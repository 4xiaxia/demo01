
async function runTests() {
  const baseUrl = 'http://localhost:3000';
  console.log('🚀 Starting API Verification Tests...');

  const endpoints = [
    { name: 'Monitor Stats', path: '/api/monitor/stats', method: 'GET' },
    { name: 'Monitor Logs', path: '/api/monitor/logs?merchantId=dongli&limit=5', method: 'GET' },
    { name: 'System Status', path: '/api/monitor/system', method: 'GET' },
    { name: 'Missing Questions', path: '/api/merchant/dongli/missing-questions', method: 'GET' },
    { name: 'Refresh Cache', path: '/api/merchant/dongli/hot-questions/refresh-cache', method: 'POST' }
  ];

  for (const ep of endpoints) {
    try {
      console.log(`\nTesting [${ep.method}] ${ep.path} (${ep.name})...`);
      const response = await fetch(`${baseUrl}${ep.path}`, { method: ep.method });
      const data = await response.json();
      
      if (response.ok && data.success) {
        console.log(`✅ ${ep.name} Success!`);
        if (ep.name === 'Monitor Stats') {
          console.log(`   Stats: Total Dialogs=${data.data.dailyStats.totalDialogs}, Missing=${data.data.missingQuestions.length}`);
        }
        if (ep.name === 'Missing Questions') {
          console.log(`   Real Missing Count: ${data.data.length}`);
        }
      } else {
        console.log(`❌ ${ep.name} Failed:`, data);
      }
    } catch (error) {
      console.log(`❌ ${ep.name} Error:`, error.message);
    }
  }

  // Test Context API
  try {
    console.log(`\nTesting Context API...`);
    const testTurn = { role: 'user', content: '测试问题', timestamp: Date.now() };
    const postRes = await fetch(`${baseUrl}/api/context/dongli/test_user/test_session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(testTurn)
    });
    const postData = await postRes.json();
    console.log(`   Add Context: ${postData.success ? '✅' : '❌'}`);

    const getRes = await fetch(`${baseUrl}/api/context/dongli/test_user/test_session`);
    const getData = await getRes.json();
    console.log(`   Get Context: ${getData.success ? '✅' : '❌'} (History length: ${getData.context?.length || 0})`);
  } catch (error) {
    console.log(`❌ Context API Error:`, error.message);
  }

  // Test Full Process Flow
  try {
    console.log(`\nTesting Full Process Flow (Agent A->B->C->D)...`);
    const formData = new FormData();
    formData.append('userId', 'test_user');
    formData.append('sessionId', 'test_session');
    formData.append('merchantId', 'dongli');
    formData.append('inputType', 'text');
    formData.append('text', '你好');

    const res = await fetch(`${baseUrl}/api/process-input`, {
      method: 'POST',
      body: formData
    });
    const data = await res.json();
    
    if (res.ok && data.success) {
      console.log(`✅ Process Input Accepted (TraceId: ${data.traceId})`);
      
      // Poll for response
      console.log(`   Polling for response...`);
      let attempts = 0;
      while (attempts < 10) {
        const pollRes = await fetch(`${baseUrl}/api/poll-response?traceId=${data.traceId}`);
        const pollData = await pollRes.json();
        if (pollData.success && pollData.data) {
          console.log(`✅ Got Response: "${pollData.data.data.response}"`);
          console.log(`   Source: ${pollData.data.data.source}`);
          break;
        }
        await new Promise(r => setTimeout(r, 500));
        attempts++;
      }
      if (attempts === 10) console.log(`❌ Polling Timeout`);
    } else {
      console.log(`❌ Process Input Failed:`, data);
    }
  } catch (error) {
    console.log(`❌ Process Flow Error:`, error.message);
  }

  console.log('\n🏁 Tests Completed.');
  process.exit(0);
}

runTests();
