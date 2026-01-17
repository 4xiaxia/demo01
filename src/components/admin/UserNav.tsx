import { useState } from "react";
import { LogOut, Settings, UserCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useNavigate } from 'react-router-dom';

export function UserNav() {
    const [isOpen, setIsOpen] = useState(false);
    const navigate = useNavigate();

    const handleLogout = () => {
        localStorage.removeItem('isAuthenticated');
        navigate('/login');
    };

    return (
        <div className="relative">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-2 p-1 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors focus:outline-none focus:ring-2 focus:ring-slate-400"
            >
                <div className="h-8 w-8 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center overflow-hidden border border-slate-300 dark:border-slate-600">
                    <span className="font-bold text-xs text-slate-600 dark:text-slate-300">AD</span>
                </div>
            </button>

            {isOpen && (
                <>
                    <div
                        className="fixed inset-0 z-40"
                        onClick={() => setIsOpen(false)}
                    />
                    <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-slate-950 rounded-md shadow-lg border border-slate-200 dark:border-slate-800 z-50 py-1 animate-in fade-in zoom-in-95 duration-200">
                        <div className="px-3 py-2 border-b border-slate-100 dark:border-slate-800">
                            <p className="text-sm font-medium">Admin User</p>
                            <p className="text-xs text-slate-500 truncate">admin@example.com</p>
                        </div>
                        <div className="py-1">
                            <MenuItem icon={<UserCircle size={14} />} label="个人资料" />
                            <MenuItem icon={<Settings size={14} />} label="设置" />
                        </div>
                        <div className="border-t border-slate-100 dark:border-slate-800 py-1">
                            <MenuItem icon={<LogOut size={14} />} label="退出登录" danger onClick={handleLogout} />
                        </div>
                    </div>
                </>
            )}
        </div>
    )
}

function MenuItem({ icon, label, danger, onClick }: { icon: React.ReactNode, label: string, danger?: boolean, onClick?: () => void }) {
    return (
        <button
            onClick={onClick}
            className={cn(
                "w-full flex items-center gap-2 px-3 py-1.5 text-sm transition-colors",
                danger
                    ? "text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                    : "text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
            )}>
            {icon}
            {label}
        </button>
    );
}
