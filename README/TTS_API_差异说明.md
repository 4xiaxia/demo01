# TTS API 提供商差异说明

> 创建时间：2026-01-20  
> 基于官方文档的准确对比，避免混淆

## 📊 核心差异对比表

| 对比项 | 阿里云 DashScope | 智谱 GLM | 关键注意事项 |
|--------|------------------|----------|--------------|
| **模型** | `cosyvoice-v3-flash` | `glm-tts` | 不同模型系列 |
| **女声** | `longxiaoxia_v3` | `female` | ⚠️ 音色名完全不同 |
| **语速参数** | ✅ `rate` | ✅ `speed` | ⚠️ **参数名不同！** |
| **采样率** | `22050` Hz | `24000` Hz | ⚠️ 默认值不同 |
| **格式** | `mp3` | `wav` | ⚠️ MIME类型不同 |
| **音量** | ✅ `volume` | ❌ 不支持 | 功能差异 |
| **音调** | ✅ `pitch` | ❌ 不支持 | 功能差异 |

## 🔄 TTS 调用流程对比

```mermaid
graph TB
    Start[前端发起TTS请求] --> Check{检查API Key配置}
    
    Check -->|阿里云可用| Ali[使用阿里云 DashScope]
    Check -->|阿里云不可用| Zhipu[降级到智谱 GLM]
    
    Ali --> AliConfig[配置阿里云参数]
    AliConfig --> AliParam["model: cosyvoice-v3-flash<br/>voice: longxiaoxia_v3<br/>rate: 1.3 ⚠️<br/>volume: 50<br/>sample_rate: 22050<br/>format: mp3"]
    
    Zhipu --> ZhipuConfig[配置智谱参数]
    ZhipuConfig --> ZhipuParam["model: glm-tts<br/>voice: female<br/>speed: 1.3 ⚠️<br/>format: wav"]
    
    AliParam --> AliCall[调用阿里云API]
    ZhipuParam --> ZhipuCall[调用智谱API]
    
    AliCall --> AliResponse["返回 MP3 音频<br/>mimeType: audio/mpeg"]
    ZhipuCall --> ZhipuResponse["返回 WAV 音频<br/>mimeType: audio/wav"]
    
    AliResponse --> FrontEnd[前端播放]
    ZhipuResponse --> FrontEnd
    
    FrontEnd --> Play["自动识别MIME类型<br/>Audio元素播放"]
    
    style AliParam fill:#e1f5fe
    style ZhipuParam fill:#fff3e0
    style AliResponse fill:#e1f5fe
    style ZhipuResponse fill:#fff3e0
```

## ⚠️ 关键注意事项

### 1. 语速参数名差异（最容易出错）

```mermaid
graph LR
    A[语速设置] --> B{提供商?}
    B -->|阿里云| C["使用 rate 参数"]
    B -->|智谱| D["使用 speed 参数"]
    
    C --> E[rate: 1.3]
    D --> F[speed: 1.3]
    
    style C fill:#ffebee
    style D fill:#fff3e0
    style E fill:#ffebee
    style F fill:#fff3e0
```

**错误示例：**
```json
// ❌ 错误：阿里云使用了 speed
{
  "model": "cosyvoice-v3-flash",
  "voice": "longxiaoxia_v3",
  "speed": 1.3  // ❌ 应该用 rate
}

// ✅ 正确
{
  "model": "cosyvoice-v3-flash", 
  "voice": "longxiaoxia_v3",
  "rate": 1.3  // ✅ 正确
}
```

### 2. 音色名称差异

```mermaid
graph TB
    Voice[音色选择] --> Type{性别?}
    
    Type -->|女声| Female[女声音色]
    Type -->|男声| Male[男声音色]
    
    Female --> AliF["阿里云 v3<br/>longxiaoxia_v3<br/>沉稳权威女"]
    Female --> ZhipuF["智谱<br/>female<br/>女声"]
    
    Male --> AliM["阿里云 v3<br/>longanyang<br/>阳光大男孩"]
    Male --> ZhipuM["智谱<br/>male<br/>男声"]
    
    style AliF fill:#e1f5fe
    style ZhipuF fill:#fff3e0
    style AliM fill:#e1f5fe
    style ZhipuM fill:#fff3e0
```

