import { FunctionsHttpError } from '@supabase/supabase-js';
import {
  answerWithLocalKnowledge,
  findRelatedActions,
  type AssistantAction,
  type AssistantAudienceRole,
} from '@/lib/assistantKnowledge';
import {
  notifyAuthSessionInvalidated,
  supabase,
  supabaseAnonKey,
  supabaseUrl,
} from '@/lib/supabase';

export type AssistantSource = 'gemini' | 'local';

export interface AssistantTurn {
  role: 'user' | 'assistant';
  content: string;
}

export interface AssistantReply {
  reply: string;
  source: AssistantSource;
  interactionId: string | null;
  actions: AssistantAction[];
}

interface EdgeAssistantPayload {
  source?: 'gemini' | 'gemini-tts' | 'gemini-stt' | 'fallback_needed';
  reply?: string;
  interactionId?: string | null;
  audioBase64?: string;
  mimeType?: string;
  text?: string;
  reason?: string;
  error?: string;
}

export interface AssistantAudioData {
  audioBase64: string;
  mimeType: string;
}

export interface AssistantSpeechResult {
  audio: AssistantAudioData | null;
  fallbackReason?: string;
}

interface AskAssistantParams {
  message: string;
  role: AssistantAudienceRole;
  currentPath: string;
  previousInteractionId?: string | null;
  history?: AssistantTurn[];
}

async function invokeAvcAssistantEdge(
  body: Record<string, unknown>,
  role: AssistantAudienceRole,
  timeoutMs = 12000
): Promise<EdgeAssistantPayload | null> {
  if (role === 'guest') return null;

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) return null;

  let timer: number | null = null;
  try {
    const invokePromise = supabase.functions.invoke<EdgeAssistantPayload>('avc-assistant', {
      body,
    });
    const timeoutPromise = new Promise<never>((_, reject) => {
      timer = window.setTimeout(() => {
        reject(new Error('edge_timeout'));
      }, timeoutMs);
    });

    const { data, error } = await Promise.race([invokePromise, timeoutPromise]);

    if (error) {
      if (error instanceof FunctionsHttpError) {
        const status = error.context.status;
        if (status === 401 || status === 403) {
          if (status === 401) {
            notifyAuthSessionInvalidated();
          }
          let errMsg = 'Phiên đăng nhập đã hết hạn hoặc tài khoản không hợp lệ';
          try {
            const parsed = (await error.context.json()) as { error?: string };
            if (parsed.error) errMsg = parsed.error;
          } catch {
            // Giữ thông báo mặc định nếu không đọc được JSON lỗi
          }
          throw new Error(errMsg);
        }
      }
      return null;
    }

    return data ?? null;
  } catch (err) {
    if (
      err instanceof Error &&
      (err.message.includes('Phiên đăng nhập') || err.message.includes('kích hoạt'))
    ) {
      throw err;
    }
    return null;
  } finally {
    if (timer !== null) {
      window.clearTimeout(timer);
    }
  }
}

/**
 * Gửi câu hỏi tới Edge Function avc-assistant (Gemini 3.8 Flash) khi đã đăng nhập và tự động dự phòng bằng kho tri thức nội bộ khi chưa đăng nhập, chưa có API key hoặc lỗi kết nối.
 */
export async function askAvcAssistant({
  message,
  role,
  currentPath,
  previousInteractionId,
  history = [],
}: AskAssistantParams): Promise<AssistantReply> {
  const trimmed = message.trim();

  const data = await invokeAvcAssistantEdge(
    {
      mode: 'chat',
      message: trimmed,
      currentPath,
      previousInteractionId: previousInteractionId ?? undefined,
      history: history.slice(-6),
    },
    role
  );

  if (data?.source === 'gemini' && data.reply?.trim()) {
    const reply = data.reply.trim();
    return {
      reply,
      source: 'gemini',
      interactionId: data.interactionId ?? null,
      actions: findRelatedActions(`${trimmed} ${reply}`, role, [], currentPath),
    };
  }

  const fallback = answerWithLocalKnowledge(trimmed, role, currentPath);
  return {
    reply: fallback.reply,
    source: 'local',
    interactionId: null,
    actions: fallback.actions,
  };
}

/**
 * Yêu cầu Gemini 3.8 Flash-Lite TTS tổng hợp giọng nói tiếng Việt tự nhiên. Trả về audio: null kèm fallbackReason nếu chưa thể dùng giọng Gemini.
 */
export async function requestAssistantSpeech(
  text: string,
  role: AssistantAudienceRole
): Promise<AssistantSpeechResult> {
  const cleanText = text.trim();
  if (!cleanText) return { audio: null, fallbackReason: 'empty_text' };
  if (role === 'guest') return { audio: null, fallbackReason: 'guest_mode' };

  try {
    const data = await invokeAvcAssistantEdge(
      {
        mode: 'tts',
        text: cleanText,
      },
      role
    );

    if (data?.source === 'gemini-tts' && data.audioBase64) {
      return {
        audio: {
          audioBase64: data.audioBase64,
          mimeType: data.mimeType || 'audio/wav',
        },
      };
    }

    return {
      audio: null,
      fallbackReason: data?.reason || 'tts_unavailable',
    };
  } catch {
    return {
      audio: null,
      fallbackReason: 'request_failed',
    };
  }
}

