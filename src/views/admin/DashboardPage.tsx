import { Link } from "react-router-dom";
import { Settings, BookOpen, Activity } from "lucide-react";

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-900 dark:text-white">管理后台</h1>
        <p className="text-slate-500 dark:text-slate-400 mt-2">智能导游系统 4.0 - 东里村景区</p>
      </div>

      {/* 快捷入口 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Link
          to="/admin/config"
          className="block p-6 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-blue-500 dark:hover:border-blue-500 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
              <Settings className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-900 dark:text-white">配置生成器</h3>
              <p className="text-sm text-slate-500">API、Prompt、主题设置</p>
            </div>
          </div>
        </Link>

        <Link
          to="/admin/knowledge"
          className="block p-6 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-green-500 dark:hover:border-green-500 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="p-3 bg-green-100 dark:bg-green-900/30 rounded-lg">
              <BookOpen className="w-6 h-6 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-900 dark:text-white">知识库</h3>
              <p className="text-sm text-slate-500">编辑知识条目、批量导入</p>
            </div>
          </div>
        </Link>

        <Link
          to="/admin/monitor"
          className="block p-6 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-purple-500 dark:hover:border-purple-500 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="p-3 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
              <Activity className="w-6 h-6 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-900 dark:text-white">监控面板</h3>
              <p className="text-sm text-slate-500">查看日志、统计、报缺</p>
            </div>
          </div>
        </Link>
      </div>

      {/* 系统状态 */}
      <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-slate-200 dark:border-slate-700">
        <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-4">系统状态</h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <StatCard label="Agent A" value="运行中" color="bg-green-100 text-green-600" />
          <StatCard label="Agent B" value="运行中" color="bg-green-100 text-green-600" />
          <StatCard label="Agent C" value="运行中" color="bg-green-100 text-green-600" />
          <StatCard label="Agent D" value="运行中" color="bg-green-100 text-green-600" />
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
              <p className="text-slate-700 dark:text-slate-300">访问前台页面开始测试</p>
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
