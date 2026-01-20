/**
 * 前端SimpleChatPage - 纯UI组件
 *
 * 核心设计：
 * 1. 只负责UI展示，不包含Agent逻辑
 * 2. 通过API与服务端通信
 * 3. 监听服务端的B_RESPONSE事件（SSE或轮询）
 *
 * 按照原始设计：
 * - 前端是H5界面，服务端是ABCD四人组
 * - 前端调用/api/process-input发送消息
 * - 等待服务端B的回复
 */

import { useState, useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { Send, Loader2, Mic, Square, Volume2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { useVoiceRecord } from "@/hooks/useVoiceRecord";
import { configManager } from "@/core/config-manager";
import {
  convertToWav,
  checkVoiceCapability,
  playBase64Audio,
  type VoiceCapability,
} from "@/lib/voice-utils";

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: number;
  audioBase64?: string; // TTS音频
}

export function SimpleChatPage() {
  const [searchParams] = useSearchParams();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // 语音录制
  const {
    isRecording,
    recordingDuration,
    startRecording,
    stopRecording,
    isSupported,
    error: voiceError,
  } = useVoiceRecord();

  // 环境检测和用户选择
  const [voiceCapability, setVoiceCapability] = useState<VoiceCapability | null>(null);
  const [userInputMode, setUserInputMode] = useState<"text" | "voice" | null>(null);
  const [enableTTS, setEnableTTS] = useState(false);
  const [playingAudio, setPlayingAudio] = useState<string | null>(null);
  const [pageTitle, setPageTitle] = useState("智能导游");

  // 从URL获取参数
  const merchantId = searchParams.get("merchant") || "dongli";
  const userId = searchParams.get("userId") || "default_user";
  const mode = searchParams.get("mode") || "text";

  // 初始化
  useEffect(() => {
    const init = async () => {
      try {
        console.log("[SimpleChatPage] 初始化...");

        // 1. 加载配置
        const config = await configManager.loadConfig();
        console.log("[SimpleChatPage] 配置加载完成:", config);

        // 2. 环境检测
        const capability = await checkVoiceCapability();
        setVoiceCapability(capability);
        console.log("[SimpleChatPage] 环境检测:", capability);

        // 3. 根据URL参数设置默认模式
        if (mode === "voice" && capability.canRecord) {
          setUserInputMode("voice");
          setEnableTTS(true);
        } else {
          setUserInputMode("text");
        }

        // 4. 通知服务端用户进入
        await fetch("/api/user-enter", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ merchantId, userId, mode, timestamp: Date.now() }),
        });

        // 5. 使用配置的欢迎消息和标题
        const welcomeMessage = config.prompts?.welcome || "您好！有什么可以帮您的？";
        setPageTitle(config.theme?.title || config.name || "智能导游");
        setMessages([
          {
            id: "welcome",
            role: "assistant",
            content: welcomeMessage,
            timestamp: Date.now(),
          },
        ]);

        setReady(true);
        console.log("[SimpleChatPage] 初始化完成");
      } catch (e) {
        console.error("[SimpleChatPage] 初始化失败", e);
        setReady(true); // 即使出错也允许使用
      }
    };

    init();
  }, [merchantId, userId, mode]);

  // 自动滚动到底部
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // 发送消息
  const handleSend = async () => {
    if (!input.trim() || loading) return;

    const text = input.trim();
    setInput("");
    setLoading(true);

    // 添加用户消息
    setMessages(prev => [
      ...prev,
      {
        id: `user_${Date.now()}`,
        role: "user",
        content: text,
        timestamp: Date.now(),
      },
    ]);

    // 上报输入统计
    fetch("/api/stats/input", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ merchantId, inputType: "text" }),
    }).catch(console.error);

    try {
      // 调用服务端API
      const sessionId = `session_${Date.now()}`;
      const formData = new FormData();
      formData.append("userId", userId);
      formData.append("sessionId", sessionId);
      formData.append("inputType", "text");
      formData.append("merchantId", merchantId);
      formData.append("text", text);

      const response = await fetch("/api/process-input", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`API request failed: ${response.statusText}`);
      }

      const result = await response.json();
      console.log("[SimpleChatPage] 服务端返回:", result);

      // 轮询获取B的回复（最多等待10秒）
      const traceId = result.traceId;
      let attempts = 0;
      const maxAttempts = 100; // 10秒 (100 * 100ms)

      const pollForResponse = async () => {
        if (attempts >= maxAttempts) {
          // 超时兜底
          setLoading(false);
          setMessages(prev => [
            ...prev,
            {
              id: `timeout_${Date.now()}`,
              role: "assistant",
              content: "抱歉，处理时间有点长，请稍后再试或刷新页面。",
              timestamp: Date.now(),
            },
          ]);
          return;
        }

        attempts++;

        try {
          const pollRes = await fetch(`/api/poll-response?traceId=${traceId}`);
          const pollResult = await pollRes.json();

          if (pollResult.success && pollResult.data) {
            // 收到回复！
            const msgData = pollResult.data.data;
            const content =
              msgData.response || msgData.content || msgData.text || "收到了回复，但格式未知";

            const msgId = `assistant_${Date.now()}`;

            // ⚡ 优化1：并行处理TTS和消息显示
            let ttsPromise: Promise<{
              success: boolean;
              audioBase64?: string;
              format?: string;
              provider?: string;
              mimeType?: string;
            }> | null = null;
            if (enableTTS && content.length < 500) {
              console.log("[TTS优化] 立即启动TTS请求");
              ttsPromise = fetch("/api/tts", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ text: content, voice: "female" }),
              }).then(res => res.json());
            }

            // 立即显示消息（不等TTS）
            setLoading(false);
            setMessages(prev => [
              ...prev,
              {
                id: msgId,
                role: "assistant",
                content: content,
                timestamp: Date.now(),
              },
            ]);

            // 如果有TTS请求，等待并播放
            if (ttsPromise) {
              try {
                const ttsData = await ttsPromise;
                if (ttsData.success && ttsData.audioBase64) {
                  setPlayingAudio(msgId);
                  // 使用服务端返回的mimeType，自动适配不同提供商
                  const mimeType =
                    ttsData.mimeType || (ttsData.format === "mp3" ? "audio/mpeg" : "audio/wav");
                  console.log(
                    `[TTS] 播放音频: provider=${ttsData.provider}, format=${ttsData.format}, mimeType=${mimeType}`
                  );
                  await playBase64Audio(ttsData.audioBase64, mimeType);
                  setPlayingAudio(null);
                }
              } catch (ttsErr) {
                console.warn("[TTS] 播放失败:", ttsErr);
                setPlayingAudio(null);
              }
            }
            return; // 结束轮询
          }
        } catch (err) {
          console.warn("[Poll] 轮询出错:", err);
        }

        // ⚡ 优化2：缩短轮询间隔（500ms → 200ms）
        setTimeout(pollForResponse, 200);
      };

      pollForResponse();
    } catch (e) {
      console.error("[SimpleChatPage] 发送失败", e);
      setLoading(false);
      setMessages(prev => [
        ...prev,
        {
          id: `error_${Date.now()}`,
          role: "assistant",
          content: "抱歉，系统出了一点问题，请稍后再试",
          timestamp: Date.now(),
        },
      ]);
    }
  };

  // 按回车发送
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // 语音录制处理
  const handleVoiceClick = async () => {
    if (isRecording) {
      // 停止录制并发送
      const result = await stopRecording();
      if (result && result.blob) {
        setLoading(true);

        // 添加用户语音消息
        setMessages(prev => [
          ...prev,
          {
            id: `user_voice_${Date.now()}`,
            role: "user",
            content: `🎤 语音消息 (${result.duration}秒)`,
            timestamp: Date.now(),
          },
        ]);

        // 上报语音输入统计
        fetch("/api/stats/input", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ merchantId, inputType: "voice" }),
        }).catch(console.error);

        try {
          // 发送语音到服务端
          const sessionId = `session_${Date.now()}`;
          const formData = new FormData();
          formData.append("userId", userId);
          formData.append("sessionId", sessionId);
          formData.append("inputType", "voice");
          formData.append("merchantId", merchantId);

          // 智谱ASR只支持wav/mp3格式，需要将webm转换为wav
          console.log("[SimpleChatPage] 转换音频格式: webm → wav");
          const wavBlob = await convertToWav(result.blob);
          formData.append("audio", wavBlob, "audio.wav");

          const response = await fetch("/api/process-input", {
            method: "POST",
            body: formData,
          });

          if (!response.ok) {
            throw new Error(`API request failed: ${response.statusText}`);
          }

          const apiResult = await response.json();
          console.log("[SimpleChatPage] 语音服务端返回:", apiResult);

          // 轮询获取B的回复
          const traceId = apiResult.traceId;
          let attempts = 0;
          const maxAttempts = 100;

          const pollForResponse = async () => {
            if (attempts >= maxAttempts) {
              setLoading(false);
              setMessages(prev => [
                ...prev,
                {
                  id: `timeout_${Date.now()}`,
                  role: "assistant",
                  content: "抱歉，处理时间有点长，请稍后再试。",
                  timestamp: Date.now(),
                },
              ]);
              return;
            }

            attempts++;

            try {
              const pollRes = await fetch(`/api/poll-response?traceId=${traceId}`);
              const pollResult = await pollRes.json();

              if (pollResult.success && pollResult.data) {
                const msgData = pollResult.data.data;
                const content = msgData.response || msgData.content || msgData.text || "收到回复";

                const msgId = `assistant_${Date.now()}`;

                // ⚡ 优化1：并行处理TTS和消息显示
                let ttsPromise: Promise<{
                  success: boolean;
                  audioBase64?: string;
                  format?: string;
                  provider?: string;
                  mimeType?: string;
                }> | null = null;
                if (enableTTS && content.length < 500) {
                  console.log("[TTS优化] 立即启动TTS请求");
                  ttsPromise = fetch("/api/tts", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ text: content, voice: "female" }),
                  }).then(res => res.json());
                }

                // 立即显示消息（不等TTS）
                setLoading(false);
                setMessages(prev => [
                  ...prev,
                  {
                    id: msgId,
                    role: "assistant",
                    content: content,
                    timestamp: Date.now(),
                  },
                ]);

                // 如果有TTS请求，等待并播放
                if (ttsPromise) {
                  try {
                    const ttsData = await ttsPromise;
                    if (ttsData.success && ttsData.audioBase64) {
                      setPlayingAudio(msgId);
                      // 使用服务端返回的mimeType，自动适配不同提供商
                      const mimeType =
                        ttsData.mimeType || (ttsData.format === "mp3" ? "audio/mpeg" : "audio/wav");
                      console.log(
                        `[TTS] 播放音频: provider=${ttsData.provider}, format=${ttsData.format}, mimeType=${mimeType}`
                      );
                      await playBase64Audio(ttsData.audioBase64, mimeType);
                      setPlayingAudio(null);
                    }
                  } catch (ttsErr) {
                    console.warn("[TTS] 播放失败:", ttsErr);
                    setPlayingAudio(null);
                  }
                }
                return;
              }
            } catch (err) {
              console.warn("[Poll] 轮询出错:", err);
            }

            // ⚡ 优化2：缩短轮询间隔（500ms → 200ms）
            setTimeout(pollForResponse, 200);
          };

          pollForResponse();
        } catch (e) {
          console.error("[SimpleChatPage] 语音发送失败", e);
          setLoading(false);
          setMessages(prev => [
            ...prev,
            {
              id: `error_${Date.now()}`,
              role: "assistant",
              content: "抱歉，语音处理失败，请重试",
              timestamp: Date.now(),
            },
          ]);
        }
      }
    } else {
      // 开始录制
      await startRecording();
    }
  };

  if (!ready) {
    return (
      <div className="h-screen flex items-center justify-center bg-gradient-to-br from-blue-900 to-purple-900">
        <div className="text-white text-xl animate-pulse">正在加载...</div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-gradient-to-br from-blue-900 to-purple-900">
      {/* 头部 */}
      <div className="p-4 text-center text-white">
        <h1 className="text-xl font-bold">{pageTitle}</h1>
        <p className="text-sm text-white/60">有问必答</p>

        {/* 模式选择和TTS开关 */}
        <div className="flex justify-center gap-4 mt-2">
          <button
            onClick={() => setUserInputMode(userInputMode === "voice" ? "text" : "voice")}
            className={`px-3 py-1 text-xs rounded-full transition ${
              userInputMode === "voice"
                ? "bg-purple-500 text-white"
                : "bg-white/20 text-white/70 hover:bg-white/30"
            }`}
          >
            {userInputMode === "voice" ? "🎤 语音模式" : "⌨️ 文字模式"}
          </button>
          <button
            onClick={() => setEnableTTS(!enableTTS)}
            className={`px-3 py-1 text-xs rounded-full transition ${
              enableTTS ? "bg-green-500 text-white" : "bg-white/20 text-white/70 hover:bg-white/30"
            }`}
          >
            {enableTTS ? "🔊 语音播报开" : "🔇 语音播报关"}
          </button>
          {voiceCapability && !voiceCapability.canRecord && (
            <span className="text-xs text-yellow-400">⚠️ 浏览器不支持录音</span>
          )}
        </div>
      </div>

      {/* 消息列表 */}
      <div className="flex-1 overflow-y-auto px-4 pb-4">
        <div className="max-w-2xl mx-auto space-y-4">
          {messages.map(msg => (
            <Card
              key={msg.id}
              className={`p-4 ${
                msg.role === "user"
                  ? "bg-blue-500 text-white ml-auto max-w-[80%]"
                  : "bg-white/90 text-gray-800 mr-auto max-w-[80%]"
              } ${playingAudio === msg.id ? "ring-2 ring-green-400 animate-pulse" : ""}`}
            >
              {msg.content}
              {playingAudio === msg.id && (
                <Volume2 className="inline-block w-4 h-4 ml-2 animate-pulse" />
              )}
            </Card>
          ))}

          {loading && (
            <Card className="p-4 bg-white/90 text-gray-800 mr-auto max-w-[80%]">
              <div className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>正在思考...</span>
              </div>
            </Card>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* 输入框 */}
      <div className="p-4 bg-white/10 backdrop-blur">
        <div className="max-w-2xl mx-auto flex gap-2">
          {/* 语音按钮 */}
          {isSupported && (
            <Button
              onClick={handleVoiceClick}
              disabled={loading}
              className={`${isRecording ? "bg-red-500 hover:bg-red-600 animate-pulse" : "bg-purple-500 hover:bg-purple-600"}`}
              title={isRecording ? "点击停止录音" : "点击开始录音"}
            >
              {isRecording ? (
                <>
                  <Square className="w-5 h-5 mr-1" />
                  {recordingDuration}s
                </>
              ) : (
                <Mic className="w-5 h-5" />
              )}
            </Button>
          )}

          <Input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={isRecording ? "正在录音..." : "输入您的问题..."}
            disabled={loading || isRecording}
            className="flex-1 bg-white/90"
          />
          <Button
            onClick={handleSend}
            disabled={!input.trim() || loading || isRecording}
            className="bg-blue-500 hover:bg-blue-600"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
          </Button>
        </div>

        {/* 语音错误提示 */}
        {voiceError && (
          <div className="max-w-2xl mx-auto mt-2 text-red-400 text-sm text-center">
            {voiceError}
          </div>
        )}

        {/* 语音不支持提示 */}
        {!isSupported && (
          <div className="max-w-2xl mx-auto mt-2 text-yellow-400 text-sm text-center">
            您的浏览器不支持语音功能
          </div>
        )}
      </div>
    </div>
  );
}
