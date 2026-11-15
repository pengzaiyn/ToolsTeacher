export interface SpeechRecognitionAlternativeLike {
  transcript: string;
}

export interface SpeechRecognitionResultLike {
  isFinal: boolean;
  length: number;
  [index: number]: SpeechRecognitionAlternativeLike;
}

export interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: {
    length: number;
    [index: number]: SpeechRecognitionResultLike;
  };
}

export interface SpeechRecognitionErrorEventLike {
  error: string;
}

export interface SpeechRecognitionInstance {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  onstart: (() => void) | null;
  onend: (() => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}

type SpeechRecognitionCtor = new () => SpeechRecognitionInstance;

export function getSpeechRecognitionConstructor(): SpeechRecognitionCtor | null {
  if (typeof window === 'undefined') return null;
  const win = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return win.SpeechRecognition ?? win.webkitSpeechRecognition ?? null;
}

export function supportsBrowserTts(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

export function supportsMediaRecording(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    Boolean(navigator.mediaDevices?.getUserMedia) &&
    typeof MediaRecorder !== 'undefined'
  );
}

export function pickRecorderMimeType(): string {
  if (typeof MediaRecorder === 'undefined') return '';
  const candidates = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/ogg;codecs=opus',
    'audio/mp4',
  ];
  for (const candidate of candidates) {
    if (MediaRecorder.isTypeSupported(candidate)) {
      return candidate;
    }
  }
  return '';
}

export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      const commaIdx = result.indexOf(',');
      resolve(commaIdx >= 0 ? result.slice(commaIdx + 1) : result);
    };
    reader.onerror = () => reject(new Error('Không thể đọc dữ liệu âm thanh vừa ghi'));
    reader.readAsDataURL(blob);
  });
}

/**
 * Làm sạch ký hiệu kỹ thuật và định dạng xuống dòng để đọc thành tiếng mượt mà như hội thoại.
 */
