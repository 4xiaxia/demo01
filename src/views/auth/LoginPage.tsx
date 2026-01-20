import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Lock, User, Loader2, Store } from "lucide-react";

/**
 * 商家后台登录页
 *
 * 设计理念：商家编码 = 文件夹名 = 登录账号 = URL后缀
 *
 * 访问方式：
 * - /login?merchant=dongli → 用 dongli/dongli 登录 → 进入 /merchant/dongli
 * - /login?merchant=xicun  → 用 xicun/xicun 登录  → 进入 /merchant/xicun
 * - /login (无参数)        → 默认 dongli 商家
 */
export const LoginPage = () => {
  const [searchParams] = useSearchParams();
  const merchantId = searchParams.get("merchant") || "dongli";

  const [isLoading, setIsLoading] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    // 模拟登录请求 - 验证商家编码
    setTimeout(() => {
      setIsLoading(false);

      // 账号密码 = 商家编码（物理隔离设计）
      if (username === merchantId && password === merchantId) {
        // 保存认证信息和商家编码
        localStorage.setItem("isAuthenticated", "true");
        localStorage.setItem("merchantId", merchantId);

        // 跳转到该商家的专属后台
        navigate(`/merchant/${merchantId}`);
      } else {
        setError(`账号密码错误！提示: ${merchantId} / ${merchantId}`);
      }
    }, 800);
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-white dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        {/* Header */}
        <div className="p-8 pb-4 text-center border-b border-slate-100 dark:border-slate-800">
          <div className="w-10 h-10 bg-slate-900 rounded-lg mx-auto flex items-center justify-center text-white font-bold mb-4">
            4.0
          </div>
          <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-slate-900 to-slate-600 dark:from-slate-100 dark:to-slate-400">
            商家后台登录
          </h1>

          {/* 显示当前商家编码 */}
          <div className="mt-3 flex items-center justify-center gap-2 px-3 py-1.5 bg-blue-50 dark:bg-blue-900/20 rounded-full">
            <Store size={14} className="text-blue-500" />
            <span className="text-sm font-medium text-blue-600 dark:text-blue-400">
              商家: {merchantId}
            </span>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleLogin} className="p-8 space-y-4">
          {error && (
            <div className="p-3 text-sm text-red-600 bg-red-50 dark:bg-red-900/20 dark:text-red-400 rounded-lg">
              {error}
            </div>
          )}

          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">账号</label>
            <div className="relative">
              <User className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input
                type="text"
                className="w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-400 dark:focus:ring-slate-700 transition-all"
                placeholder={merchantId}
                value={username}
                onChange={e => setUsername(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">密码</label>
            <div className="relative">
              <Lock className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input
                type="password"
                className="w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-400 dark:focus:ring-slate-700 transition-all"
                placeholder="••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
              />
            </div>
          </div>

          <button
            disabled={isLoading}
            className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 dark:bg-slate-50 dark:hover:bg-slate-200 text-white dark:text-slate-900 font-medium rounded-lg transition-all flex items-center justify-center gap-2 mt-4"
          >
            {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
            {isLoading ? "登录中..." : "登录后台"}
          </button>

          <div className="text-center text-xs text-slate-400 mt-4">
            默认账号: {merchantId} / {merchantId}
          </div>
        </form>
      </div>

      <div className="fixed bottom-6 text-center text-xs text-slate-400">
        Agent 4.0 &copy; 2026 · 商家编码 = 账号 = 文件夹
      </div>
    </div>
  );
};
