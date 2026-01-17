import { Outlet } from 'react-router-dom';
import { Sidebar } from '@/components/admin/Sidebar';
import { UserNav } from '@/components/admin/UserNav';
import { Bell, Menu } from 'lucide-react';

export const AdminLayout = () => {
    return (
        <div className="flex h-screen w-full bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 overflow-hidden">
            {/* Pro Sidebar */}
            <Sidebar />

            {/* Main Content Area */}
            <main className="flex-1 flex flex-col min-w-0 h-full">
                {/* Pro Header */}
                <header className="h-16 border-b border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-950/80 backdrop-blur-sm flex items-center px-6 justify-between shrink-0">
                    <div className="flex items-center gap-4">
                        <button className="md:hidden p-2 -ml-2 text-slate-500">
                            <Menu size={20} />
                        </button>
                        {/* Breadcrumb Mock */}
                        <div className="hidden md:flex items-center text-sm text-slate-500">
                            <span className="text-slate-900 dark:text-slate-100 font-medium">Dashboard</span>
                            <span className="mx-2">/</span>
                            <span>Overview</span>
                        </div>
                    </div>

                    <div className="flex items-center gap-4">
                        <button className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors">
                            <Bell size={20} />
                        </button>
                        <UserNav />
                    </div>
                </header>

                {/* Content Scroll Area */}
                <div className="flex-1 overflow-auto p-6 md:p-8 scroll-smooth">
                    <div className="max-w-7xl mx-auto space-y-6">
                        <Outlet />
                    </div>
                </div>
            </main>
        </div>
    );
};
