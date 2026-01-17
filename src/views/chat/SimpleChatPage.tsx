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
import { Send, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: number;
}

export function SimpleChatPage() {
  const [searchParams] = useSearchParams();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // 从URL获取参数
  const merchantId = searchParams.get("merchant") || "dongli";
  const userId = searchParams.get("userId") || "default_user";
  const mode = searchParams.get("mode") || "text";

  // 初始化
  useEffect(() => {
    const init = async () => {
      try {
        console.log("[SimpleChatPage] 初始化...");

        // 通知服务端用户进入
        await fetch("/api/user-enter", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ merchantId, userId, mode, timestamp: Date.now() }),
        });

        // 欢迎消息
        setMessages([
          {
            id: "welcome",
            role: "assistant",
            content: "您好！欢迎来到东里村，我是智能导游小助手，有什么可以帮您的？",
            timestamp: Date.now(),
          },
        ]);

        setReady(true);
        console.log("[SimpleChatPage] 初始化完成");
      } catch (e) {
        console.error("[SimpleChatPage] 初始化失败", e);
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

            setLoading(false);
            setMessages(prev => [
              ...prev,
              {
                id: `assistant_${Date.now()}`,
                role: "assistant",
                content: content,
                timestamp: Date.now(),
              },
            ]);
            return; // 结束轮询
          }
        } catch (err) {
          console.warn("[Poll] 轮询出错:", err);
        }

        // 继续轮询
        setTimeout(pollForResponse, 500); // 500ms 间隔
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
        <h1 className="text-xl font-bold">东里村智能导游</h1>
        <p className="text-sm text-white/60">有问必答</p>
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
              }`}
            >
              {msg.content}
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
          <Input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="输入您的问题..."
            disabled={loading}
            className="flex-1 bg-white/90"
          />
          <Button
            onClick={handleSend}
            disabled={!input.trim() || loading}
            className="bg-blue-500 hover:bg-blue-600"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
          </Button>
        </div>
      </div>
    </div>
  );
}
