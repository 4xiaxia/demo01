import { Outlet, useParams } from "react-router-dom";
import { Sidebar } from "@/components/admin/Sidebar";
import { UserNav } from "@/components/admin/UserNav";
import { Bell, Menu, Store } from "lucide-react";

/**
 * 商家后台布局组件
 *
 * 从路由参数获取 merchantId，传递给所有子页面
 * 设计理念：每个商家有独立的"房间"
 */
export const AdminLayout = () => {
  const { merchantId } = useParams<{ merchantId: string }>();

  // 如果没有商家编码（理论上不会发生，因为路由已经限制）
  if (!merchantId) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>商家编码缺失，请重新登录</p>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-full bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 overflow-hidden">
      {/* Pro Sidebar - 传递商家编码 */}
      <Sidebar merchantId={merchantId} />

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0 h-full">
        {/* Pro Header */}
        <header className="h-16 border-b border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-950/80 backdrop-blur-sm flex items-center px-6 justify-between shrink-0">
          <div className="flex items-center gap-4">
            <button className="md:hidden p-2 -ml-2 text-slate-500">
              <Menu size={20} />
            </button>
            {/* 显示当前商家编码 */}
            <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 dark:bg-blue-900/20 rounded-full">
              <Store size={14} className="text-blue-500" />
              <span className="text-sm font-medium text-blue-600 dark:text-blue-400">
                {merchantId}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <button className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors">
              <Bell size={20} />
            </button>
            <UserNav merchantId={merchantId} />
          </div>
        </header>

        {/* Content Scroll Area */}
        <div className="flex-1 overflow-auto p-6 md:p-8 scroll-smooth">
          <div className="max-w-7xl mx-auto space-y-6">
            {/* Outlet 会自动把 merchantId 通过 context 传递给子路由 */}
            <Outlet context={{ merchantId }} />
          </div>
        </div>
      </main>
    </div>
  );
};
