import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Settings, BookOpen, Activity, Zap, Store } from "lucide-react";
import { configManager } from "@/core/config-manager";
import { useMerchantId } from "@/hooks/useMerchantId";

export default function DashboardPage() {
  const merchantId = useMerchantId();
  const basePath = `/merchant/${merchantId}`;
  const [siteName, setSiteName] = useState("智能导游系统");

  useEffect(() => {
    const loadConfig = async () => {
      try {
        const config = await configManager.loadConfig();
        setSiteName(config.theme?.title || config.name || "智能导游系统");
      } catch {
        // 使用默认值
      }
    };
    loadConfig();
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-3">
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white">管理后台</h1>
          <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 dark:bg-blue-900/20 rounded-full">
            <Store size={14} className="text-blue-500" />
            <span className="text-sm font-medium text-blue-600 dark:text-blue-400">
              {merchantId}
            </span>
          </div>
        </div>
        <p className="text-slate-500 dark:text-slate-400 mt-2">智能导游系统 4.0 - {siteName}</p>
      </div>

      {/* 快捷入口 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Link
          to={`${basePath}/config`}
          className="block p-6 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-blue-500 dark:hover:border-blue-500 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
              <Settings className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-900 dark:text-white">配置生成器</h3>
              <p className="text-sm text-slate-500">API、Prompt、主题</p>
            </div>
          </div>
        </Link>

        <Link
          to={`${basePath}/knowledge`}
          className="block p-6 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-green-500 dark:hover:border-green-500 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="p-3 bg-green-100 dark:bg-green-900/30 rounded-lg">
              <BookOpen className="w-6 h-6 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-900 dark:text-white">知识库</h3>
              <p className="text-sm text-slate-500">编辑、导入导出</p>
            </div>
          </div>
        </Link>

        <Link
          to={`${basePath}/hot-questions`}
          className="block p-6 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-orange-500 dark:hover:border-orange-500 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="p-3 bg-orange-100 dark:bg-orange-900/30 rounded-lg">
              <Zap className="w-6 h-6 text-orange-600 dark:text-orange-400" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-900 dark:text-white">热门问题</h3>
              <p className="text-sm text-slate-500">缓存答案管理</p>
            </div>
          </div>
        </Link>

        <Link
          to={`${basePath}/monitor`}
          className="block p-6 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-purple-500 dark:hover:border-purple-500 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="p-3 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
              <Activity className="w-6 h-6 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-900 dark:text-white">监控面板</h3>
              <p className="text-sm text-slate-500">日志、统计、报缺</p>
            </div>
          </div>
        </Link>
      </div>

      {/* 系统状态 */}
      <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-slate-200 dark:border-slate-700">
        <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-4">系统状态</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard label="Agent A (意图识别)" value="运行中" color="bg-green-100 text-green-600" />
          <StatCard label="Agent B (决策中心)" value="运行中" color="bg-green-100 text-green-600" />
          <StatCard label="Agent C (知识库)" value="运行中" color="bg-green-100 text-green-600" />
          <StatCard label="Agent D (监控)" value="运行中" color="bg-green-100 text-green-600" />
        </div>
      </div>

      {/* 快速开始 */}
      <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-slate-200 dark:border-slate-700">
        <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-4">快速开始</h2>
        <div className="space-y-3">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 w-6 h-6 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center text-blue-600 dark:text-blue-400 text-sm font-semibold">
              1
            </div>
            <div>
              <p className="text-slate-700 dark:text-slate-300">
                在<strong>配置生成器</strong>中设置AI模型、Prompt和主题
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 w-6 h-6 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center text-blue-600 dark:text-blue-400 text-sm font-semibold">
              2
            </div>
            <div>
              <p className="text-slate-700 dark:text-slate-300">
                在<strong>知识库</strong>中录入常见问答（价格、信息等）
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 w-6 h-6 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center text-blue-600 dark:text-blue-400 text-sm font-semibold">
              3
            </div>
            <div>
              <p className="text-slate-700 dark:text-slate-300">
                访问前台页面测试：
                <a
                  href={`/chat?merchant=${merchantId}&userId=test&mode=text`}
                  className="ml-2 text-blue-600 hover:underline"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  /chat?merchant={merchantId}
                </a>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="p-4 bg-slate-50 dark:bg-slate-900/50 rounded-lg">
      <div className="text-sm text-slate-500 dark:text-slate-400 mb-1">{label}</div>
      <div className={`text-lg font-semibold ${color}`}>{value}</div>
    </div>
  );
}
