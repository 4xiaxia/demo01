/**
 * 第一部分：配置文件生成器
 * 
 * 功能：
 * 1. 当前信息展示
 * 2. 三种使用方式说明
 * 3. ASR/TTS/LLM模型配置
 * 4. Prompt设置
 * 5. 生成并保存配置文件
 */

import { useState, useEffect, useCallback } from 'react';
import { configManager } from '@/core/config-manager';
import { Save, Copy, Check, ExternalLink, ChevronDown, ChevronUp } from 'lucide-react';

interface FullConfig {
    merchantId: string;
    name: string;
    avatar: string;
    registeredAt?: string;
    template?: string;
    defaultInputType: 'voice' | 'text';
    apiSource: 'custom' | 'system';
    asr: {
        provider: 'zhipu' | 'aliyun';
        model: string;
        apiUrl: string;
        apiKey: string;
    };
    tts: {
        provider: 'zhipu' | 'aliyun' | 'microsoft';
        model: string;
        apiUrl: string;
        apiKey: string;
    };
    llm: {
        provider: 'zhipu' | 'dashscope' | 'siliconflow';
        model: string;
        apiUrl: string;
        apiKey: string;
    };
    prompts: {
        system: string;
        welcome: string;
    };
    theme: {
        primaryColor: string;
        title: string;
    };
}

const DEFAULT_CONFIG: FullConfig = {
    merchantId: '',
    name: '智能导游',
    avatar: '🏪',
    registeredAt: new Date().toISOString().split('T')[0].replace(/-/g, '.'),
    template: '模板一',
    defaultInputType: 'text',
    apiSource: 'system',
    asr: {
        provider: 'zhipu',
        model: 'glm-asr-2512',
        apiUrl: 'https://open.bigmodel.cn/api/paas/v4',
        apiKey: ''
    },
    tts: {
        provider: 'zhipu',
        model: 'glm-tts',
        apiUrl: 'https://open.bigmodel.cn/api/paas/v4',
        apiKey: ''
    },
    llm: {
        provider: 'zhipu',
        model: 'glm-4-flash',
        apiUrl: 'https://open.bigmodel.cn/api/paas/v4',
        apiKey: ''
    },
    prompts: {
        system: '你是一个友好的智能导游助手，请简洁准确地回答用户问题。回复控制在100字以内。',
        welcome: '你好，有什么可以帮您的？'
    },
    theme: {
        primaryColor: '#2563eb',
        title: '智能导游'
    }
};

