import React from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { configManager } from '@/core/config-manager';

interface ChatLayoutProps {
    children: React.ReactNode;
    title?: string | React.ReactNode;
    onSettingsClick?: () => void;
}

export const ChatLayout = ({ children, title, onSettingsClick }: ChatLayoutProps) => {
    // 获取当前商户配置的主题色，如果没有则用默认的蓝色
    const config = configManager.getConfig();
    const primaryColor = config?.theme?.primaryColor || '#3170f9ff';

    // 动态生成极光背景的渐变色
    // 我们用三个移动的 blobs 来模拟极光

    return (
        <div className="relative w-full h-screen overflow-hidden bg-slate-900 text-white font-sans selection:bg-pink-500/30">
            {/* 1. 梦幻极光背景 (Aurora Background) */}
            <div className="absolute inset-0 pointer-events-none z-0">
                {/* 主背景底色 */}
                <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-[#0f172a] to-slate-900" />

                {/* 极光光斑 1 (主色调) */}
                <motion.div
                    animate={{
                        x: [0, 100, 0],
                        y: [0, -50, 0],
                        scale: [1, 1.2, 1],
                        opacity: [0.3, 0.5, 0.3],
                    }}
                    transition={{
                        duration: 10,
                        repeat: Infinity,
                        ease: "easeInOut"
                    }}
                    className="absolute top-[-20%] left-[-10%] w-[80vw] h-[80vw] rounded-full blur-[100px]"
                    style={{ background: `radial-gradient(circle, ${primaryColor} 0%, transparent 70%)` }}
                />

                {/* 极光光斑 2 (互补色 - 紫色/粉色) */}
                <motion.div
                    animate={{
                        x: [0, -100, 0],
                        y: [0, 100, 0],
                        scale: [1, 1.3, 1],
                    }}
                    transition={{
                        duration: 15,
                        repeat: Infinity,
                        ease: "easeInOut",
                        delay: 2
                    }}
                    className="absolute bottom-[-20%] right-[-10%] w-[70vw] h-[70vw] rounded-full blur-[120px] bg-purple-600/30"
                />

                {/* 极光光斑 3 (提亮 - 青色) */}
                <motion.div
                    animate={{
                        x: [0, 50, -50, 0],
                        y: [0, 50, 0],
                    }}
                    transition={{
                        duration: 12,
                        repeat: Infinity,
                        ease: "easeInOut",
                        delay: 5
                    }}
                    className="absolute top-[30%] left-[30%] w-[50vw] h-[50vw] rounded-full blur-[100px] bg-cyan-500/20"
                />

                {/* 噪点纹理 (增加质感) */}
                <div className="absolute inset-0 opacity-[0.03] bg-[url('https://grainy-gradients.vercel.app/noise.svg')] mix-blend-overlay"></div>
            </div>

            {/* 2. 玻璃容器 (Glass Container) */}
            <div className="relative z-10 w-full h-full flex flex-col items-center justify-center p-4 md:p-8">
                <motion.div
                    initial={{ opacity: 0, y: 20, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{ duration: 0.6, ease: "easeOut" }}
                    className={cn(
                        "w-full max-w-5xl h-full max-h-[90vh]",
                        "rounded-[2rem] border border-white/10 shadow-2xl",
                        "bg-white/5 backdrop-blur-xl", // 核心玻璃效果
                        "flex flex-col overflow-hidden",
                        "relative" // For headers/footers positioning
                    )}
                >
                    {/* Header */}
                    <header className="flex-none px-8 py-5 border-b border-white/5 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-3 h-3 rounded-full bg-red-400/80 shadow-[0_0_10px_rgba(248,113,113,0.5)]" />
                            <div className="w-3 h-3 rounded-full bg-yellow-400/80 shadow-[0_0_10px_rgba(250,204,21,0.5)]" />
                            <div className="w-3 h-3 rounded-full bg-green-400/80 shadow-[0_0_10px_rgba(74,222,128,0.5)]" />
                            <div className="ml-4 text-white/70 font-medium tracking-wide text-sm uppercase">
                                {typeof title === 'string' ? (title || config?.name || 'Smart Agent 4.0') : (title || <span>{config?.name || 'Smart Agent 4.0'}</span>)}
                            </div>
                        </div>
                        <div className="flex items-center gap-4">
                            {onSettingsClick && (
                                <button
                                    onClick={onSettingsClick}
                                    className="text-white/50 hover:text-white transition-colors"
                                >
                                    ⚙️
                                </button>
                            )}
                            <div className="text-white/30 text-xs">
                                {config?.merchantId || 'Demo System'}
                            </div>
                        </div>
                    </header>

                    {/* Content Area */}
                    <main className="flex-1 min-h-0 relative">
                        {children}
                    </main>

                </motion.div>
            </div>
        </div>
    );
};
