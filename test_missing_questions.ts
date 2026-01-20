
import { anpBus } from './server/bus';
import { createMessage } from './server/types';
import { agentD } from './server/agents/agent-d';

async function testMissingQuestions() {
  console.log('🚀 Testing Agent D Missing Questions reporting...');
  
  const merchantId = 'dongli';
  const userId = 'test_user';
  const sessionId = 'test_session';
  const traceId = 'test_trace_123';

  // Simulate Agent C reporting a missing question to Agent D
  const missingMsg = createMessage(
    'C',
    'D',
    merchantId,
    userId,
    sessionId,
    'C_NOT_FOUND',
    {
      query: '我想知道厕所在哪里',
      intentCategory: 'FACILITY_QUERY',
      timestamp: Date.now(),
    },
    traceId
  );

  console.log('   Publishing C_NOT_FOUND message...');
  await anpBus.publish(missingMsg);

  // Wait a bit for async processing
  await new Promise(r => setTimeout(r, 100));

  const stats = agentD.getStats();
  console.log('   Agent D Stats:', JSON.stringify(stats.missingQuestions, null, 2));

  if (stats.missingQuestions['我想知道厕所在哪里']) {
    console.log('✅ Missing question recorded successfully!');
    const detail = stats.missingQuestions['我想知道厕所在哪里'];
    console.log(`   Count: ${detail.count}, Intent: ${detail.intentCategory}`);
  } else {
    console.log('❌ Missing question not recorded.');
  }

  process.exit(0);
}

testMissingQuestions();
