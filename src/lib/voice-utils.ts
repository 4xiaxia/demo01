/**
 * 语音工具模块 - 环境检测、麦克风权限、播放能力
 * 
 * 参考来源：2.0 VoiceUtils.ts (完整版)
 * 
 * 核心功能：
 * 1. 环境检测（微信/Chrome/Firefox/其他）
 * 2. 麦克风权限检测与申请
 * 3. 语音播放能力检测
 * 4. 录音功能封装
 * 5. 音频Base64转换
 */

// ============ 类型定义 ============

/** 浏览器环境类型 */
export type BrowserEnv = 'wechat' | 'chrome' | 'firefox' | 'safari' | 'edge' | 'unknown';

/** 语音能力检测结果 */
export interface VoiceCapability {
    /** 是否支持语音输入 */
    canRecord: boolean;
    /** 是否支持语音播放 */
    canPlay: boolean;
    /** 麦克风权限状态 */
    micPermission: 'granted' | 'denied' | 'prompt' | 'unknown';
    /** 浏览器环境 */
    browser: BrowserEnv;
    /** 是否为移动端 */
    isMobile: boolean;
    /** 不支持的原因（如果有） */
    reason?: string;
}

/** 录音结果 */
export interface RecordingResult {
    /** 音频 Blob */
    blob: Blob;
    /** Base64 编码 */
    base64: string;
    /** 时长（秒） */
    duration: number;
    /** MIME 类型 */
    mimeType: string;
}

// ============ 环境检测 ============

/**
 * 检测浏览器环境
 */
export function detectBrowser(): BrowserEnv {
    const ua = navigator.userAgent.toLowerCase();

    if (ua.includes('micromessenger')) {
        return 'wechat';
    }
    if (ua.includes('edg')) {
        return 'edge';
    }
    if (ua.includes('chrome')) {
        return 'chrome';
    }
    if (ua.includes('firefox')) {
        return 'firefox';
    }
    if (ua.includes('safari')) {
        return 'safari';
    }
    return 'unknown';
}

/**
 * 检测是否为移动端
 */
export function isMobileDevice(): boolean {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
}

/**
 * 检测麦克风权限状态
 */
export async function checkMicPermission(): Promise<'granted' | 'denied' | 'prompt' | 'unknown'> {
    try {
        // 优先使用 Permissions API
        if (navigator.permissions) {
            const result = await navigator.permissions.query({ name: 'microphone' as PermissionName });
            return result.state as 'granted' | 'denied' | 'prompt';
        }
        return 'unknown';
    } catch {
        return 'unknown';
    }
}

/**
 * 检测语音播放能力
 */
export async function checkPlaybackCapability(): Promise<boolean> {
    try {
        // 创建一个极短的静音音频来测试播放能力
        const testAudio = new Audio(
            'data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjU='
        );
        testAudio.volume = 0; // 静音测试
        await testAudio.play();
        testAudio.pause();
        return true;
    } catch {
        return false;
    }
}

/**
 * 综合检测语音能力
 */
export async function checkVoiceCapability(): Promise<VoiceCapability> {
    const browser = detectBrowser();
    const isMobile = isMobileDevice();

    // 检测 MediaDevices API 支持
    const hasMediaDevices = !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);

    // 检测 MediaRecorder API 支持
    const hasMediaRecorder = typeof MediaRecorder !== 'undefined';

    // 检测麦克风权限
    const micPermission = await checkMicPermission();

    // 检测播放能力
    const canPlay = await checkPlaybackCapability();

    // 综合判断录音能力
    const canRecord = hasMediaDevices && hasMediaRecorder && micPermission !== 'denied';

    // 生成不支持原因
    let reason: string | undefined;
    if (!hasMediaDevices) {
        reason = '浏览器不支持麦克风访问';
    } else if (!hasMediaRecorder) {
        reason = '浏览器不支持音频录制';
    } else if (micPermission === 'denied') {
        reason = '麦克风权限被拒绝';
    } else if (!canPlay) {
        reason = '无法播放音频（可能需要用户交互）';
    }

    return {
        canRecord,
        canPlay,
        micPermission,
        browser,
        isMobile,
        reason,
    };
}

// ============ 录音功能 ============

let mediaRecorder: MediaRecorder | null = null;
let audioChunks: Blob[] = [];
let recordingStartTime: number = 0;

/**
 * 开始录音
 * @returns Promise<boolean> 是否成功开始
 */
export async function startRecording(): Promise<boolean> {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

        // 选择最佳录音格式
        const mimeType = getSupportedMimeType();
        mediaRecorder = new MediaRecorder(stream, { mimeType });
        audioChunks = [];
        recordingStartTime = Date.now();

        mediaRecorder.ondataavailable = (e) => {
            if (e.data.size > 0) {
                audioChunks.push(e.data);
            }
        };

        mediaRecorder.onstop = () => {
            stream.getTracks().forEach(track => track.stop());
        };

        mediaRecorder.start(100); // 每100ms收集一次数据
        console.log(`🎤 开始录音 [${mimeType}]`);
        return true;
    } catch (error) {
        console.error('❌ 录音启动失败:', error);
        return false;
    }
}