export const ConfigGeneratorPage = () => {
    const [config, setConfig] = useState<FullConfig>(DEFAULT_CONFIG);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState('');
    const [copied, setCopied] = useState(false);
    const [expandedSection, setExpandedSection] = useState<string | null>('usage');
    
    const merchantId = configManager.getMerchantId();
    const frontendUrl = `${window.location.origin}/?merchant=${merchantId}`;

    // 加载配置
    const loadConfig = useCallback(async () => {
        setLoading(true);
        try {
            const res = await fetch(`/api/merchant/${merchantId}/config`);
            if (res.ok) {
                const data = await res.json();
                setConfig({
                    ...DEFAULT_CONFIG,
                    ...data,
                    merchantId,
                    asr: { ...DEFAULT_CONFIG.asr, ...data.asr },
                    tts: { ...DEFAULT_CONFIG.tts, ...data.tts },
                    llm: { ...DEFAULT_CONFIG.llm, ...data.llm },
                    prompts: { ...DEFAULT_CONFIG.prompts, ...data.prompts },
                    theme: { ...DEFAULT_CONFIG.theme, ...data.theme }
                });
            }
        } catch (e) {
            console.error('加载配置失败:', e);
        } finally {
            setLoading(false);
        }
    }, [merchantId]);

    useEffect(() => {
        loadConfig();
    }, [loadConfig]);

    // 保存配置
    const handleSave = async () => {
        setSaving(true);
        setMessage('');
        
        try {
            // 转换为服务端格式
            const serverConfig = {
                merchantId: config.merchantId,
                name: config.name,
                avatar: config.avatar,
                api: {
                    provider: config.llm.provider,
                    apiKey: config.llm.apiKey,
                    model: config.llm.model
                },
                prompts: config.prompts,
                theme: config.theme,
                // 扩展字段
                asr: config.asr,
                tts: config.tts,
                defaultInputType: config.defaultInputType,
                apiSource: config.apiSource
            };
            
            const res = await fetch(`/api/merchant/${merchantId}/config`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(serverConfig)
            });
            
            if (res.ok) {
                setMessage('✅ 配置已保存并实时生效！');
                await configManager.reloadConfig();
            } else {
                setMessage('❌ 保存失败');
            }
        } catch (e) {
            setMessage('❌ 保存失败: ' + e);
        } finally {
            setSaving(false);
        }
    };

    // 复制URL
    const handleCopyUrl = () => {
        navigator.clipboard.writeText(frontendUrl);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    // 切换折叠
    const toggleSection = (section: string) => {
        setExpandedSection(expandedSection === section ? null : section);
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
        );
    }

    return (
        <div className="space-y-6 max-w-4xl">
            {/* 头部 */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
                        ⚙️ 配置文件生成器
                    </h1>
                    <p className="text-sm text-slate-500 mt-1">
                        配置完成后点击保存，将实时生效
                    </p>
                </div>
                <button
                    onClick={handleSave}
                    disabled={saving}
                    className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium"
                >
                    <Save size={18} />
                    {saving ? '保存中...' : '💾 实时生效并保存'}
                </button>
            </div>

            {message && (
                <div className={`p-4 rounded-lg ${message.includes('✅') ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
                    {message}
                </div>
            )}

            {/* 当前信息 */}
            <section className="bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-slate-800 dark:to-slate-800 rounded-xl p-6 border border-emerald-200 dark:border-slate-700">
                <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                    🍀 当前信息
                </h2>
                <div className="grid grid-cols-3 gap-4 text-sm">
                    <div>
                        <span className="text-slate-500">商户编号:</span>
                        <span className="ml-2 font-mono font-medium">{merchantId}</span>
                    </div>
                    <div>
                        <span className="text-slate-500">注册时间:</span>
                        <span className="ml-2">{config.registeredAt}</span>
                    </div>
                    <div>
                        <span className="text-slate-500">前台样式:</span>
                        <span className="ml-2">{config.template}</span>
                    </div>
                </div>
            </section>

            {/* 使用说明 */}
            <section className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                <button
                    onClick={() => toggleSection('usage')}
                    className="w-full p-4 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-700"
                >
                    <h2 className="text-lg font-semibold flex items-center gap-2">
                        👉 使用说明
                    </h2>
                    {expandedSection === 'usage' ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                </button>
                
                {expandedSection === 'usage' && (
                    <div className="p-6 pt-0 space-y-4">
                        {/* 默认输入方式 */}
                        <div className="flex items-center gap-4 p-3 bg-slate-50 dark:bg-slate-700 rounded-lg">
                            <span className="text-sm font-medium">默认使用:</span>
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                    type="radio"
                                    checked={config.defaultInputType === 'text'}
                                    onChange={() => setConfig({...config, defaultInputType: 'text'})}
                                    className="w-4 h-4 text-blue-600"
                                />
                                <span>⌨️ 文字</span>
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                    type="radio"
                                    checked={config.defaultInputType === 'voice'}
                                    onChange={() => setConfig({...config, defaultInputType: 'voice'})}
                                    className="w-4 h-4 text-blue-600"
                                />
                                <span>🎤 语音</span>
                            </label>
                        </div>

                        {/* 方式一 */}
                        <div className="p-4 border border-blue-200 dark:border-blue-800 rounded-lg bg-blue-50 dark:bg-blue-900/20">
                            <h3 className="font-medium text-blue-700 dark:text-blue-300 mb-2">📌 方式一: 直接使用</h3>
                            <p className="text-sm text-slate-600 dark:text-slate-400 mb-2">
                                前台客服地址（可直接 iframe 引用或跳转）
                            </p>
                            <div className="flex items-center gap-2">
                                <input
                                    type="text"
                                    value={frontendUrl}
                                    readOnly
                                    className="flex-1 px-3 py-2 text-sm font-mono bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded"
                                />
                                <button
                                    onClick={handleCopyUrl}
                                    className="flex items-center gap-1 px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm"
                                >
                                    {copied ? <Check size={16} /> : <Copy size={16} />}
                                    {copied ? '已复制' : '复制'}
                                </button>
                                <a
                                    href={frontendUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="p-2 text-blue-600 hover:bg-blue-100 rounded"
                                >
                                    <ExternalLink size={18} />
                                </a>
                            </div>
                        </div>

                        {/* 方式二 */}
                        <div className="p-4 border border-slate-200 dark:border-slate-600 rounded-lg">
                            <h3 className="font-medium mb-2">📌 方式二: 接入自己已有系统 (API对接)</h3>
                            <pre className="text-sm bg-slate-100 dark:bg-slate-700 p-3 rounded overflow-x-auto">
{`POST /api/chat
Content-Type: application/json

{
  "merchantId": "${merchantId}",
  "userId": "用户UUID",
  "message": "用户输入",
  "inputType": "text" // 或 "voice"
}`}
                            </pre>
                        </div>

                        {/* 方式三 */}
                        <div className="p-4 border border-slate-200 dark:border-slate-600 rounded-lg opacity-60">
                            <h3 className="font-medium mb-2">📌 方式三: 接入扣子/企微客服 (二期)</h3>
                            <p className="text-sm text-slate-500">敬请期待...</p>
                        </div>
                    </div>
                )}
            </section>

            {/* 配置参数 */}
            <section className="bg-white dark:bg-slate-800 rounded-xl p-6 border border-slate-200 dark:border-slate-700 space-y-6">
                <h2 className="text-lg font-semibold flex items-center gap-2">
                    👀 配置参数
                </h2>

                {/* API来源 */}
                <div className="flex items-center gap-6 p-4 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800">
                    <span className="font-medium">API来源:</span>
                    <label className="flex items-center gap-2 cursor-pointer">
                        <input
                            type="radio"
                            checked={config.apiSource === 'custom'}
                            onChange={() => setConfig({...config, apiSource: 'custom'})}
                            className="w-4 h-4"
                        />
                        <span>商家自填</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                        <input
                            type="radio"
                            checked={config.apiSource === 'system'}
                            onChange={() => setConfig({...config, apiSource: 'system'})}
                            className="w-4 h-4"
                        />
                        <span>系统默认</span>
                    </label>
                    <span className="text-xs text-amber-600 dark:text-amber-400">
                        (注: 使用系统的每月限制用量，建议使用自己的)
                    </span>
                </div>

                {/* ASR配置 */}
                <div className="p-4 border border-slate-200 dark:border-slate-600 rounded-lg space-y-4">
                    <h3 className="font-medium flex items-center gap-2">☀️ 语音识别模型 (ASR)</h3>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium mb-1">服务商</label>
                            <div className="flex gap-4">
                                <label className="flex items-center gap-2">
                                    <input
                                        type="radio"
                                        checked={config.asr.provider === 'zhipu'}
                                        onChange={() => setConfig({...config, asr: {...config.asr, provider: 'zhipu', model: 'glm-asr-2512'}})}
                                    />
                                    智谱 GLM-ASR
                                </label>
                                <label className="flex items-center gap-2">
                                    <input
                                        type="radio"
                                        checked={config.asr.provider === 'aliyun'}
                                        onChange={() => setConfig({...config, asr: {...config.asr, provider: 'aliyun', model: 'paraformer-v2'}})}
                                    />
                                    阿里 Paraformer
                                </label>
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-1">模型</label>
                            <input
                                type="text"
                                value={config.asr.model}
                                onChange={e => setConfig({...config, asr: {...config.asr, model: e.target.value}})}
                                className="w-full px-3 py-2 border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900"
                                disabled={config.apiSource === 'system'}
                            />
                        </div>
                    </div>
                    {config.apiSource === 'custom' && (
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium mb-1">API URL</label>
                                <input
                                    type="text"
                                    value={config.asr.apiUrl}
                                    onChange={e => setConfig({...config, asr: {...config.asr, apiUrl: e.target.value}})}
                                    className="w-full px-3 py-2 border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1">API Key</label>
                                <input
                                    type="password"
                                    value={config.asr.apiKey}
                                    onChange={e => setConfig({...config, asr: {...config.asr, apiKey: e.target.value}})}
                                    className="w-full px-3 py-2 border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900"
                                />
                            </div>
                        </div>
                    )}
                </div>

                {/* TTS配置 */}
                <div className="p-4 border border-slate-200 dark:border-slate-600 rounded-lg space-y-4">
                    <h3 className="font-medium flex items-center gap-2">☀️ 语音输出模型 (TTS)</h3>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium mb-1">服务商</label>
                            <div className="flex gap-4 flex-wrap">
                                <label className="flex items-center gap-2">
                                    <input
                                        type="radio"
                                        checked={config.tts.provider === 'zhipu'}
                                        onChange={() => setConfig({...config, tts: {...config.tts, provider: 'zhipu', model: 'glm-tts'}})}
                                    />
                                    智谱 GLM-TTS
                                </label>
                                <label className="flex items-center gap-2">
                                    <input
                                        type="radio"
                                        checked={config.tts.provider === 'aliyun'}
                                        onChange={() => setConfig({...config, tts: {...config.tts, provider: 'aliyun', model: 'cosyvoice-v1'}})}
                                    />
                                    阿里 CosyVoice
                                </label>
                                <label className="flex items-center gap-2">
                                    <input
                                        type="radio"
                                        checked={config.tts.provider === 'microsoft'}
                                        onChange={() => setConfig({...config, tts: {...config.tts, provider: 'microsoft', model: 'zh-CN-XiaoxiaoNeural'}})}
                                    />
                                    微软(免费)
                                </label>
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-1">模型/音色</label>
                            <input
                                type="text"
                                value={config.tts.model}
                                onChange={e => setConfig({...config, tts: {...config.tts, model: e.target.value}})}
                                className="w-full px-3 py-2 border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900"
                                disabled={config.apiSource === 'system'}
                            />
                        </div>
                    </div>
                    {config.apiSource === 'custom' && config.tts.provider !== 'microsoft' && (
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium mb-1">API URL</label>
                                <input
                                    type="text"
                                    value={config.tts.apiUrl}
                                    onChange={e => setConfig({...config, tts: {...config.tts, apiUrl: e.target.value}})}
                                    className="w-full px-3 py-2 border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1">API Key</label>
                                <input
                                    type="password"
                                    value={config.tts.apiKey}
                                    onChange={e => setConfig({...config, tts: {...config.tts, apiKey: e.target.value}})}
                                    className="w-full px-3 py-2 border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900"
                                />
                            </div>
                        </div>
                    )}
                </div>

                {/* LLM配置 */}
                <div className="p-4 border border-slate-200 dark:border-slate-600 rounded-lg space-y-4">
                    <h3 className="font-medium flex items-center gap-2">☀️ 通用对话模型 (LLM)</h3>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium mb-1">服务商</label>
                            <div className="flex gap-4 flex-wrap">
                                <label className="flex items-center gap-2">
                                    <input
                                        type="radio"
                                        checked={config.llm.provider === 'zhipu'}
                                        onChange={() => setConfig({...config, llm: {...config.llm, provider: 'zhipu', model: 'glm-4-flash'}})}
                                    />
                                    智谱
                                </label>
                                <label className="flex items-center gap-2">
                                    <input
                                        type="radio"
                                        checked={config.llm.provider === 'dashscope'}
                                        onChange={() => setConfig({...config, llm: {...config.llm, provider: 'dashscope', model: 'qwen-turbo'}})}
                                    />
                                    阿里通义
                                </label>
                                <label className="flex items-center gap-2">
                                    <input
                                        type="radio"
                                        checked={config.llm.provider === 'siliconflow'}
                                        onChange={() => setConfig({...config, llm: {...config.llm, provider: 'siliconflow', model: 'Qwen/Qwen2.5-7B-Instruct'}})}
                                    />
                                    硅基流动
                                </label>
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-1">模型</label>
                            <input
                                type="text"
                                value={config.llm.model}
                                onChange={e => setConfig({...config, llm: {...config.llm, model: e.target.value}})}
                                className="w-full px-3 py-2 border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900"
                                disabled={config.apiSource === 'system'}
                            />
                        </div>
                    </div>
                    {config.apiSource === 'custom' && (
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium mb-1">API URL</label>
                                <input
                                    type="text"
                                    value={config.llm.apiUrl}
                                    onChange={e => setConfig({...config, llm: {...config.llm, apiUrl: e.target.value}})}
                                    className="w-full px-3 py-2 border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1">API Key</label>
                                <input
                                    type="password"
                                    value={config.llm.apiKey}
                                    onChange={e => setConfig({...config, llm: {...config.llm, apiKey: e.target.value}})}
                                    className="w-full px-3 py-2 border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900"
                                />
                            </div>
                        </div>
                    )}
                </div>

                {/* Prompt设置 */}
                <div className="p-4 border border-slate-200 dark:border-slate-600 rounded-lg space-y-4">
                    <h3 className="font-medium flex items-center gap-2">✍🏻 Prompt 设置</h3>
                    <div>
                        <label className="block text-sm font-medium mb-1">系统提示词 (System Prompt)</label>
                        <textarea
                            value={config.prompts.system}
                            onChange={e => setConfig({...config, prompts: {...config.prompts, system: e.target.value}})}
                            rows={4}
                            className="w-full px-3 py-2 border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900"
                            placeholder="定义AI的角色和行为规则..."
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-1">欢迎语</label>
                        <input
                            type="text"
                            value={config.prompts.welcome}
                            onChange={e => setConfig({...config, prompts: {...config.prompts, welcome: e.target.value}})}
                            className="w-full px-3 py-2 border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900"
                            placeholder="用户进入时显示的第一句话"
                        />
                    </div>
                </div>

                {/* 基本信息 */}
                <div className="p-4 border border-slate-200 dark:border-slate-600 rounded-lg space-y-4">
                    <h3 className="font-medium flex items-center gap-2">🎨 基本信息与主题</h3>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium mb-1">商家名称</label>
                            <input
                                type="text"
                                value={config.name}
                                onChange={e => setConfig({...config, name: e.target.value})}
                                className="w-full px-3 py-2 border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-1">头像 (Emoji)</label>
                            <input
                                type="text"
                                value={config.avatar}
                                onChange={e => setConfig({...config, avatar: e.target.value})}
                                className="w-full px-3 py-2 border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-1">主题色</label>
                            <div className="flex items-center gap-2">
                                <input
                                    type="color"
                                    value={config.theme.primaryColor}
                                    onChange={e => setConfig({...config, theme: {...config.theme, primaryColor: e.target.value}})}
                                    className="w-12 h-10 rounded cursor-pointer"
                                />
                                <input
                                    type="text"
                                    value={config.theme.primaryColor}
                                    onChange={e => setConfig({...config, theme: {...config.theme, primaryColor: e.target.value}})}
                                    className="flex-1 px-3 py-2 border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900"
                                />
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-1">页面标题</label>
                            <input
                                type="text"
                                value={config.theme.title}
                                onChange={e => setConfig({...config, theme: {...config.theme, title: e.target.value}})}
                                className="w-full px-3 py-2 border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900"
                            />
                        </div>
                    </div>
                </div>
            </section>

            {/* 底部保存按钮 */}
            <div className="flex justify-end gap-4">
                <button
                    onClick={handleSave}
                    disabled={saving}
                    className="flex items-center gap-2 px-8 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium text-lg"
                >
                    <Save size={20} />
                    {saving ? '保存中...' : '💾 实时生效并保存'}
                </button>
            </div>
        </div>
    );
};
