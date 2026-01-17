import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, User, Loader2 } from 'lucide-react';

export const LoginPage = () => {
    const [isLoading, setIsLoading] = useState(false);
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const navigate = useNavigate();

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);

        // 模拟登录请求
        setTimeout(() => {
            setIsLoading(false);
            if (username === 'admin' && password === 'admin') {
                localStorage.setItem('isAuthenticated', 'true');
                navigate('/admin');
            } else {
                alert('账号 admin，密码 admin');
            }
        }, 1000);
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
                        Agent System Login
                    </h1>
                    <p className="text-sm text-slate-500 mt-2">
                        请输入管理员账号登录后台
                    </p>
                </div>

                {/* Form */}
                <form onSubmit={handleLogin} className="p-8 space-y-4">
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-700 dark:text-slate-300">账号</label>
                        <div className="relative">
                            <User className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                            <input
                                type="text"
                                className="w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-400 dark:focus:ring-slate-700 transition-all"
                                placeholder="admin"
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
                        {isLoading ? 'Signing In...' : 'Sign In'}
                    </button>

                    <div className="text-center text-xs text-slate-400 mt-4">
                        默认账号: admin / admin
                    </div>
                </form>
            </div>

            <div className="fixed bottom-6 text-center text-xs text-slate-400">
                Agent 4.0 &copy; 2026 Powered by DeepMind
            </div>
        </div>
    );
};