/**
 * 停止录音并返回结果
 */
export async function stopRecording(): Promise<RecordingResult | null> {
    if (!mediaRecorder || mediaRecorder.state === 'inactive') {
        return null;
    }

    return new Promise((resolve) => {
        mediaRecorder!.onstop = async () => {
            const mimeType = mediaRecorder!.mimeType || 'audio/webm';
            const blob = new Blob(audioChunks, { type: mimeType });
            const duration = (Date.now() - recordingStartTime) / 1000;
            const base64 = await blobToBase64(blob);

            console.log(`🎤 录音结束 [${duration.toFixed(1)}秒]`);

            // 释放资源
            mediaRecorder = null;
            audioChunks = [];

            resolve({
                blob,
                base64,
                duration,
                mimeType,
            });
        };

        mediaRecorder!.stop();
    });
}

/**
 * 检查是否正在录音
 */
export function isRecording(): boolean {
    return mediaRecorder !== null && mediaRecorder.state === 'recording';
}

/**
 * 获取支持的 MIME 类型
 * 
 * 📋 浏览器录音格式优先级（按ASR兼容性排序）：
 * ┌─────────────────────────────────────────────────────────────┐
 * │ 浏览器      │ 推荐格式                    │ ASR兼容        │
 * │─────────────│─────────────────────────────│────────────────│
 * │ Chrome/Edge │ audio/webm;codecs=opus      │ ✅ 直接支持    │
 * │ Firefox     │ audio/ogg;codecs=opus       │ ✅ 直接支持    │
 * │ Safari      │ audio/mp4                   │ ✅ 直接支持    │
 * │ 其他        │ audio/webm                  │ ✅ 直接支持    │
 * └─────────────────────────────────────────────────────────────┘
 * 
 * ⚠️ GLM-ASR-2512 支持的格式: wav, mp3, flac, ogg, m4a, aac, webm
 */
function getSupportedMimeType(): string {
    // 按 GLM-ASR 兼容性排序的格式列表
    const types = [
        'audio/webm;codecs=opus',  // Chrome/Edge 首选，ASR直接支持
        'audio/ogg;codecs=opus',   // Firefox 首选，ASR直接支持
        'audio/mp4',               // Safari 首选，ASR直接支持(m4a)
        'audio/webm',              // 通用格式
        'audio/wav',               // 无损格式（文件较大）
    ];

    for (const type of types) {
        if (MediaRecorder.isTypeSupported(type)) {
            return type;
        }
    }

    // 降级默认
    console.warn('⚠️ 浏览器不支持推荐的音频格式，使用默认webm');
    return 'audio/webm';
}

// ============ 音频格式转换 ============

/**
 * 将 webm/opus 音频转换为 WAV 格式
 * 
 * ⚠️ 智谱 ASR (glm-asr-2512) 不支持 webm;codecs=opus 格式！
 * 浏览器 MediaRecorder 默认录制的是 webm/opus，必须转换为 WAV 才能使用 ASR。
 * 
 * 转换流程：
 * 1. 使用 AudioContext.decodeAudioData() 解码 webm
 * 2. 将 AudioBuffer 编码为 PCM WAV 格式
 * 3. 返回 WAV Blob
 * 
 * @param webmBlob webm/opus 格式的音频 Blob
 * @returns WAV 格式的音频 Blob
 */
export async function convertToWav(webmBlob: Blob): Promise<Blob> {
    console.log(`🔄 开始转换音频格式: ${webmBlob.type} → audio/wav`);

    // 1. 获取 ArrayBuffer
    const arrayBuffer = await webmBlob.arrayBuffer();

    // 2. 解码音频
    const audioContext = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    let audioBuffer: AudioBuffer;

    try {
        audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
    } catch (error) {
        console.error('❌ 音频解码失败:', error);
        throw new Error('音频解码失败，请重新录音');
    }

    // 3. 编码为 WAV
    const wavBlob = encodeWav(audioBuffer);
    console.log(`✅ 音频转换完成: ${(wavBlob.size / 1024).toFixed(1)}KB`);

    // 4. 关闭 AudioContext
    await audioContext.close();

    return wavBlob;
}

/**
 * 将 AudioBuffer 编码为 WAV 格式
 * 
 * WAV 格式结构：
 * - RIFF header (44 bytes)
 * - PCM 16-bit 数据
 */
