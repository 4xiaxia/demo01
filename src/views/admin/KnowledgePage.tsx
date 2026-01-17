/**
 * 知识库管理页面 - 一个萝卜一个坑
 *
 * 功能：
 * 1. 加载当前商户的知识库
 * 2. 添加/编辑/删除知识条目
 * 3. 保存到服务端
 * 4. 批量导入导出 (JSON/CSV)
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { configManager } from "@/core/config-manager";
import {
  Plus,
  Trash2,
  Edit2,
  Save,
  X,
  Search,
  Download,
  Upload,
  FileJson,
  FileSpreadsheet,
} from "lucide-react";

interface KnowledgeItem {
  id: string;
  name: string;
  content: string;
  keywords: string[];
  category: "price" | "info";
  enabled: boolean;
  isHot?: boolean;
  weight?: number;
}

export const KnowledgePage = () => {
  const [items, setItems] = useState<KnowledgeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [editingItem, setEditingItem] = useState<KnowledgeItem | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [showImportExport, setShowImportExport] = useState(false);
  const [importMessage, setImportMessage] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showAiOrganize, setShowAiOrganize] = useState(false);
  const [aiRawText, setAiRawText] = useState("");
  const [aiProcessing, setAiProcessing] = useState(false);
  const [aiResult, setAiResult] = useState<KnowledgeItem | null>(null);

  const merchantId = configManager.getMerchantId();

  // 加载知识库
  const loadKnowledge = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/merchant/${merchantId}/knowledge`);
      const data = await res.json();
      // 兼容两种返回格式: data.items 或 data.data (后端返回 {success, data: []})
      const items = data.items || data.data || [];
      setItems(items);
    } catch (e) {
      console.error("加载知识库失败:", e);
    } finally {
      setLoading(false);
    }
  }, [merchantId]);

  useEffect(() => {
    loadKnowledge();
  }, [loadKnowledge]);

  // 保存知识库
  const saveKnowledge = async (newItems: KnowledgeItem[]) => {
    setSaving(true);
    try {
      const res = await fetch(`/api/merchant/${merchantId}/knowledge`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: newItems }),
      });
      if (res.ok) {
        setItems(newItems);
      }
    } catch (e) {
      console.error("保存失败:", e);
    } finally {
      setSaving(false);
    }
  };

  // 添加条目
  const handleAdd = () => {
    setEditingItem({
      id: `k_${Date.now()}`,
      name: "",
      content: "",
      keywords: [],
      category: "info",
      enabled: true,
      isHot: false,
      weight: 1.0,
    });
    setIsAdding(true);
  };

  // 保存编辑
  const handleSaveEdit = async () => {
    if (!editingItem) return;

    const newItems = isAdding
      ? [...items, editingItem]
      : items.map(i => (i.id === editingItem.id ? editingItem : i));

    await saveKnowledge(newItems);
    setEditingItem(null);
    setIsAdding(false);
  };

  // 删除条目
  const handleDelete = async (id: string) => {
    if (!confirm("确定删除这条知识？")) return;
    const newItems = items.filter(i => i.id !== id);
    await saveKnowledge(newItems);
  };

  // 导出为JSON
  const handleExportJson = () => {
    const exportData = {
      merchantId,
      exportedAt: new Date().toISOString(),
      count: items.length,
      items,
    };
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `knowledge_${merchantId}_${new Date().toISOString().split("T")[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setImportMessage("✅ JSON导出成功！");
  };

  // 导出为CSV
  const handleExportCsv = () => {
    const headers = ["id", "name", "content", "keywords", "category", "enabled", "isHot", "weight"];
    const csvRows = [
      headers.join(","),
      ...items.map(item =>
        [
          item.id,
          `"${item.name.replace(/"/g, '""')}"`,
          `"${item.content.replace(/"/g, '""')}"`,
          `"${item.keywords.join(";")}"`,
          item.category,
          item.enabled,
          item.isHot || false,
          item.weight || 1,
        ].join(",")
      ),
    ];
    const blob = new Blob(["\uFEFF" + csvRows.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `knowledge_${merchantId}_${new Date().toISOString().split("T")[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setImportMessage("✅ CSV导出成功！");
  };

  // 导入JSON文件
  const handleImportFile = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async e => {
      try {
        const content = e.target?.result as string;

        if (file.name.endsWith(".json")) {
          const data = JSON.parse(content);
          const importedItems = data.items || data;

          if (!Array.isArray(importedItems)) {
            setImportMessage("❌ JSON格式错误：需要items数组");
            return;
          }

          // 验证并补全字段
          const validItems: KnowledgeItem[] = importedItems.map(
            (item: Partial<KnowledgeItem>, idx: number) => ({
              id: item.id || `imported_${Date.now()}_${idx}`,
              name: item.name || "未命名",
              content: item.content || "",
              keywords: item.keywords || [],
              category: item.category || "info",
              enabled: item.enabled !== false,
              isHot: item.isHot || false,
              weight: item.weight || 1,
            })
          );

          // 合并或替换
          const shouldReplace = confirm(
            `导入 ${validItems.length} 条知识。\n\n点击"确定"替换现有知识，\n点击"取消"追加到现有知识。`
          );
          const newItems = shouldReplace ? validItems : [...items, ...validItems];
          await saveKnowledge(newItems);
          setImportMessage(`✅ 成功导入 ${validItems.length} 条知识！`);
        } else if (file.name.endsWith(".csv")) {
          // 解析CSV
          const lines = content.split("\n").filter(line => line.trim());
          if (lines.length < 2) {
            setImportMessage("❌ CSV文件为空或格式错误");
            return;
          }

          const validItems: KnowledgeItem[] = lines.slice(1).map((line, idx) => {
            const values = line.split(",").map(v => v.replace(/^"|"$/g, "").replace(/""/g, '"'));
            return {
              id: values[0] || `imported_${Date.now()}_${idx}`,
              name: values[1] || "未命名",
              content: values[2] || "",
              keywords: (values[3] || "").split(";").filter(Boolean),
              category: (values[4] as "price" | "info") || "info",
              enabled: values[5] !== "false",
              isHot: values[6] === "true",
              weight: parseFloat(values[7]) || 1,
            };
          });

          const shouldReplace = confirm(
            `导入 ${validItems.length} 条知识。\n\n点击"确定"替换现有知识，\n点击"取消"追加到现有知识。`
          );
          const newItems = shouldReplace ? validItems : [...items, ...validItems];
          await saveKnowledge(newItems);
          setImportMessage(`✅ 成功导入 ${validItems.length} 条知识！`);
        } else {
          setImportMessage("❌ 不支持的文件格式，请使用JSON或CSV");
        }
      } catch (error) {
        console.error("导入失败:", error);
        setImportMessage("❌ 导入失败：文件格式错误");
      }
    };
    reader.readAsText(file);
    // 重置input以允许重复选择同一文件
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  // AI智能整理
  const handleAiOrganize = async () => {
    if (!aiRawText.trim()) return;

    setAiProcessing(true);
    setAiResult(null);

    try {
      const res = await fetch(`/api/merchant/${merchantId}/knowledge/ai-organize`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rawText: aiRawText }),
      });

      const data = await res.json();

      if (data.success) {
        const newItem: KnowledgeItem = {
          id: `ai_${Date.now()}`,
          name: data.data.name || "未命名",
          content: data.data.content || aiRawText,
          keywords: data.data.keywords || [],
          category: data.data.category || "info",
          enabled: true,
          isHot: data.data.isHot || false,
          weight: data.data.weight || 1.0,
        };
        setAiResult(newItem);
      } else {
        alert("AI整理失败，请重试");
      }
    } catch (error) {
      console.error("AI整理失败:", error);
      alert("AI整理失败，请检查网络");
    } finally {
      setAiProcessing(false);
    }
  };

  // 保存AI整理结果
  const handleSaveAiResult = async () => {
    if (!aiResult) return;

    const newItems = [...items, aiResult];
    await saveKnowledge(newItems);

    setShowAiOrganize(false);
    setAiRawText("");
    setAiResult(null);
  };

  // 过滤显示
  const filteredItems = items.filter(
    item =>
      item.name.includes(searchTerm) ||
      item.keywords.some(kw => kw.includes(searchTerm)) ||
      item.content.includes(searchTerm)
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 头部 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">知识库管理</h1>
          <p className="text-sm text-slate-500 mt-1">
            商户: {merchantId} · 共 {items.length} 条知识
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowImportExport(true)}
            className="flex items-center gap-2 px-4 py-2 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
          >
            <Download size={18} />
            导入/导出
          </button>
          <button
            onClick={() => setShowAiOrganize(true)}
            className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
          >
            ✨ AI整理
          </button>
          <button
            onClick={handleAdd}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus size={18} />
            添加知识
          </button>
        </div>
      </div>

      {/* 导入导出弹窗 */}
      {showImportExport && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-xl w-full max-w-md">
            <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
              <h2 className="font-semibold text-lg">📥 导入 / 导出</h2>
              <button
                onClick={() => {
                  setShowImportExport(false);
                  setImportMessage("");
                }}
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-4 space-y-4">
              {/* 导出 */}
              <div>
                <h3 className="font-medium mb-2 flex items-center gap-2">
                  <Download size={16} />
                  导出知识库
                </h3>
                <p className="text-sm text-slate-500 mb-3">导出当前 {items.length} 条知识到文件</p>
                <div className="flex gap-2">
                  <button
                    onClick={handleExportJson}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    <FileJson size={16} />
                    导出 JSON
                  </button>
                  <button
                    onClick={handleExportCsv}
                    className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                  >
                    <FileSpreadsheet size={16} />
                    导出 CSV
                  </button>
                </div>
              </div>

              <hr className="border-slate-200 dark:border-slate-700" />

              {/* 导入 */}
              <div>
                <h3 className="font-medium mb-2 flex items-center gap-2">
                  <Upload size={16} />
                  导入知识库
                </h3>
                <p className="text-sm text-slate-500 mb-3">支持 JSON 或 CSV 格式文件</p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".json,.csv"
                  onChange={handleImportFile}
                  className="hidden"
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-2 px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700"
                >
                  <Upload size={16} />
                  选择文件导入
                </button>
              </div>

              {/* 消息提示 */}
              {importMessage && (
                <div
                  className={`p-3 rounded-lg text-sm ${
                    importMessage.includes("✅")
                      ? "bg-green-50 text-green-700 border border-green-200"
                      : "bg-red-50 text-red-700 border border-red-200"
                  }`}
                >
                  {importMessage}
                </div>
              )}
            </div>

            <div className="p-4 border-t border-slate-200 dark:border-slate-700">
              <button
                onClick={() => {
                  setShowImportExport(false);
                  setImportMessage("");
                }}
                className="w-full py-2 text-slate-600 hover:text-slate-900"
              >
                关闭
              </button>
            </div>
          </div>
        </div>
      )}

      {/* AI整理弹窗 */}
      {showAiOrganize && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-xl w-full max-w-2xl max-h-[90vh] overflow-auto">
            <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
              <h2 className="font-semibold text-lg">✨ AI智能整理</h2>
              <button
                onClick={() => {
                  setShowAiOrganize(false);
                  setAiRawText("");
                  setAiResult(null);
                }}
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-4 space-y-4">
              {/* 输入区 */}
              <div>
                <label className="block text-sm font-medium mb-2">
                  粘贴或输入原始文字，AI会自动整理成知识条目
                </label>
                <textarea
                  value={aiRawText}
                  onChange={e => setAiRawText(e.target.value)}
                  rows={6}
                  placeholder="例如：我们景区门票成人60元，儿童半价30元，65岁以上老人免费..."
                  className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900"
                />
              </div>

              <button
                onClick={handleAiOrganize}
                disabled={!aiRawText.trim() || aiProcessing}
                className="w-full py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 font-medium flex items-center justify-center gap-2"
              >
                {aiProcessing ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                    AI分析中...
                  </>
                ) : (
                  <>✨ 开始AI整理</>
                )}
              </button>

              {/* 结果预览 */}
              {aiResult && (
                <div className="border border-green-200 bg-green-50 dark:bg-green-900/20 rounded-lg p-4 space-y-3">
                  <h3 className="font-medium text-green-700 dark:text-green-400">📝 AI整理结果</h3>

                  <div className="space-y-2 text-sm">
                    <div>
                      <span className="font-medium">标题：</span>
                      <span>{aiResult.name}</span>
                    </div>
                    <div>
                      <span className="font-medium">分类：</span>
                      <span
                        className={`px-2 py-0.5 rounded ${aiResult.category === "price" ? "bg-amber-100 text-amber-700" : "bg-blue-100 text-blue-700"}`}
                      >
                        {aiResult.category === "price" ? "💰 价格" : "ℹ️ 信息"}
                      </span>
                      {aiResult.isHot && <span className="ml-2 text-red-500">🔥 热门</span>}
                    </div>
                    <div>
                      <span className="font-medium">关键词：</span>
                      <span className="text-slate-600">{aiResult.keywords.join(", ")}</span>
                    </div>
                    <div>
                      <span className="font-medium">内容：</span>
                      <p className="text-slate-600 mt-1 whitespace-pre-wrap">{aiResult.content}</p>
                    </div>
                  </div>

                  <button
                    onClick={handleSaveAiResult}
                    disabled={saving}
                    className="w-full py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 font-medium flex items-center justify-center gap-2"
                  >
                    <Save size={16} />
                    {saving ? "保存中..." : "添加到知识库"}
                  </button>
                </div>
              )}
            </div>

            <div className="p-4 border-t border-slate-200 dark:border-slate-700">
              <button
                onClick={() => {
                  setShowAiOrganize(false);
                  setAiRawText("");
                  setAiResult(null);
                }}
                className="w-full py-2 text-slate-600 hover:text-slate-900"
              >
                关闭
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 搜索栏 */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
        <input
          type="text"
          placeholder="搜索知识..."
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          className="w-full pl-10 pr-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800"
        />
      </div>

      {/* 知识列表 */}
      <div className="space-y-3">
        {filteredItems.map(item => (
          <div
            key={item.id}
            className="p-4 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm"
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span
                    className={`px-2 py-0.5 text-xs rounded ${
                      item.category === "price"
                        ? "bg-amber-100 text-amber-700"
                        : "bg-blue-100 text-blue-700"
                    }`}
                  >
                    {item.category === "price" ? "💰 价格" : "ℹ️ 信息"}
                  </span>
                  {item.isHot && <span className="text-red-500">🔥</span>}
                  {!item.enabled && <span className="text-xs text-slate-400">(已禁用)</span>}
                </div>
                <h3 className="mt-1 font-medium text-slate-900 dark:text-white">{item.name}</h3>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-400 line-clamp-2">
                  {item.content}
                </p>
                <div className="mt-2 flex flex-wrap gap-1">
                  {item.keywords.map((kw, idx) => (
                    <span
                      key={idx}
                      className="px-2 py-0.5 text-xs bg-slate-100 dark:bg-slate-700 rounded"
                    >
                      {kw}
                    </span>
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-2 ml-4">
                <button
                  onClick={() => {
                    setEditingItem(item);
                    setIsAdding(false);
                  }}
                  className="p-2 text-slate-400 hover:text-blue-600 transition-colors"
                >
                  <Edit2 size={18} />
                </button>
                <button
                  onClick={() => handleDelete(item.id)}
                  className="p-2 text-slate-400 hover:text-red-600 transition-colors"
                >
                  <Trash2 size={18} />
                </button>
              </div>
            </div>
          </div>
        ))}

        {filteredItems.length === 0 && (
          <div className="text-center py-12 text-slate-400">
            {searchTerm ? "没有找到匹配的知识" : '暂无知识，点击"添加知识"开始录入'}
          </div>
        )}
      </div>

      {/* 编辑弹窗 */}
      {editingItem && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-xl w-full max-w-lg max-h-[90vh] overflow-auto">
            <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
              <h2 className="font-semibold text-lg">{isAdding ? "添加知识" : "编辑知识"}</h2>
              <button
                onClick={() => {
                  setEditingItem(null);
                  setIsAdding(false);
                }}
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-4 space-y-4">
              {/* 名称 */}
              <div>
                <label className="block text-sm font-medium mb-1">名称 *</label>
                <input
                  type="text"
                  value={editingItem.name}
                  onChange={e => setEditingItem({ ...editingItem, name: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900"
                  placeholder="如：景区门票"
                />
              </div>

              {/* 分类 */}
              <div>
                <label className="block text-sm font-medium mb-1">分类 *</label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      checked={editingItem.category === "info"}
                      onChange={() => setEditingItem({ ...editingItem, category: "info" })}
                    />
                    <span>ℹ️ 信息类</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      checked={editingItem.category === "price"}
                      onChange={() => setEditingItem({ ...editingItem, category: "price" })}
                    />
                    <span>💰 价格类</span>
                  </label>
                </div>
              </div>

              {/* 关键词 */}
              <div>
                <label className="block text-sm font-medium mb-1">关键词 * (用逗号分隔)</label>
                <input
                  type="text"
                  value={editingItem.keywords.join(", ")}
                  onChange={e =>
                    setEditingItem({
                      ...editingItem,
                      keywords: e.target.value
                        .split(/[,，]/)
                        .map(s => s.trim())
                        .filter(Boolean),
                    })
                  }
                  className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900"
                  placeholder="门票, 票价, 多少钱"
                />
              </div>

              {/* 内容 */}
              <div>
                <label className="block text-sm font-medium mb-1">回答内容 *</label>
                <textarea
                  value={editingItem.content}
                  onChange={e => setEditingItem({ ...editingItem, content: e.target.value })}
                  rows={4}
                  className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900"
                  placeholder="这是用户问到这个问题时会返回的答案..."
                />
              </div>

              {/* 选项 */}
              <div className="flex items-center gap-6">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={editingItem.enabled}
                    onChange={e => setEditingItem({ ...editingItem, enabled: e.target.checked })}
                  />
                  <span className="text-sm">启用</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={editingItem.isHot || false}
                    onChange={e => setEditingItem({ ...editingItem, isHot: e.target.checked })}
                  />
                  <span className="text-sm">🔥 热门</span>
                </label>
              </div>
            </div>

            <div className="p-4 border-t border-slate-200 dark:border-slate-700 flex justify-end gap-3">
              <button
                onClick={() => {
                  setEditingItem(null);
                  setIsAdding(false);
                }}
                className="px-4 py-2 text-slate-600 hover:text-slate-900"
              >
                取消
              </button>
              <button
                onClick={handleSaveEdit}
                disabled={saving || !editingItem.name || !editingItem.content}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                <Save size={16} />
                {saving ? "保存中..." : "保存"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
