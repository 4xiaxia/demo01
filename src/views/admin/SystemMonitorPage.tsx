import { Database, Cpu, HardDrive } from "lucide-react";

export default function SystemMonitorPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-900 dark:text-white">系统监控</h1>
        <p className="text-slate-500 dark:text-slate-400 mt-2">查看系统资源使用情况</p>
      </div>

      {/* 系统资源 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <ResourceCard
          icon={<Cpu className="w-6 h-6" />}
          label="CPU使用率"
          value="15%"
          color="text-blue-600"
        />
        <ResourceCard
          icon={<HardDrive className="w-6 h-6" />}
          label="内存使用"
          value="2.1 GB"
          color="text-green-600"
        />
        <ResourceCard
          icon={<Database className="w-6 h-6" />}
          label="数据库连接"
          value="活跃"
          color="text-purple-600"
        />
      </div>

      {/* ANP Bus状态 */}
      <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-slate-200 dark:border-slate-700">
        <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-4">ANP任务池状态</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center p-4 bg-slate-50 dark:bg-slate-900/50 rounded-lg">
            <div className="text-2xl font-bold text-slate-900 dark:text-white">0</div>
            <div className="text-sm text-slate-500">待处理</div>
          </div>
          <div className="text-center p-4 bg-slate-50 dark:bg-slate-900/50 rounded-lg">
            <div className="text-2xl font-bold text-slate-900 dark:text-white">0</div>
            <div className="text-sm text-slate-500">处理中</div>
          </div>
          <div className="text-center p-4 bg-slate-50 dark:bg-slate-900/50 rounded-lg">
            <div className="text-2xl font-bold text-slate-900 dark:text-white">0</div>
            <div className="text-sm text-slate-500">已完成</div>
          </div>
          <div className="text-center p-4 bg-slate-50 dark:bg-slate-900/50 rounded-lg">
            <div className="text-2xl font-bold text-slate-900 dark:text-white">0</div>
            <div className="text-sm text-slate-500">失败</div>
          </div>
        </div>
      </div>

      {/* Context Pool状态 */}
      <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-slate-200 dark:border-slate-700">
        <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-4">上下文池状态</h2>
        <div className="space-y-2">
          <div className="flex justify-between items-center p-3 bg-slate-50 dark:bg-slate-900/50 rounded-lg">
            <span className="text-slate-700 dark:text-slate-300">活跃会话数</span>
            <span className="font-semibold text-slate-900 dark:text-white">0</span>
          </div>
          <div className="flex justify-between items-center p-3 bg-slate-50 dark:bg-slate-900/50 rounded-lg">
            <span className="text-slate-700 dark:text-slate-300">缓存TTL</span>
            <span className="font-semibold text-slate-900 dark:text-white">24小时</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function ResourceCard({
  icon,
  label,
  value,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  color: string;
}) {
  return (
    <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-slate-200 dark:border-slate-700">
      <div className="flex items-center gap-3 mb-3">
        <div className={`${color}`}>{icon}</div>
        <span className="text-sm text-slate-500">{label}</span>
      </div>
      <div className="text-2xl font-bold text-slate-900 dark:text-white">{value}</div>
    </div>
  );
}