function encodeWav(audioBuffer: AudioBuffer): Blob {
    const numChannels = audioBuffer.numberOfChannels;
    const sampleRate = audioBuffer.sampleRate;
    const format = 1; // PCM
    const bitDepth = 16;

    // 获取所有声道数据并混合为单声道（ASR 推荐单声道）
    let samples: Float32Array;
    if (numChannels === 1) {
        samples = audioBuffer.getChannelData(0);
    } else {
        // 多声道混合为单声道
        const length = audioBuffer.length;
        samples = new Float32Array(length);
        for (let i = 0; i < length; i++) {
            let sum = 0;
            for (let ch = 0; ch < numChannels; ch++) {
                sum += audioBuffer.getChannelData(ch)[i];
            }
            samples[i] = sum / numChannels;
        }
    }

    // 转换为 16-bit PCM
    const buffer = new ArrayBuffer(44 + samples.length * 2);
    const view = new DataView(buffer);

    // WAV header
    writeString(view, 0, 'RIFF');
    view.setUint32(4, 36 + samples.length * 2, true);
    writeString(view, 8, 'WAVE');
    writeString(view, 12, 'fmt ');
    view.setUint32(16, 16, true); // Subchunk1Size
    view.setUint16(20, format, true); // AudioFormat (PCM = 1)
    view.setUint16(22, 1, true); // NumChannels (单声道)
    view.setUint32(24, sampleRate, true); // SampleRate
    view.setUint32(28, sampleRate * 2, true); // ByteRate
    view.setUint16(32, 2, true); // BlockAlign
    view.setUint16(34, bitDepth, true); // BitsPerSample
    writeString(view, 36, 'data');
    view.setUint32(40, samples.length * 2, true); // Subchunk2Size

    // PCM 数据
    let offset = 44;
    for (let i = 0; i < samples.length; i++) {
        const s = Math.max(-1, Math.min(1, samples[i]));
        view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
        offset += 2;
    }

    return new Blob([buffer], { type: 'audio/wav' });
}

/**
 * 写入字符串到 DataView
 */
function writeString(view: DataView, offset: number, string: string): void {
    for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
    }
}

// ============ 音频工具 ============

/**
 * Blob 转 Base64
 */
export function blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            const result = reader.result as string;
            // 移除 data:audio/xxx;base64, 前缀
            const base64 = result.split(',')[1] || result;
            resolve(base64);
        };
        reader.onerror = () => reject(new Error('Blob转Base64失败'));
        reader.readAsDataURL(blob);
    });
}

/**
 * Base64 转 Blob
 */
export function base64ToBlob(base64: string, mimeType: string = 'audio/wav'): Blob {
    const byteCharacters = atob(base64);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    return new Blob([byteArray], { type: mimeType });
}

/**
 * 播放 Base64 音频
 * 
 * 📋 TTS输出格式对应的MIME类型：
 * ┌─────────────────────────────────────────┐
 * │ TTS格式  │ MIME类型                     │
 * │──────────│──────────────────────────────│
 * │ wav      │ audio/wav (默认，兼容性最好) │
 * │ mp3      │ audio/mpeg                   │
 * │ pcm      │ audio/pcm (需特殊处理)       │
 * └─────────────────────────────────────────┘
 * 
 * @param base64 Base64编码的音频数据
 * @param mimeType MIME类型，默认 audio/wav
 */
export async function playBase64Audio(base64: string, mimeType: string = 'audio/wav'): Promise<void> {
    return new Promise((resolve, reject) => {
        try {
            // 确保 base64 没有前缀
            const pureBase64 = base64.includes(',') ? base64.split(',')[1] : base64;
            const audio = new Audio(`data:${mimeType};base64,${pureBase64}`);

            audio.onended = () => resolve();
            audio.onerror = () => reject(new Error('音频播放失败'));

            audio.play().catch((error) => {
                // 浏览器自动播放策略限制
                console.warn('⚠️ 需要用户交互后才能播放音频');
                reject(error instanceof Error ? error : new Error(String(error)));
            });
        } catch (error) {
            reject(error instanceof Error ? error : new Error(String(error)));
        }
    });
}

// ============ 权限引导文案 ============

/**
 * 获取麦克风权限引导文案（老人友好）
 */
export function getMicPermissionGuide(browser: BrowserEnv): string {
    switch (browser) {
        case 'wechat':
            return '点击页面右上角 ··· → 选择「允许使用麦克风」';
        case 'chrome':
        case 'edge':
            return '点击地址栏左边的🔒小锁 → 找到「麦克风」→ 选择「允许」';
        case 'firefox':
            return '点击地址栏左边的🔒小锁 → 找到「麦克风」→ 选择「允许」';
        case 'safari':
            return '打开「Safari设置」→「网站」→「麦克风」→ 允许此网站';
        default:
            return '请在浏览器设置中允许麦克风权限';
    }
}

/**
 * 获取播放问题解决方案（老人友好）
 */
export function getPlaybackGuide(browser: BrowserEnv): string {
    switch (browser) {
        case 'wechat':
            return '🔊 微信里要先点一下页面，才能播放语音哦～';
        default:
            return '🔊 点一下页面任意位置，就能听语音啦～';
    }
}

// ============ 默认导出 ============
export default {
    detectBrowser,
    isMobileDevice,
    checkMicPermission,
    checkPlaybackCapability,
    checkVoiceCapability,
    startRecording,
    stopRecording,
    isRecording,
    blobToBase64,
    base64ToBlob,
    playBase64Audio,
    convertToWav,
    getMicPermissionGuide,
    getPlaybackGuide,
};
