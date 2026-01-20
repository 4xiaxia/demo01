import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

interface HotQuestion {
  id: string;
  question: string;
  keywords: string[];
  answer: string;
  hitCount: number;
  lastUpdated: string;
  enabled: boolean;
  source: "manual" | "from_missing";
}

interface MissingQuestion {
  question: string;
  count: number;
  firstSeenAt: string;
  lastSeenAt: string;
  status: "pending" | "added_to_hot" | "ignored";
  intentCategory?: string;
}

export function HotQuestionsPage() {
  const [hotQuestions, setHotQuestions] = useState<HotQuestion[]>([]);
  const [missingQuestions, setMissingQuestions] = useState<MissingQuestion[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    question: "",
    keywords: "",
    answer: "",
    fromMissing: false,
  });

  const merchantId = "dongli";

  const loadHotQuestions = useCallback(async () => {
    try {
      const res = await fetch(`/api/merchant/${merchantId}/hot-questions`);
      const data = await res.json();
      if (data.success) {
        setHotQuestions(data.data.hotQuestions || []);
      }
    } catch (error) {
      console.error("加载热门问题失败:", error);
    }
  }, [merchantId]);

  const loadMissingQuestions = useCallback(async () => {
    try {
      const res = await fetch(`/api/merchant/${merchantId}/missing-questions`);
      const data = await res.json();
      if (data.success) {
        setMissingQuestions(data.data || []);
      }
    } catch (error) {
      console.error("加载报缺列表失败:", error);
    }
  }, [merchantId]);

  useEffect(() => {
    (async () => {
      await loadHotQuestions();
      await loadMissingQuestions();
    })();
  }, [loadHotQuestions, loadMissingQuestions]);

  const handleAddHotQuestion = async () => {
    try {
      const res = await fetch(`/api/merchant/${merchantId}/hot-questions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: formData.question,
          keywords: formData.keywords.split(",").map(k => k.trim()),
          answer: formData.answer,
          source: formData.fromMissing ? "from_missing" : "manual",
        }),
      });

      if (res.ok) {
        // 如果是从报缺转录的，自动忽略该报缺
        if (formData.fromMissing) {
          await handleIgnoreMissing(formData.question);
        }

        setShowAddForm(false);
        setFormData({ question: "", keywords: "", answer: "", fromMissing: false });
        loadHotQuestions();
      }
    } catch (error) {
      console.error("添加热门问题失败:", error);
    }
  };

  const handleIgnoreMissing = async (question: string) => {
    try {
      const res = await fetch(`/api/merchant/${merchantId}/missing-questions/ignore`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question }),
      });
      if (res.ok) {
        loadMissingQuestions();
      }
    } catch (error) {
      console.error("忽略失败:", error);
    }
  };

  const handleAddFromMissing = async (missing: MissingQuestion) => {
    setFormData({
      question: missing.question,
      keywords: missing.question,
      answer: "",
      fromMissing: true,
    });
    setShowAddForm(true);
  };

  const handleToggleEnabled = async (id: string, enabled: boolean) => {
    try {
      await fetch(`/api/merchant/${merchantId}/hot-questions/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: !enabled }),
      });
      loadHotQuestions();
    } catch (error) {
      console.error("更新失败:", error);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("确定删除这个热门问题吗？")) return;

    try {
      await fetch(`/api/merchant/${merchantId}/hot-questions/${id}`, {
        method: "DELETE",
      });
      loadHotQuestions();
    } catch (error) {
      console.error("删除失败:", error);
    }
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">🔥 热门问题管理</h1>
        <Button onClick={() => setShowAddForm(true)}>➕ 手动添加热门问题</Button>
      </div>

      {/* 报缺列表 */}
      <Card>
        <CardHeader>
          <CardTitle>📊 高频未找到问题（来自Agent D）</CardTitle>
        </CardHeader>
        <CardContent>
          {missingQuestions.length === 0 ? (
            <p className="text-gray-500">暂无报缺记录</p>
          ) : (
            <div className="space-y-3">
              {missingQuestions.map((missing, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{missing.question}</span>
                      <Badge variant="destructive">{missing.count}次</Badge>
                      {missing.intentCategory && (
                        <Badge variant="outline">{missing.intentCategory}</Badge>
                      )}
                    </div>
                    <p className="text-sm text-gray-500 mt-1">
                      首次: {new Date(missing.firstSeenAt).toLocaleString()} | 最近:{" "}
                      {new Date(missing.lastSeenAt).toLocaleString()}
                    </p>
                  </div>
                  <div className="flex gap-2 ml-4">
                    <Button size="sm" onClick={() => handleAddFromMissing(missing)}>
                      ➕ 转热门
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleIgnoreMissing(missing.question)}
                    >
                      🗑️ 忽略
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 添加/编辑表单 */}
      {showAddForm && (
        <Card>
          <CardHeader>
            <CardTitle>{editingId ? "编辑" : "添加"}热门问题</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">问题标题</label>
              <Input
                value={formData.question}
                onChange={e => setFormData({ ...formData, question: e.target.value })}
                placeholder="例如：门票多少钱"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">关键词（用逗号分隔）</label>
              <Input
                value={formData.keywords}
                onChange={e => setFormData({ ...formData, keywords: e.target.value })}
                placeholder="门票, 价格, 多少钱, 票, 收费"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">标准答案</label>
              <Textarea
                value={formData.answer}
                onChange={e => setFormData({ ...formData, answer: e.target.value })}
                placeholder="成人票60元/人，学生票30元/人（需凭学生证）..."
                rows={4}
              />
            </div>
            <div className="flex gap-2">
              <Button onClick={handleAddHotQuestion}>✅ 保存</Button>
              <Button
                variant="outline"
                onClick={() => {
                  setShowAddForm(false);
                  setFormData({ question: "", keywords: "", answer: "", fromMissing: false });
                }}
              >
                ❌ 取消
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 热门问题列表 */}
      <Card>
        <CardHeader>
          <CardTitle>当前热门问题 ({hotQuestions.length}条)</CardTitle>
        </CardHeader>
        <CardContent>
          {hotQuestions.length === 0 ? (
            <p className="text-gray-500">暂无热门问题，请添加</p>
          ) : (
            <div className="space-y-4">
              {hotQuestions.map(hot => (
                <div
                  key={hot.id}
                  className={`p-4 border rounded-lg ${!hot.enabled ? "opacity-50 bg-gray-50" : ""}`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="font-medium text-lg">{hot.question}</span>
                        {!hot.enabled && <Badge variant="secondary">已禁用</Badge>}
                        {hot.source === "from_missing" && <Badge variant="outline">来自报缺</Badge>}
                      </div>
                      <div className="mb-2">
                        <span className="text-sm text-gray-600">关键词: </span>
                        {hot.keywords.map((kw, idx) => (
                          <Badge key={idx} variant="outline" className="mr-1">
                            {kw}
                          </Badge>
                        ))}
                      </div>
                      <p className="text-sm text-gray-700 mb-2">{hot.answer}</p>
                      <div className="flex items-center gap-4 text-sm text-gray-500">
                        <span>🎯 命中: {hot.hitCount}次</span>
                        <span>📅 更新: {new Date(hot.lastUpdated).toLocaleString()}</span>
                      </div>
                    </div>
                    <div className="flex flex-col gap-2 ml-4">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleToggleEnabled(hot.id, hot.enabled)}
                      >
                        {hot.enabled ? "禁用" : "启用"}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setEditingId(hot.id);
                          setFormData({
                            question: hot.question,
                            keywords: hot.keywords.join(", "),
                            answer: hot.answer,
                            fromMissing: false,
                          });
                          setShowAddForm(true);
                        }}
                      >
                        编辑
                      </Button>
                      <Button size="sm" variant="destructive" onClick={() => handleDelete(hot.id)}>
                        删除
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