export function sanitizeTextForSpeech(rawText: string): string {
  const cleaned = rawText
    .replace(/\(\/[a-z0-9\-/:*#?&=_]*\)/gi, '')
    .replace(/\[[^\]]*\]\(\/[^)]*\)/g, '')
    .replace(/\s*->\s*/g, ', rồi ')
    .replace(/\*\*|__|`|#{1,6}\s*|---+/g, '')
    .replace(/^\s*[-•]\s+/gm, '')
    .replace(/^\s*(\d+)\.\s+/gm, 'Bước $1: ')
    .replace(/\bTKB\b/g, 'thời khóa biểu')
    .replace(/\n{2,}/g, '. ')
    .replace(/\n/g, '. ')
    .replace(/\s*\.\s*\./g, '.')
    .replace(/\s+/g, ' ')
    .trim();

  if (cleaned.length <= 900) return cleaned;

  const sliced = cleaned.slice(0, 900);
  const lastSentenceEnd = Math.max(sliced.lastIndexOf('. '), sliced.lastIndexOf('! '), sliced.lastIndexOf('? '));
  if (lastSentenceEnd > 320) {
    return sliced.slice(0, lastSentenceEnd + 1).trim();
  }
  return `${sliced.trim()}...`;
}

function splitSpeechChunks(text: string, maxLen = 175): string[] {
  const sentences = text
    .split(/(?<=[.!?])\s+/)
    .map((part) => part.trim())
    .filter(Boolean);

  const chunks: string[] = [];
  let buffer = '';

  for (const sentence of sentences) {
    if (sentence.length > maxLen) {
      if (buffer) {
        chunks.push(buffer);
        buffer = '';
      }
      const subParts = sentence.split(/,\s+/).filter(Boolean);
      for (const part of subParts) {
        if ((buffer ? `${buffer}, ${part}` : part).length <= maxLen) {
          buffer = buffer ? `${buffer}, ${part}` : part;
        } else {
          if (buffer) chunks.push(buffer);
          buffer = part;
        }
      }
      continue;
    }

    const next = buffer ? `${buffer} ${sentence}` : sentence;
    if (next.length <= maxLen) {
      buffer = next;
    } else {
      if (buffer) chunks.push(buffer);
      buffer = sentence;
    }
  }

  if (buffer) chunks.push(buffer);
  return chunks.length > 0 ? chunks : [text];
}

function isVietnameseVoice(voice: SpeechSynthesisVoice): boolean {
  const normalizedLang = voice.lang.toLowerCase().replace(/_/g, '-').trim();
  if (normalizedLang === 'vi' || normalizedLang.startsWith('vi-')) {
    return true;
  }
  return /vietnam|tiếng việt|tieng viet|hoaimy|namminh/i.test(voice.name);
}

function pickBestVietnameseVoiceFromList(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | null {
  const viVoices = voices.filter(isVietnameseVoice);
  if (viVoices.length === 0) return null;

  const priorityKeywords = ['natural', 'hoaimy', 'namminh', 'google', 'neural', 'linh', 'an'];
  for (const keyword of priorityKeywords) {
    const matched = viVoices.find((v) => v.name.toLowerCase().includes(keyword));
    if (matched) return matched;
  }

  return viVoices[0];
}

/**
 * Đợi trình duyệt nạp danh sách giọng đọc (Chrome/Edge thường trả mảng rỗng hoặc thiếu giọng Online ở lần gọi đầu tiên).
 */
export function waitForVietnameseVoice(timeoutMs = 450): Promise<SpeechSynthesisVoice | null> {
  if (!supportsBrowserTts()) return Promise.resolve(null);

  const synth = window.speechSynthesis;
  const initialMatch = pickBestVietnameseVoiceFromList(synth.getVoices());
  if (initialMatch) {
    return Promise.resolve(initialMatch);
  }

  return new Promise((resolve) => {
    let settled = false;
    let timer: number | null = null;
    const canListen = typeof synth.addEventListener === 'function';

    const finish = () => {
      if (settled) return;
      settled = true;
      if (timer !== null) {
        window.clearTimeout(timer);
        timer = null;
      }
      if (canListen) {
        synth.removeEventListener('voiceschanged', handleVoicesChanged);
      }
      resolve(pickBestVietnameseVoiceFromList(synth.getVoices()));
    };

    const handleVoicesChanged = () => {
      if (pickBestVietnameseVoiceFromList(synth.getVoices())) {
        finish();
      }
    };

    if (canListen) {
      synth.addEventListener('voiceschanged', handleVoicesChanged);
    }
    timer = window.setTimeout(finish, timeoutMs);
  });
}

export type BrowserTtsUnavailableReason = 'unsupported' | 'no_vi_voice' | 'speech_error';
export type AudioPlaybackErrorReason = 'autoplay_blocked' | 'playback_failed';

export interface SpeechPlaybackHandle {
  stop: () => void;
}

const SILENT_WAV_DATA_URI =
  'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA';

let sharedAudioElement: HTMLAudioElement | null = null;
let sharedAudioContext: AudioContext | null = null;
let activePlaybackObjectUrl: string | null = null;
let currentAudioPlayId = 0;

function getOrCreateSharedAudio(): HTMLAudioElement {
  if (!sharedAudioElement) {
    sharedAudioElement = new Audio();
    sharedAudioElement.preload = 'auto';
  }
  return sharedAudioElement;
}

function getOrCreateSharedAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const Ctor =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  if (!sharedAudioContext || sharedAudioContext.state === 'closed') {
    sharedAudioContext = new Ctor();
  }
  return sharedAudioContext;
}

function decodeBase64ToBytes(base64: string): Uint8Array {
  const binary = window.atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function encodeBytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const slice = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...slice);
  }
  return window.btoa(binary);
}

function buildWavBase64FromPcmChunks(chunks: Uint8Array[], sampleRate: number): string {
  let dataLength = 0;
  for (const chunk of chunks) {
    dataLength += chunk.byteLength;
  }

  const buffer = new ArrayBuffer(44 + dataLength);
  const view = new DataView(buffer);
  const writeAscii = (offset: number, text: string) => {
    for (let i = 0; i < text.length; i += 1) {
      view.setUint8(offset + i, text.charCodeAt(i));
    }
  };

  writeAscii(0, 'RIFF');
  view.setUint32(4, 36 + dataLength, true);
  writeAscii(8, 'WAVE');
  writeAscii(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeAscii(36, 'data');
  view.setUint32(40, dataLength, true);

  const out = new Uint8Array(buffer);
  let offset = 44;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return encodeBytesToBase64(out);
}

/**
 * Mở khóa phần tử Audio và AudioContext ngay trong thao tác bấm/gửi để trình duyệt không chặn phát tự động sau khi chờ API.
 */
export function unlockAudioPlayback(): void {
  if (typeof window === 'undefined') return;
  try {
    const ctx = getOrCreateSharedAudioContext();
    if (ctx && ctx.state === 'suspended') {
      void ctx.resume().catch(() => {
        // Bỏ qua nếu trình duyệt chưa cho mở AudioContext
      });
    }

    if (typeof Audio === 'undefined') return;
    const audio = getOrCreateSharedAudio();
    if (!audio.paused) return;

    currentAudioPlayId += 1;
    audio.onplay = null;
    audio.onended = null;
    audio.onerror = null;
    audio.src = SILENT_WAV_DATA_URI;

    const playPromise = audio.play();
    if (playPromise && typeof playPromise.then === 'function') {
      void playPromise.catch(() => {
        // Bỏ qua nếu trình duyệt chưa cho phép phát trước khi có tương tác hợp lệ
      });
    }
  } catch {
    // Không cản trở luồng chat chính nếu trình duyệt hạn chế Audio API
  }
}

export function supportsStreamedPcmPlayback(): boolean {
  return getOrCreateSharedAudioContext() !== null;
}

export interface StreamedPcmPlayerHandle extends SpeechPlaybackHandle {
  pushBase64Chunk: (base64Chunk: string, sampleRate?: number) => Promise<boolean>;
  finish: () => { wavBase64: string; mimeType: string } | null;
}

/**
 * Trình phát luồng PCM 16-bit mono theo thời gian thực qua Web Audio API để phát ngay câu đầu tiên khi SSE trả chunk.
 */
export function createStreamedPcmPlayer(callbacks: {
  onStart?: () => void;
  onEnd?: () => void;
  onError?: (reason: AudioPlaybackErrorReason) => void;
  onAbortRequest?: () => void;
}): StreamedPcmPlayerHandle {
  let stopped = false;
  let started = false;
  let streamCompleted = false;
  let errored = false;
  let pendingByte: number | null = null;
  let resolvedSampleRate = 24000;
  let nextStartTime = 0;
  const pcmChunks: Uint8Array[] = [];
  const activeSources = new Set<AudioBufferSourceNode>();
  let unlockPromise: Promise<boolean> | null = null;

  const ensureContextRunning = async (): Promise<AudioContext | null> => {
    const ctx = getOrCreateSharedAudioContext();
    if (!ctx) return null;
    if (ctx.state === 'running') return ctx;

    if (!unlockPromise) {
      unlockPromise = ctx
        .resume()
        .then(() => ctx.state === 'running')
        .catch(() => false);
    }
    const ok = await unlockPromise;
    return ok && (ctx.state as AudioContextState) === 'running' ? ctx : null;
  };

  return {
    pushBase64Chunk: async (base64Chunk: string, sampleRate = 24000) => {
      if (stopped || errored || !base64Chunk) return false;

      const ctx = await ensureContextRunning();
      if (!ctx) {
        if (!stopped && !errored) {
          errored = true;
          callbacks.onError?.('autoplay_blocked');
        }
        return false;
      }
      if (stopped || errored) return false;

      try {
        resolvedSampleRate = sampleRate || 24000;
        const decoded = decodeBase64ToBytes(base64Chunk);
        let bytes = decoded;
        if (pendingByte !== null) {
          const merged = new Uint8Array(1 + decoded.length);
          merged[0] = pendingByte;
          merged.set(decoded, 1);
          bytes = merged;
          pendingByte = null;
        }

        if (bytes.length % 2 === 1) {
          pendingByte = bytes[bytes.length - 1];
          bytes = bytes.subarray(0, bytes.length - 1);
        }

        if (bytes.length < 2) return true;

        pcmChunks.push(bytes);
        const samples = bytes.length / 2;
        const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
        const floatData = new Float32Array(samples);
        for (let i = 0; i < samples; i += 1) {
          floatData[i] = view.getInt16(i * 2, true) / 32768;
        }

        const audioBuffer = ctx.createBuffer(1, samples, resolvedSampleRate);
        audioBuffer.copyToChannel(floatData, 0);

        const source = ctx.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(ctx.destination);

        const startAt = Math.max(nextStartTime, ctx.currentTime + 0.02);
        nextStartTime = startAt + audioBuffer.duration;
        activeSources.add(source);

        source.onended = () => {
          activeSources.delete(source);
          if (streamCompleted && activeSources.size === 0 && !stopped && !errored) {
            callbacks.onEnd?.();
          }
        };

        source.start(startAt);
        if (!started) {
          started = true;
          callbacks.onStart?.();
        }
        return true;
      } catch {
        if (!stopped && !errored) {
          errored = true;
          callbacks.onError?.('playback_failed');
        }
        return false;
      }
    },

    finish: () => {
      streamCompleted = true;
      if (!stopped && !errored && activeSources.size === 0) {
        callbacks.onEnd?.();
      }
      if (pcmChunks.length === 0) return null;
      return {
        wavBase64: buildWavBase64FromPcmChunks(pcmChunks, resolvedSampleRate),
        mimeType: 'audio/wav',
      };
    },

    stop: () => {
      if (stopped) return;
      stopped = true;
      callbacks.onAbortRequest?.();
      for (const source of activeSources) {
        try {
          source.onended = null;
          source.stop();
          source.disconnect();
        } catch {
          // Bỏ qua nếu node đã kết thúc
        }
      }
      activeSources.clear();
      callbacks.onEnd?.();
    },
  };
}

/**
 * Phát âm thanh WAV/Audio trả về từ Gemini TTS; gọi các callback đồng bộ trạng thái miệng Robot.
 */
export function playAudioBase64(
  audioBase64: string,
  mimeType: string,
  callbacks: {
    onStart?: () => void;
    onEnd?: () => void;
    onError?: (reason: AudioPlaybackErrorReason) => void;
  }
): SpeechPlaybackHandle {
  let stopped = false;
  let objectUrl: string | null = null;
  const playId = ++currentAudioPlayId;

  const cleanup = () => {
    if (sharedAudioElement && currentAudioPlayId === playId) {
      sharedAudioElement.onplay = null;
      sharedAudioElement.onended = null;
      sharedAudioElement.onerror = null;
      sharedAudioElement.pause();
    }
    if (objectUrl) {
      URL.revokeObjectURL(objectUrl);
      if (activePlaybackObjectUrl === objectUrl) {
        activePlaybackObjectUrl = null;
      }
      objectUrl = null;
    }
  };

  try {
    const binary = window.atob(audioBase64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) {
      bytes[i] = binary.charCodeAt(i);
    }

    const blob = new Blob([bytes], { type: mimeType || 'audio/wav' });
    objectUrl = URL.createObjectURL(blob);

    const audio = getOrCreateSharedAudio();
    if (activePlaybackObjectUrl) {
      URL.revokeObjectURL(activePlaybackObjectUrl);
      activePlaybackObjectUrl = null;
    }
    activePlaybackObjectUrl = objectUrl;

    audio.onplay = null;
    audio.onended = null;
    audio.onerror = null;
    audio.pause();
    audio.src = objectUrl;

    audio.onplay = () => {
      if (!stopped && currentAudioPlayId === playId) {
        callbacks.onStart?.();
      }
    };
    audio.onended = () => {
      cleanup();
      if (!stopped && currentAudioPlayId === playId) {
        callbacks.onEnd?.();
      }
    };
    audio.onerror = () => {
      cleanup();
      if (!stopped && currentAudioPlayId === playId) {
        callbacks.onError?.('playback_failed');
      }
    };

    const playPromise = audio.play();
    if (playPromise && typeof playPromise.then === 'function') {
      void playPromise.catch((err: unknown) => {
        const isCurrent = currentAudioPlayId === playId;
        cleanup();
        if (stopped || !isCurrent) return;
        const isAutoplayBlocked =
          (err instanceof DOMException && err.name === 'NotAllowedError') ||
          (typeof err === 'object' &&
            err !== null &&
            'name' in err &&
            (err as { name?: string }).name === 'NotAllowedError');
        callbacks.onError?.(isAutoplayBlocked ? 'autoplay_blocked' : 'playback_failed');
      });
    }
  } catch {
    cleanup();
    callbacks.onError?.('playback_failed');
  }

  return {
    stop: () => {
      if (stopped) return;
      stopped = true;
      cleanup();
      callbacks.onEnd?.();
    },
  };
}

/**
 * Phát âm bằng Web Speech API tiếng Việt (tự đợi danh sách giọng nạp xong và không phát bằng giọng tiếng Anh nếu máy thiếu giọng Việt).
 */
export function speakWithBrowserTts(
  text: string,
  callbacks: {
    onStart?: () => void;
    onEnd?: () => void;
    onUnavailable?: (reason: BrowserTtsUnavailableReason) => void;
  }
): SpeechPlaybackHandle {
  if (!supportsBrowserTts()) {
    callbacks.onUnavailable?.('unsupported');
    return { stop: () => {} };
  }

  window.speechSynthesis.cancel();

  const clean = sanitizeTextForSpeech(text);
  const chunks = splitSpeechChunks(clean);

  let stopped = false;
  let started = false;
  let index = 0;

  void waitForVietnameseVoice(450).then((voice) => {
    if (stopped) return;

    if (!voice) {
      callbacks.onUnavailable?.('no_vi_voice');
      return;
    }

    const speakNext = () => {
      if (stopped) return;
      if (index >= chunks.length) {
        callbacks.onEnd?.();
        return;
      }

      const utterance = new SpeechSynthesisUtterance(chunks[index]);
      utterance.lang = voice.lang || 'vi-VN';
      utterance.voice = voice;
      utterance.rate = 1.02;
      utterance.pitch = 1.02;

      utterance.onstart = () => {
        if (stopped) return;
        if (!started) {
          started = true;
          callbacks.onStart?.();
        }
      };

      utterance.onend = () => {
        if (stopped) return;
        index += 1;
        speakNext();
      };

      utterance.onerror = (event) => {
        if (stopped) return;
        if (event.error === 'interrupted' || event.error === 'canceled') {
          callbacks.onEnd?.();
        } else {
          callbacks.onUnavailable?.('speech_error');
        }
      };

      window.speechSynthesis.speak(utterance);
    };

    speakNext();
  });

  return {
    stop: () => {
      if (stopped) return;
      stopped = true;
      window.speechSynthesis.cancel();
      callbacks.onEnd?.();
    },
  };
}