### 3. 配置管理流程

```mermaid
sequenceDiagram
    participant Config as api-config.ts
    participant Service as api-service.ts
    participant API as TTS API
    participant Front as 前端

    Note over Config: 定义两套配置
    Config->>Config: DASHSCOPE_API.tts {rate, mp3, 22050}
    Config->>Config: ZHIPU_API.tts {speed, wav, 24000}
    
    Service->>Config: getTTSConfig(provider)
    Config-->>Service: 返回对应配置
    
    alt 阿里云
        Service->>API: POST with rate param
        API-->>Service: mp3 audio
    else 智谱
        Service->>API: POST with speed param
        API-->>Service: wav audio
    end
    
    Service->>Service: 添加 mimeType 到响应
    Service-->>Front: {audioBase64, format, mimeType}
    Front->>Front: 根据 mimeType 播放
```

## 🎯 商家配置建议

在 `config.json` 中配置主备提供商：

```json
{
  "apiConfig": {
    "tts": {
      "primary": "dashscope",    // 主用阿里云（功能更多）
      "backup": ["zhipu"],       // 备用智谱
      "speed": 1.3,              // 统一语速配置
      "voice": "female"          // 统一性别配置
    }
  }
}
```

系统会自动：
1. 根据提供商转换参数名（`speed` → `rate` 或 `speed`）
2. 转换音色名（`female` → `longxiaoxia_v3` 或 `female`）
3. 设置正确的格式和 MIME 类型

## 📂 相关文件

| 文件 | 作用 | 关键点 |
|------|------|--------|
| `server/config/api-config.ts` | TTS配置定义 | 定义两套完整配置 |
| `server/services/api-service.ts` | TTS调用实现 | 根据提供商使用不同参数 |
| `src/views/chat/SimpleChatPage.tsx` | 前端播放 | 自动识别mimeType |

## 🔍 调试建议

### 如何验证配置正确？

1. **查看日志**：
   ```
   [TTS] 播放音频: provider=dashscope, format=mp3, mimeType=audio/mpeg
   ```

2. **检查请求体**：
   - 阿里云应该看到 `rate` 参数
   - 智谱应该看到 `speed` 参数

3. **检查响应**：
   - 阿里云返回 MP3
   - 智谱返回 WAV

### 常见问题排查

```mermaid
graph TD
    Problem[TTS无声音] --> Check1{检查控制台}
    
    Check1 -->|看到rate参数| Good1[阿里云配置正确]
    Check1 -->|看到speed参数| Check2{哪个提供商?}
    
    Check2 -->|阿里云| Error1["❌ 错误！<br/>阿里云应该用rate"]
    Check2 -->|智谱| Good2[智谱配置正确]
    
    Good1 --> CheckMime{检查mimeType}
    Good2 --> CheckMime
    
    CheckMime -->|audio/mpeg| PlayMP3[播放MP3]
    CheckMime -->|audio/wav| PlayWAV[播放WAV]
    CheckMime -->|undefined| Error2["❌ 缺少mimeType<br/>检查后端返回"]
    
    style Error1 fill:#ffebee
    style Error2 fill:#ffebee
```

## 💡 最佳实践

1. **优先使用阿里云**：
   - 功能更丰富（音量、音调、Instruct）
   - 格式更小（MP3 vs WAV）
   - 价格透明（1元/万字符）

2. **智谱作为备用**：
   - 配置简单
   - 音质稳定
   - 参数更少

3. **统一配置管理**：
   - 商家只需配置 `speed` 和 `voice`
   - 系统自动转换为对应提供商的参数
   - 前端自动适配不同格式

4. **测试建议**：
   - 分别测试两个提供商
   - 验证降级机制
   - 检查音频格式正确性

---

**更新记录**：
- 2026-01-20：基于官方文档创建，修正参数名和配置
