# 🎤 语音功能测试指南

> **日期**: 2026-01-18
> **状态**: 准备测试

---

## 📋 前置条件

### 1. 麦克风设备

- 确保电脑/手机有可用的麦克风
- 浏览器能访问麦克风权限

### 2. API Key配置

语音识别(ASR)使用智谱GLM的whisper-medium模型，需要配置环境变量：

```bash
# .env 文件
ZHIPU_API_KEY=your_zhipu_api_key_here
```

或者使用SiliconFlow（作为备选）：

```bash
SILICONFLOW_API_KEY=your_siliconflow_api_key_here
```

**获取智谱API Key**:

1. 访问 https://open.bigmodel.cn/
2. 注册/登录
3. 创建API Key

---

## 🚀 测试步骤

### 1. 启动服务器

```bash
npm run dev:server
```

### 2. 启动前端

```bash
npm run dev
```

### 3. 访问聊天页面

打开浏览器访问：

```
http://localhost:5173/chat?merchant=dongli
```

### 4. 测试语音功能

**步骤**:

1. 点击紫色**🎤麦克风**按钮
2. 浏览器会请求麦克风权限 → 点击"允许"
3. 按钮变红色，显示录音时长
4. 说话："门票多少钱？"
5. 再次点击按钮停止录音
6. 等待AI回复

---

## 🔧 技术架构

### 语音流程

```
用户说话 → 浏览器录音 → WebM格式
         ↓
     发送到服务端 /api/process-input
         ↓
     Agent A 收到音频Buffer
         ↓
     调用智谱ASR (whisper-medium)
         ↓
     语音转文字 → "门票多少钱？"
         ↓
     意图分类 → PRICE_QUERY
         ↓
     发给B → 查询C → 返回答案
         ↓
     前端显示回复
```

### 文件结构

```
前端：
├── src/hooks/useVoiceRecord.ts    # 录音Hook
├── src/lib/voice-utils.ts         # 语音工具函数
└── src/views/chat/SimpleChatPage.tsx  # 聊天页面(含语音)

后端：
├── server/agents/agent-a.ts       # ASR处理
└── server/config-manager.ts       # API Key配置
```

---

## 📊 预期结果

### 成功场景

```
用户: 🎤 语音消息 (3秒)
AI: 您好！东里村景区成人票60元/人，学生票30元/人...
```

### 失败场景

**麦克风权限被拒绝**:

```
页面显示: "无法启动录音，请检查麦克风权限"
```

**API Key未配置**:

```
服务端日志: "ASR API key not configured"
页面显示: "抱歉，语音处理失败，请重试"
```

**浏览器不支持**:

```
页面显示: "您的浏览器不支持语音功能"
```

---

## 🛠️ 问题排查

### 1. 麦克风权限

打开浏览器设置 → 隐私和安全 → 网站设置 → 麦克风 → 允许

### 2. 检查API Key

```bash
# 查看环境变量
echo $ZHIPU_API_KEY
```

### 3. 查看服务器日志

```
[A哥] ✍️ LPUSH 写入用户问题到上下文池
[A哥] ASR成功: "门票多少钱？"
```

### 4. 浏览器控制台

```
[SimpleChatPage] 语音服务端返回: {success: true, traceId: "..."}
```

---

## ⚠️ 注意事项

1. **HTTPS要求**: 部分浏览器要求HTTPS才能使用麦克风
   - 本地开发 localhost 不受此限制
   - 生产环境需要HTTPS

2. **录音格式**: 浏览器录制WebM格式，但智谱ASR需要转换
   - 目前发送原始webm格式
   - 如果不支持，可能需要前端转换为WAV

3. **超时限制**: 录音最长60秒自动停止

---

## 📝 测试检查清单

- [ ] 服务器正常启动
- [ ] 前端页面正常加载
- [ ] 麦克风按钮显示（紫色）
- [ ] 点击后浏览器请求权限
- [ ] 授权后按钮变红色显示时长
- [ ] 录音停止后发送到服务器
- [ ] 收到AI回复
- [ ] 回复内容正确

---

**测试工具**:

- Chrome DevTools (F12)
- 服务器终端日志

**准备就绪，开始测试！** 🚀