export interface StreamAssistantSpeechResult {
  ok: boolean;
  aborted?: boolean;
  fallbackReason?: string;
}

/**
 * Stream từng đoạn PCM 24kHz tiếng Việt từ Edge Function avc-assistant để phát ngay lập tức thay vì chờ tổng hợp hết toàn bộ file WAV.
 */
export function startStreamAssistantSpeech(
  text: string,
  role: AssistantAudienceRole,
  onChunk: (base64Chunk: string, sampleRate: number) => Promise<boolean>
): {
  abort: () => void;
  promise: Promise<StreamAssistantSpeechResult>;
} {
  const controller = new AbortController();

  const promise = (async (): Promise<StreamAssistantSpeechResult> => {
    const cleanText = text.trim();
    if (!cleanText) return { ok: false, fallbackReason: 'empty_text' };
    if (role === 'guest') return { ok: false, fallbackReason: 'guest_mode' };

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.access_token) {
      return { ok: false, fallbackReason: 'no_session' };
    }

    const timeoutId = window.setTimeout(() => {
      controller.abort();
    }, 22000);

    let chunkCount = 0;
    try {
      const response = await fetch(`${supabaseUrl}/functions/v1/avc-assistant`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
          apikey: supabaseAnonKey,
        },
        body: JSON.stringify({
          mode: 'tts-stream',
          text: cleanText,
        }),
        signal: controller.signal,
      });

      const contentType = (response.headers.get('content-type') || '').toLowerCase();
      if (!response.ok || contentType.includes('application/json')) {
        if (response.status === 401) {
          notifyAuthSessionInvalidated();
        }
        try {
          const jsonBody = (await response.json()) as EdgeAssistantPayload;
          return { ok: false, fallbackReason: jsonBody.reason || 'tts_unavailable' };
        } catch {
          return { ok: false, fallbackReason: 'tts_unavailable' };
        }
      }

      if (!response.body) {
        return { ok: false, fallbackReason: 'tts_stream_unsupported' };
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let streamErrorReason: string | undefined;

      const processBlock = async (block: string) => {
        let eventName = 'message';
        const dataLines: string[] = [];

        for (const rawLine of block.split(/\r?\n/)) {
          if (rawLine.startsWith('event:')) {
            eventName = rawLine.slice(6).trim();
          } else if (rawLine.startsWith('data:')) {
            dataLines.push(rawLine.slice(5).trim());
          }
        }

        const dataText = dataLines.join('\n').trim();
        if (!dataText) return;

        if (eventName === 'error') {
          try {
            const parsed = JSON.parse(dataText) as { reason?: string };
            streamErrorReason = parsed.reason || 'tts_stream_failed';
          } catch {
            streamErrorReason = 'tts_stream_failed';
          }
          return;
        }

        if (eventName === 'done') return;

        try {
          const parsed = JSON.parse(dataText) as { data?: string; sampleRate?: number };
          if (parsed.data) {
            chunkCount += 1;
            const accepted = await onChunk(parsed.data, parsed.sampleRate || 24000);
            if (!accepted) {
              controller.abort();
            }
          }
        } catch {
          // Bỏ qua frame không hợp lệ
        }
      };

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const blocks = buffer.split(/\r?\n\r?\n/);
        buffer = blocks.pop() ?? '';

        for (const block of blocks) {
          if (controller.signal.aborted) break;
          if (block.trim()) {
            await processBlock(block);
          }
        }

        if (controller.signal.aborted || streamErrorReason) {
          break;
        }
      }

      if (!controller.signal.aborted && buffer.trim()) {
        await processBlock(buffer);
      }

      if (controller.signal.aborted && chunkCount === 0) {
        return { ok: false, aborted: true };
      }
      if (chunkCount === 0) {
        return { ok: false, fallbackReason: streamErrorReason || 'empty_audio_stream' };
      }

      return { ok: true };
    } catch {
      if (controller.signal.aborted) {
        return { ok: chunkCount > 0, aborted: true };
      }
      return { ok: chunkCount > 0, fallbackReason: 'tts_stream_network_error' };
    } finally {
      window.clearTimeout(timeoutId);
    }
  })();

  return {
    abort: () => controller.abort(),
    promise,
  };
}

/**
 * Gửi đoạn ghi âm lên Gemini để chép lời tiếng Việt khi trình duyệt không hỗ trợ SpeechRecognition trực tiếp.
 */
export async function transcribeAssistantAudio(
  audioBase64: string,
  mimeType: string,
  role: AssistantAudienceRole
): Promise<string | null> {
  if (!audioBase64.trim() || role === 'guest') return null;

  const data = await invokeAvcAssistantEdge(
    {
      mode: 'transcribe',
      audioBase64,
      mimeType,
    },
    role
  );

  if (data?.source === 'gemini-stt' && data.text?.trim()) {
    return data.text.trim();
  }

  return null;
}

