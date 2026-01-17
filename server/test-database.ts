/**
 * 数据库连接测试脚本
 *
 * 使用服务端database模块进行测试
 */

import { databaseService } from "./database";

async function testDatabase() {
  console.log("🧪 开始测试数据库连接...\n");

  // 1. 初始化
  await databaseService.init();
  console.log("✅ 数据库初始化完成");

  // 2. 测试用户日志
  console.log("\n📝 测试用户日志...");

  // 写入测试日志
  await databaseService.saveUserLog({
    ticketId: "test_ticket_001",
    merchantId: "test_merchant",
    userId: "test_user",
    sessionId: "test_session",
    role: "user",
    content: "测试消息",
    intent: "INFO_QUERY",
    inputType: "text",
  });
  console.log("✅ 日志写入成功");

  // 读取测试
  const logs = await databaseService.getUserLogs("test_merchant", "test_user", 5);
  console.log("✅ 日志读取成功:", logs.length, "条记录");

  // 3. 测试知识库
  console.log("\n📝 测试知识库...");

  const knowledge = await databaseService.loadKnowledge("dongli");
  console.log("✅ 知识库加载成功:", knowledge.length, "条");

  // 搜索测试
  const searchResults = await databaseService.searchKnowledge("dongli", "价格");
  console.log("✅ 知识库搜索成功:", searchResults.length, "条匹配");

  // 4. 测试商户配置
  console.log("\n📝 测试商户配置...");

  const config = await databaseService.loadConfig("dongli");
  console.log("✅ 配置加载成功:", config?.name || "无配置");

  // 5. 测试会话
  console.log("\n📝 测试会话...");

  await databaseService.saveSession({
    id: "test_session_001",
    merchantId: "test_merchant",
    userId: "test_user",
    mode: "text",
    startTime: Date.now(),
    lastActive: Date.now(),
    turns: [
      {
        role: "user",
        content: "你好",
        timestamp: Date.now(),
      },
    ],
  });
  console.log("✅ 会话保存成功");

  const session = await databaseService.getSession("test_session_001");
  console.log("✅ 会话读取成功:", session?.turns.length || 0, "轮对话");

  // 6. 关闭连接
  console.log("\n🧹 关闭数据库连接...");
  await databaseService.close();
  console.log("✅ 连接已关闭");

  console.log("\n🎉 测试完成！");
}

testDatabase().catch(console.error);
