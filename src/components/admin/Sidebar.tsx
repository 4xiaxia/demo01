import { NavLink } from "react-router-dom";
import { cn } from "@/lib/utils";
import { LayoutDashboard, Database, Settings, MessageSquare, Activity } from "lucide-react";
import { useState } from "react";

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside
      className={cn(
        "relative border-r border-slate-200 dark:border-slate-800 flex flex-col bg-white dark:bg-slate-950 transition-all duration-300",
        collapsed ? "w-16" : "w-64"
      )}
    >
      {/* Header */}
      <div className="h-16 flex items-center px-4 border-b border-slate-200 dark:border-slate-800 justify-between">
        {!collapsed && (
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-slate-900 rounded-md flex items-center justify-center text-white font-bold text-xs">
              4.0
            </div>
            <span className="font-bold text-lg tracking-tight">商家后台</span>
          </div>
        )}
        {collapsed && (
          <div className="w-full flex justify-center">
            <div className="w-8 h-8 bg-slate-900 rounded-md flex items-center justify-center text-white font-bold text-xs">
              4.0
            </div>
          </div>
        )}

        <button
          onClick={() => setCollapsed(!collapsed)}
          className={cn(
            "p-1.5 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500",
            collapsed
              ? "absolute -right-3 top-20 bg-white border shadow-sm rounded-full hidden"
              : "ml-auto"
          )}
        ></button>
      </div>

      {/* Nav */}
      <nav className="flex-1 p-3 space-y-1">
        <NavItem to="/admin" end icon={<LayoutDashboard size={20} />} collapsed={collapsed}>
          仪表盘
        </NavItem>

        {/* 分隔线 */}
        {!collapsed && (
          <div className="pt-2 pb-1 px-3 text-xs font-medium text-slate-400 uppercase">
            功能模块
          </div>
        )}

        <NavItem to="/admin/config" icon={<Settings size={20} />} collapsed={collapsed}>
          ⚙️ 配置生成器
        </NavItem>
        <NavItem to="/admin/knowledge" icon={<Database size={20} />} collapsed={collapsed}>
          📚 知识库
        </NavItem>
        <NavItem to="/admin/hot-questions" icon={<Activity size={20} />} collapsed={collapsed}>
          🔥 热门问题
        </NavItem>
        <NavItem to="/admin/monitor" icon={<Activity size={20} />} collapsed={collapsed}>
          📈 监控面板
        </NavItem>
      </nav>

      {/* Footer */}
      <div className="p-3 border-t border-slate-200 dark:border-slate-800">
        <NavLink
          to="/"
          className={cn(
            "flex items-center gap-3 px-3 py-2 text-sm font-medium text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 transition-colors rounded-lg hover:bg-slate-50 dark:hover:bg-slate-900",
            collapsed && "justify-center px-0"
          )}
        >
          <MessageSquare size={18} />
          {!collapsed && <span>返回前台</span>}
        </NavLink>
      </div>
    </aside>
  );
}

function NavItem({
  to,
  children,
  icon,
  end,
  collapsed,
}: {
  to: string;
  children: React.ReactNode;
  icon: React.ReactNode;
  end?: boolean;
  collapsed: boolean;
}) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }: { isActive: boolean }) =>
        cn(
          "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-all duration-200",
          isActive
            ? "bg-slate-900 text-slate-50 dark:bg-slate-50 dark:text-slate-900"
            : "text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800",
          collapsed && "justify-center px-0"
        )
      }
      title={typeof children === "string" ? children : undefined}
    >
      {icon}
      {!collapsed && children}
    </NavLink>
  );
}
