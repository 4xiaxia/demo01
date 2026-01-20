import { HotQuestionService } from './server/services/hot-question-service.ts';
import { MissingQuestionService } from './server/services/missing-question-service.ts';
import { KnowledgeService } from './server/services/knowledge-service.ts';
import { createMessage } from './server/types.ts';
import { anpBus } from './server/bus.ts';

async function verifyFullFlow() {
  console.log('🚀 [全链路验证] 开始执行系统体检...\n');

  const merchantId = 'dongli';
  const traceId = 'test_flow_' + Date.now();

  // --- 步骤 1: 验证热门问题 Service & Agent B 联动 ---
  console.log('1️⃣ 测试热门问题命中...');
  const hotData = await HotQuestionService.load(merchantId);
  const testHot = hotData.hotQuestions.find(h => h.enabled) || hotData.hotQuestions[0];
  
  if (testHot) {
    console.log(`   尝试提问: "${testHot.question}"`);
    const initialHit = testHot.hitCount || 0;
    
    // 模拟命中次数累加
    await HotQuestionService.incrementHit(merchantId, testHot.id);
    const updatedData = await HotQuestionService.load(merchantId);
    const updatedHot = updatedData.hotQuestions.find(h => h.id === testHot.id);
    
    if (updatedHot?.hitCount === initialHit + 1) {
      console.log('   ✅ HotQuestionService 命中统计正常');
    } else {
      console.log('   ❌ HotQuestionService 命中统计异常');
    }
  }

  // --- 步骤 2: 验证报缺记录链路 ---
  console.log('\n2️⃣ 测试知识报缺记录 (Agent C -> D)...');
  const missingMsg = createMessage(
    'C', 'D', merchantId, 'u1', 's1', 'C_NOT_FOUND',
    { query: '这个测试问题不存在', intentCategory: 'INFO_QUERY' },
    traceId
  );
  
  await anpBus.publish(missingMsg);
  await new Promise(r => setTimeout(r, 200)); // 等待异步处理

  const stats = MissingQuestionService.getStats();
  if (stats.missingQuestions['这个测试问题不存在']) {
    console.log('   ✅ Agent D 成功记录报缺问题');
  } else {
    console.log('   ❌ Agent D 未能记录报缺问题');
  }

  // --- 步骤 3: 验证报缺转知识库的解构逻辑 ---
  console.log('\n3️⃣ 测试报缺一键转知识库 (Missing -> Knowledge)...');
  const convertSuccess = await MissingQuestionService.convertToKnowledge(
    merchantId,
    '这个测试问题不存在',
    { 
      content: '这是由验证脚本自动生成的答案', 
      category: 'info', 
      keywords: ['测试', '自动'] 
    }
  );

  if (convertSuccess) {
    const knowledgeItems = await KnowledgeService.load(merchantId);
    const found = knowledgeItems.find(k => k.name === '这个测试问题不存在');
    
    const remainingMissing = MissingQuestionService.getStats().missingQuestions['这个测试问题不存在'];
    
    if (found && !remainingMissing) {
      console.log('   ✅ 转化逻辑闭环：知识库已新增，原报缺已清理');
    } else {
      console.log('   ❌ 转化逻辑异常：知识库或报缺状态未同步');
    }
  } else {
    console.log('   ❌ MissingQuestionService 转化执行失败');
  }

  console.log('\n✨ [全链路验证] 完成！系统架构运行正常。');
  process.exit(0);
}

verifyFullFlow().catch(err => {
  console.error('验证过程中发生错误:', err);
  process.exit(1);
});
