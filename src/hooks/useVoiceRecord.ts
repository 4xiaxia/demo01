import { useState, useRef, useCallback } from 'react';

interface VoiceRecordResult {
  blob: Blob;
  text: string; // 模拟语音转文字结果
  duration: number; // 录音时长（秒）
}

interface VoiceRecordReturn {
  isRecording: boolean;
  audioBlob: Blob | null;
  error: string | null;
  recordingDuration: number; // 当前录音时长
  startRecording: () => Promise<boolean>;
  stopRecording: () => Promise<VoiceRecordResult | null>;
  isSupported: boolean;
}

export const useVoiceRecord = (): VoiceRecordReturn => {
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [recordingDuration, setRecordingDuration] = useState(0);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const startTimeRef = useRef<number>(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // 检查浏览器是否支持语音录制
  const isSupported = 'MediaRecorder' in window;

  const stopRecording = useCallback(async (): Promise<VoiceRecordResult | null> => {
    if (!mediaRecorderRef.current || !isRecording) {
      return null;
    }

    // 清理计时器
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    const duration = Math.floor((Date.now() - startTimeRef.current) / 1000);
    setRecordingDuration(0);

    return new Promise((resolve) => {
      mediaRecorderRef.current!.onstop = () => {
        const mimeType = mediaRecorderRef.current?.mimeType || 'audio/webm';
        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
        setAudioBlob(audioBlob);

        // 模拟语音转文字的结果
        const textResult = `[语音消息] (${duration}秒)`;

        resolve({ blob: audioBlob, text: textResult, duration });

        // 重置状态
        setIsRecording(false);
        mediaRecorderRef.current = null;
      };

      if (mediaRecorderRef.current) {
        mediaRecorderRef.current.stop();
      }
    });
  }, [isRecording]);

  const startRecording = useCallback(async (): Promise<boolean> => {
    if (!isSupported) {
      setError('浏览器不支持录音功能');
      return false;
    }

    // 自动检测浏览器支持的音频格式
    function getSupportedMimeType(): string {
      if (!isSupported) return 'audio/webm';

      // 检查支持的格式
      const mimes = [
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/mp4',
        'audio/aac'
      ];

      for (const mime of mimes) {
        if (MediaRecorder.isTypeSupported(mime)) {
          return mime;
        }
      }

      return 'audio/webm'; // 兜底
    }

    try {
      setError(null);
      audioChunksRef.current = [];
      setRecordingDuration(0);

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true
        }
      });
      streamRef.current = stream;

      const mimeType = getSupportedMimeType();
      mediaRecorderRef.current = new MediaRecorder(stream, { mimeType });

      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorderRef.current.onstop = () => {
        const mimeType = mediaRecorderRef.current?.mimeType || 'audio/webm';
        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
        setAudioBlob(audioBlob);

        // 停止所有音轨
        stream.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      };

      mediaRecorderRef.current.start();
      setIsRecording(true);
      startTimeRef.current = Date.now();

      // 启动录音计时器
      timerRef.current = setInterval(() => {
        const duration = Math.floor((Date.now() - startTimeRef.current) / 1000);
        setRecordingDuration(duration);

        // 超过60秒自动停止
        if (duration >= 60) {
          stopRecording();
        }
      }, 1000);

      return true;
    } catch (err) {
      console.error('录音启动失败:', err);
      setError('无法启动录音，请检查麦克风权限');
      return false;
    }
  }, [isSupported, stopRecording]);

  return {
    isRecording,
    audioBlob,
    error,
    recordingDuration,
    startRecording,
    stopRecording,
    isSupported
  };
};
