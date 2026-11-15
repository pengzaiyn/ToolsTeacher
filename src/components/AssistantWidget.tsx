import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  CornerDownRight,
  Mic,
  MicOff,
  RotateCcw,
  Send,
  SlidersHorizontal,
  Square,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useSettingsModal } from '@/context/SettingsModalContext';
import {
  askAvcAssistant,
  requestAssistantSpeech,
  startStreamAssistantSpeech,
  transcribeAssistantAudio,
  type AssistantAudioData,
  type AssistantSource,
  type AssistantTurn,
} from '@/lib/assistantClient';
import {
  getSuggestedQuestions,
  type AssistantAction,
  type AssistantAudienceRole,
} from '@/lib/assistantKnowledge';
import {
  blobToBase64,
  createStreamedPcmPlayer,
  getSpeechRecognitionConstructor,
  pickRecorderMimeType,
  playAudioBase64,
  sanitizeTextForSpeech,
  speakWithBrowserTts,
  supportsBrowserTts,
  supportsMediaRecording,
  supportsStreamedPcmPlayback,
  unlockAudioPlayback,
  type BrowserTtsUnavailableReason,
  type SpeechPlaybackHandle,
  type SpeechRecognitionInstance,
} from '@/lib/assistantVoice';
import { ROLE_LABELS } from '@/lib/roles';
import { AssistantRobot } from '@/components/AssistantRobot';
import { Badge } from '@/components/ui/Badge';
import { Spinner } from '@/components/ui/Spinner';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  source?: AssistantSource;
  actions?: AssistantAction[];
}

interface RobotPosition {
  x: number;
  y: number;
}

const ROBOT_SIZE = 64;
const VIEWPORT_PAD = 16;
const DRAG_THRESHOLD_PX = 5;
const ROBOT_POS_STORAGE_KEY = 'avc-assistant-robot-pos';
const VOICE_STORAGE_KEY = 'avc-assistant-voice-enabled';

function readSavedVoiceEnabled(): boolean {
  if (typeof window === 'undefined') return true;
  try {
    const raw = window.localStorage.getItem(VOICE_STORAGE_KEY);
    return raw === null ? true : raw === 'true';
  } catch {
    return true;
  }
}

function saveVoiceEnabled(enabled: boolean): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(VOICE_STORAGE_KEY, String(enabled));
  } catch {
    // Bỏ qua nếu trình duyệt chặn localStorage
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), Math.max(min, max));
}

function clampRobotPosition(x: number, y: number): RobotPosition {
  if (typeof window === 'undefined') {
    return { x, y };
  }
  const maxX = window.innerWidth - ROBOT_SIZE - VIEWPORT_PAD;
  const maxY = window.innerHeight - ROBOT_SIZE - VIEWPORT_PAD;
  return {
    x: Math.round(clamp(x, VIEWPORT_PAD, maxX)),
    y: Math.round(clamp(y, VIEWPORT_PAD, maxY)),
  };
}

function readSavedRobotPosition(): RobotPosition | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(ROBOT_POS_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { xRatio?: unknown; yRatio?: unknown };
    if (
      typeof parsed.xRatio !== 'number' ||
      typeof parsed.yRatio !== 'number' ||
      !Number.isFinite(parsed.xRatio) ||
      !Number.isFinite(parsed.yRatio)
    ) {
      return null;
    }
    const maxX = Math.max(VIEWPORT_PAD, window.innerWidth - ROBOT_SIZE - VIEWPORT_PAD);
    const maxY = Math.max(VIEWPORT_PAD, window.innerHeight - ROBOT_SIZE - VIEWPORT_PAD);
    const usableW = Math.max(1, maxX - VIEWPORT_PAD);
    const usableH = Math.max(1, maxY - VIEWPORT_PAD);
    const x = VIEWPORT_PAD + clamp(parsed.xRatio, 0, 1) * usableW;
    const y = VIEWPORT_PAD + clamp(parsed.yRatio, 0, 1) * usableH;
    return clampRobotPosition(x, y);
  } catch {
    return null;
  }
}

function saveRobotPosition(pos: RobotPosition | null): void {
  if (typeof window === 'undefined') return;
  try {
    if (!pos) {
      window.localStorage.removeItem(ROBOT_POS_STORAGE_KEY);
      return;
    }
    const maxX = Math.max(VIEWPORT_PAD, window.innerWidth - ROBOT_SIZE - VIEWPORT_PAD);
    const maxY = Math.max(VIEWPORT_PAD, window.innerHeight - ROBOT_SIZE - VIEWPORT_PAD);
    const usableW = Math.max(1, maxX - VIEWPORT_PAD);
    const usableH = Math.max(1, maxY - VIEWPORT_PAD);
    const payload = {
      xRatio: clamp((pos.x - VIEWPORT_PAD) / usableW, 0, 1),
      yRatio: clamp((pos.y - VIEWPORT_PAD) / usableH, 0, 1),
    };
    window.localStorage.setItem(ROBOT_POS_STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // Bỏ qua nếu trình duyệt chặn localStorage
  }
}

function createWelcomeMessage(
  fullName: string,
  roleLabel: string,
  role: AssistantAudienceRole
): ChatMessage {
  if (role === 'guest') {
    return {
      id: 'welcome',
      role: 'assistant',
      content:
        'Chào bạn! Mình là Trợ lý AI của AVC Connect. Bạn cần hướng dẫn đăng nhập, xác minh CAPTCHA, lấy lại mật khẩu qua email hay tìm hiểu các tính năng của trường thì cứ nhắn hoặc bấm nút micro nói chuyện với mình nhé.',
    };
  }

  if (role === 'student') {
    return {
      id: 'welcome',
      role: 'assistant',
      content: `Chào ${fullName}! Mình là Trợ lý AI của AVC Connect. Bạn cần xem thời khóa biểu, kiểm tra bài tập hay hỏi cách dùng mục nào trên web thì cứ nhắn hoặc bấm nút micro nói chuyện trực tiếp với mình nhé.`,
    };
  }

  return {
    id: 'welcome',
    role: 'assistant',
    content: `Em chào ${fullName} (${roleLabel}) ạ! Em là Trợ lý AI của AVC Connect. Thầy/cô cần hỗ trợ thao tác hay hỏi bất kỳ chức năng nào trên hệ thống cứ nhắn hoặc bấm nút micro nói chuyện trực tiếp với em ạ.`,
  };
}

/**
 * Hộp thoại Trợ lý AI nổi ở góc dưới bên phải cho cả trang đăng nhập và người dùng đã đăng nhập.
 */
export function AssistantWidget() {
  const { user, profile } = useAuth();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { isOpen: isSettingsOpen, openSettings } = useSettingsModal();

  const [open, setOpen] = useState(false);
  const [calloutDismissed, setCalloutDismissed] = useState(false);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [interactionId, setInteractionId] = useState<string | null>(null);
  const [activeSource, setActiveSource] = useState<AssistantSource | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [robotPos, setRobotPos] = useState<RobotPosition | null>(() => readSavedRobotPosition());
  const [isDragging, setIsDragging] = useState(false);
  const [facingLeft, setFacingLeft] = useState(false);
  const [voiceOutputEnabled, setVoiceOutputEnabled] = useState<boolean>(() =>
    readSavedVoiceEnabled()
  );
  const [speakingMessageId, setSpeakingMessageId] = useState<string | null>(null);
  const [speechLoadingId, setSpeechLoadingId] = useState<string | null>(null);
  const [isListening, setIsListening] = useState(false);
  const [micProcessing, setMicProcessing] = useState(false);
  const [voiceStatus, setVoiceStatus] = useState<string | null>(null);
  const [viewport, setViewport] = useState<{ width: number; height: number }>(() => ({
    width: typeof window !== 'undefined' ? window.innerWidth : 1280,
    height: typeof window !== 'undefined' ? window.innerHeight : 800,
  }));

  const scrollEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const prevSessionKeyRef = useRef<string | null>(null);
  const robotButtonRef = useRef<HTMLButtonElement>(null);
  const cleanupDragRef = useRef<(() => void) | null>(null);
  const suppressClickRef = useRef(false);
  const suppressTimerRef = useRef<number | null>(null);

  const voiceOutputRef = useRef(voiceOutputEnabled);
  voiceOutputRef.current = voiceOutputEnabled;
  const ttsRunIdRef = useRef(0);
  const playbackRef = useRef<SpeechPlaybackHandle | null>(null);
  const audioCacheRef = useRef<Map<string, AssistantAudioData>>(new Map());
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const micTranscriptRef = useRef('');
  const discardMicRef = useRef(false);
  const isListeningRef = useRef(false);
  isListeningRef.current = isListening;
  const submitQuestionRef = useRef<(rawText: string) => Promise<void>>(async () => {});

  const isSpeaking = speakingMessageId !== null;

  function stopSpeaking() {
    ttsRunIdRef.current += 1;
    playbackRef.current?.stop();
    playbackRef.current = null;
    setSpeechLoadingId(null);
    setSpeakingMessageId(null);
  }

  function releaseMediaStream() {
    if (mediaStreamRef.current) {
      for (const track of mediaStreamRef.current.getTracks()) {
        track.stop();
      }
      mediaStreamRef.current = null;
    }
  }

  function stopListening(discard = false) {
    discardMicRef.current = discard;

    if (recognitionRef.current) {
      const rec = recognitionRef.current;
      try {
        if (discard) {
          rec.abort();
        } else {
          rec.stop();
        }
      } catch {
        // Bỏ qua nếu recognition đã kết thúc
      }
      if (discard) {
        recognitionRef.current = null;
        setIsListening(false);
        setVoiceStatus(null);
      }
      return;
    }

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try {
        mediaRecorderRef.current.stop();
      } catch {
        releaseMediaStream();
        mediaRecorderRef.current = null;
        setIsListening(false);
      }
      return;
    }

    releaseMediaStream();
    setIsListening(false);
  }

  async function speakMessage(
    messageId: string,
    rawText: string,
    options?: { fromUserClick?: boolean }
  ) {
    if (speakingMessageId === messageId || speechLoadingId === messageId) {
      stopSpeaking();
      return;
    }

    stopSpeaking();
    if (!isListeningRef.current) {
      setVoiceStatus(null);
    }

    const spokenText = sanitizeTextForSpeech(rawText);
    if (!spokenText) return;

    const runId = ++ttsRunIdRef.current;
    const cacheKey = `${messageId}:${spokenText.slice(0, 64)}`;

    const runBrowserFallback = (fallbackReason?: string) => {
      if (ttsRunIdRef.current !== runId) return;
      if (!supportsBrowserTts()) {
        setSpeakingMessageId(null);
        setVoiceStatus('Trình duyệt hiện tại chưa hỗ trợ phát giọng nói.');
        return;
      }
      playbackRef.current = speakWithBrowserTts(spokenText, {
        onStart: () => {
          if (ttsRunIdRef.current === runId) {
            setSpeakingMessageId(messageId);
          }
        },
        onEnd: () => {
          if (ttsRunIdRef.current === runId) {
            playbackRef.current = null;
            setSpeakingMessageId(null);
          }
        },
        onUnavailable: (reason: BrowserTtsUnavailableReason) => {
          if (ttsRunIdRef.current !== runId) return;
          playbackRef.current = null;
          setSpeakingMessageId(null);

          if (reason === 'no_vi_voice') {
            if (fallbackReason === 'missing_api_key') {
              setVoiceStatus(
                'Máy chủ AI chưa gắn GEMINI_API_KEY và trình duyệt chưa có giọng tiếng Việt nên robot tạm tắt tiếng.'
              );
            } else if (audienceRole === 'guest') {
              setVoiceStatus(
                'Hãy đăng nhập để nghe giọng AI tiếng Việt tự nhiên, hoặc dùng Microsoft Edge có sẵn giọng tiếng Việt.'
              );
            } else {
              setVoiceStatus(
                'Trình duyệt hiện tại chưa có gói giọng tiếng Việt (vi-VN) và dịch vụ giọng AI đang tạm gián đoạn.'
              );
            }
          } else if (reason === 'unsupported') {
            setVoiceStatus('Trình duyệt hiện tại chưa hỗ trợ phát giọng nói.');
          } else {
            setVoiceStatus('Không thể phát giọng nói tiếng Việt lúc này. Bạn thử bấm Nghe lại nhé.');
          }
        },
      });
    };

    if (audienceRole !== 'guest') {
      let audioData = audioCacheRef.current.get(cacheKey) ?? null;
      let fallbackReason: string | undefined;

      if (!audioData && options?.fromUserClick) {
        unlockAudioPlayback();
      }

      if (!audioData && supportsStreamedPcmPlayback()) {
        let streamAborted = false;
        let streamFailedWithAutoplay = false;
        let abortStreamFn: (() => void) | null = null;

        const player = createStreamedPcmPlayer({
          onStart: () => {
            if (ttsRunIdRef.current === runId) {
              setSpeechLoadingId(null);
              setSpeakingMessageId(messageId);
            }
          },
          onEnd: () => {
            if (ttsRunIdRef.current === runId) {
              playbackRef.current = null;
              setSpeechLoadingId(null);
              setSpeakingMessageId(null);
            }
          },
          onError: (reason) => {
            if (ttsRunIdRef.current !== runId) return;
            playbackRef.current = null;
            setSpeechLoadingId(null);
            setSpeakingMessageId(null);
            if (reason === 'autoplay_blocked') {
              streamFailedWithAutoplay = true;
              setVoiceStatus(
                'Trình duyệt đang chặn tự phát âm thanh. Bạn bấm nút "Nghe" ở tin nhắn để robot đọc tiếng Việt nhé.'
              );
            }
          },
          onAbortRequest: () => {
            streamAborted = true;
            abortStreamFn?.();
          },
        });

        playbackRef.current = player;
        setSpeechLoadingId(messageId);

        const { abort, promise } = startStreamAssistantSpeech(
          spokenText,
          audienceRole,
          (chunkBase64, sampleRate) => player.pushBase64Chunk(chunkBase64, sampleRate)
        );
        abortStreamFn = abort;

        const streamResult = await promise;
        if (ttsRunIdRef.current !== runId || streamAborted) {
          return;
        }

        setSpeechLoadingId(null);

        if (streamResult.ok) {
          const cached = player.finish();
          if (cached) {
            audioCacheRef.current.set(cacheKey, {
              audioBase64: cached.wavBase64,
              mimeType: cached.mimeType,
            });
          }
          return;
        }

        playbackRef.current = null;
        setSpeakingMessageId(null);
        if (streamFailedWithAutoplay) {
          return;
        }
        fallbackReason = streamResult.fallbackReason;
        if (fallbackReason === 'missing_api_key') {
          runBrowserFallback('missing_api_key');
          return;
        }
      }

      const shouldTryUnaryTts =
        !audioData && (!supportsStreamedPcmPlayback() || fallbackReason === 'tts_stream_unsupported');
      if (shouldTryUnaryTts) {
        setSpeechLoadingId(messageId);
        const speechResult = await requestAssistantSpeech(spokenText, audienceRole);
        if (ttsRunIdRef.current !== runId) {
          setSpeechLoadingId(null);
          return;
        }
        setSpeechLoadingId(null);
        audioData = speechResult.audio;
        fallbackReason = speechResult.fallbackReason;
        if (audioData) {
          audioCacheRef.current.set(cacheKey, audioData);
        }
      }

      if (audioData) {
        setSpeakingMessageId(messageId);
        playbackRef.current = playAudioBase64(audioData.audioBase64, audioData.mimeType, {
          onStart: () => {
            if (ttsRunIdRef.current === runId) {
              setSpeakingMessageId(messageId);
            }
          },
          onEnd: () => {
            if (ttsRunIdRef.current === runId) {
              playbackRef.current = null;
              setSpeakingMessageId(null);
            }
          },
          onError: (reason) => {
            if (ttsRunIdRef.current !== runId) return;
            playbackRef.current = null;
            setSpeakingMessageId(null);
            if (reason === 'autoplay_blocked') {
              setVoiceStatus(
                'Trình duyệt đang chặn tự phát âm thanh. Bạn bấm nút "Nghe" ở tin nhắn để robot đọc tiếng Việt nhé.'
              );
              return;
            }
            runBrowserFallback(fallbackReason);
          },
        });
        return;
      }

      runBrowserFallback(fallbackReason);
      return;
    }

    runBrowserFallback();
  }

  function handleToggleVoiceOutput() {
    const next = !voiceOutputEnabled;
    setVoiceOutputEnabled(next);
    saveVoiceEnabled(next);
    if (next) {
      unlockAudioPlayback();
      setVoiceStatus(null);
    } else {
      stopSpeaking();
    }
  }

  async function handleToggleMicrophone() {
    if (sending || micProcessing) return;

    if (isListening) {
      stopListening(false);
      return;
    }

    // Ngắt lời robot nếu đang nói để chuyển sang nghe bạn nói ngay
    stopSpeaking();
    if (voiceOutputRef.current) {
      unlockAudioPlayback();
    }
    setVoiceStatus(null);
    discardMicRef.current = false;
    micTranscriptRef.current = '';

    const SpeechCtor = getSpeechRecognitionConstructor();
    if (SpeechCtor) {
      try {
        const recognition = new SpeechCtor();
        recognition.lang = 'vi-VN';
        recognition.continuous = false;
        recognition.interimResults = true;
        recognition.maxAlternatives = 1;

        recognition.onstart = () => {
          setIsListening(true);
          setVoiceStatus('Đang nghe bạn nói... Bấm micro lần nữa nếu muốn gửi ngay.');
        };

        recognition.onresult = (event) => {
          let fullTranscript = '';
          for (let i = 0; i < event.results.length; i += 1) {
            const result = event.results[i];
            if (result?.[0]?.transcript) {
              fullTranscript += `${result[0].transcript} `;
            }
          }
          const clean = fullTranscript.trim();
          micTranscriptRef.current = clean;
          setInput(clean);
        };

        recognition.onerror = (event) => {
          if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
            setVoiceStatus('Trình duyệt chưa được cấp quyền dùng micro.');
          } else if (event.error === 'no-speech') {
            setVoiceStatus('Mình chưa nghe rõ tiếng bạn, thử bấm micro nói lại nhé.');
          } else if (event.error !== 'aborted') {
            setVoiceStatus('Không nhận diện được giọng nói lúc này, bạn thử nói lại hoặc gõ nhé.');
          }
        };

        recognition.onend = () => {
          recognitionRef.current = null;
          setIsListening(false);
          const captured = micTranscriptRef.current.trim();
          micTranscriptRef.current = '';

          if (!discardMicRef.current && captured) {
            setVoiceStatus(null);
            void submitQuestionRef.current(captured);
          }
        };

        recognitionRef.current = recognition;
        recognition.start();
        return;
      } catch {
        recognitionRef.current = null;
        setIsListening(false);
      }
    }

    // Dự phòng bằng MediaRecorder + Gemini nếu trình duyệt không có SpeechRecognition
    if (!supportsMediaRecording()) {
      setVoiceStatus('Trình duyệt này chưa hỗ trợ micro nói chuyện trực tiếp.');
      return;
    }

    if (audienceRole === 'guest') {
      setVoiceStatus(
        'Trình duyệt này chưa hỗ trợ nhận giọng nói trực tiếp; bạn hãy gõ câu hỏi hoặc đăng nhập để dùng nhận diện AI nhé.'
      );
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const preferredMime = pickRecorderMimeType();
      const recorder = new MediaRecorder(
        stream,
        preferredMime ? { mimeType: preferredMime } : undefined
      );

      mediaStreamRef.current = stream;
      mediaRecorderRef.current = recorder;
      audioChunksRef.current = [];

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        const mimeType = recorder.mimeType || preferredMime || 'audio/webm';
        const chunks = audioChunksRef.current;
        audioChunksRef.current = [];
        mediaRecorderRef.current = null;
        releaseMediaStream();
        setIsListening(false);

        if (discardMicRef.current || chunks.length === 0) {
          setVoiceStatus(null);
          return;
        }

        const audioBlob = new Blob(chunks, { type: mimeType });
        void (async () => {
          setMicProcessing(true);
          setVoiceStatus('Đang nghe lại và chuyển giọng nói thành chữ...');
          try {
            const base64 = await blobToBase64(audioBlob);
            const transcript = await transcribeAssistantAudio(base64, mimeType, audienceRole);
            if (transcript?.trim()) {
              setVoiceStatus(null);
              await submitQuestionRef.current(transcript.trim());
            } else {
              setVoiceStatus('Mình chưa nghe rõ lời bạn nói, thử ghi âm lại gần micro hơn nhé.');
            }
          } catch {
            setVoiceStatus('Không xử lý được đoạn ghi âm lúc này, bạn thử gõ câu hỏi nhé.');
          } finally {
            setMicProcessing(false);
          }
        })();
      };

      recorder.start();
      setIsListening(true);
      setVoiceStatus('Đang ghi âm... Nói xong bấm lại nút micro để gửi.');
    } catch {
      releaseMediaStream();
      setVoiceStatus('Bạn cần cho phép quyền micro để nói chuyện với robot.');
    }
  }

  useEffect(() => {
    function handleResize() {
      setViewport({ width: window.innerWidth, height: window.innerHeight });
      setRobotPos((prev) => (prev ? clampRobotPosition(prev.x, prev.y) : null));
    }

    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      cleanupDragRef.current?.();
      if (suppressTimerRef.current !== null) {
        window.clearTimeout(suppressTimerRef.current);
      }
      playbackRef.current?.stop();
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {
          // Bỏ qua khi unmount
        }
      }
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        try {
          mediaRecorderRef.current.stop();
        } catch {
          // Bỏ qua khi unmount
        }
      }
      releaseMediaStream();
    };
  }, []);

  const audienceRole: AssistantAudienceRole = user && profile ? profile.role : 'guest';
  const displayName = profile?.full_name ?? 'bạn';
  const roleLabel = profile ? ROLE_LABELS[profile.role] : 'Khách truy cập';
  const sessionKey = user && profile ? profile.id : 'guest';

  const suggestedQuestions = useMemo(() => {
    return getSuggestedQuestions(audienceRole, pathname);
  }, [audienceRole, pathname]);

  // Khởi tạo hoặc làm mới lời chào khi trạng thái đăng nhập / tài khoản thay đổi
  useEffect(() => {
    const prevKey = prevSessionKeyRef.current;
    if (prevKey === sessionKey) return;

    prevSessionKeyRef.current = sessionKey;
    stopSpeaking();
    stopListening(true);
    audioCacheRef.current.clear();
    setInteractionId(null);
    setActiveSource(null);
    setVoiceStatus(null);
    setMessages([createWelcomeMessage(displayName, roleLabel, audienceRole)]);

    if (prevKey && prevKey !== 'guest' && sessionKey === 'guest') {
      setOpen(false);
    }
  }, [sessionKey, displayName, roleLabel, audienceRole]);

  useEffect(() => {
    if (!open) return;
    scrollEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [open, messages, sending]);

  useEffect(() => {
    if (!open || isSettingsOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (isListeningRef.current) {
          stopListening(true);
          return;
        }
        setOpen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, isSettingsOpen]);

  useEffect(() => {
    if (open && !isSettingsOpen) {
      inputRef.current?.focus();
    }
  }, [open, isSettingsOpen]);

  function handleResetConversation() {
    if (sending) return;
    stopSpeaking();
    stopListening(true);
    setVoiceStatus(null);
    setInteractionId(null);
    setActiveSource(null);
    setMessages([createWelcomeMessage(displayName, roleLabel, audienceRole)]);
  }

  function handleResetPosition() {
    setRobotPos(null);
    setFacingLeft(false);
    saveRobotPosition(null);
  }

  function handleOpenFromLauncher() {
    if (suppressClickRef.current) {
      suppressClickRef.current = false;
      return;
    }
    setOpen(true);
  }

  function handleLauncherPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    const target = event.target as HTMLElement | null;
    if (target?.closest('button[data-no-drag="true"]')) return;

    cleanupDragRef.current?.();

    const rect = robotButtonRef.current?.getBoundingClientRect();
    const origX =
      robotPos?.x ??
      (rect ? Math.round(rect.left) : viewport.width - ROBOT_SIZE - VIEWPORT_PAD);
    const origY =
      robotPos?.y ??
      (rect ? Math.round(rect.top) : viewport.height - ROBOT_SIZE - VIEWPORT_PAD);

    const dragState = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      origX,
      origY,
      moved: false,
    };

    suppressClickRef.current = false;

    const handleMove = (moveEvent: PointerEvent) => {
      if (moveEvent.pointerId !== dragState.pointerId) return;

      const dx = moveEvent.clientX - dragState.startX;
      const dy = moveEvent.clientY - dragState.startY;

      if (!dragState.moved) {
        if (Math.hypot(dx, dy) <= DRAG_THRESHOLD_PX) return;
        dragState.moved = true;
        setIsDragging(true);
        window.getSelection()?.removeAllRanges();
      }

      if (Math.abs(dx) > 4) {
        setFacingLeft(dx < 0);
      }

      const nextPos = clampRobotPosition(dragState.origX + dx, dragState.origY + dy);
      setRobotPos(nextPos);
    };

    const finishDrag = (endEvent: PointerEvent, shouldSave: boolean) => {
      if (endEvent.pointerId !== dragState.pointerId) return;
      cleanup();
      setIsDragging(false);

      if (dragState.moved) {
        suppressClickRef.current = true;
        if (suppressTimerRef.current !== null) {
          window.clearTimeout(suppressTimerRef.current);
        }
        suppressTimerRef.current = window.setTimeout(() => {
          suppressClickRef.current = false;
          suppressTimerRef.current = null;
        }, 120);

        if (shouldSave) {
          const dx = endEvent.clientX - dragState.startX;
          const dy = endEvent.clientY - dragState.startY;
          const finalPos = clampRobotPosition(dragState.origX + dx, dragState.origY + dy);
          setRobotPos(finalPos);
          saveRobotPosition(finalPos);
        }
      }
    };

    const handleUp = (upEvent: PointerEvent) => finishDrag(upEvent, true);
    const handleCancel = (cancelEvent: PointerEvent) => finishDrag(cancelEvent, false);

    const cleanup = () => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
      window.removeEventListener('pointercancel', handleCancel);
      if (cleanupDragRef.current === cleanup) {
        cleanupDragRef.current = null;
      }
    };

    cleanupDragRef.current = cleanup;
    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleUp);
    window.addEventListener('pointercancel', handleCancel);
  }

  function handleActionClick(action: AssistantAction) {
    if (action.target === '#settings-modal') {
      setOpen(false);
      openSettings();
      return;
    }
    navigate(action.target);
  }

  async function submitQuestion(rawText: string, options?: { fromUserGesture?: boolean }) {
    if (sending) return;
    const text = rawText.trim();
    if (!text) return;

    stopSpeaking();
    if (options?.fromUserGesture && voiceOutputRef.current) {
      unlockAudioPlayback();
    }
    setVoiceStatus(null);

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: text,
    };

    const recentHistory: AssistantTurn[] = messages
      .filter((m) => m.id !== 'welcome')
      .slice(-6)
      .map((m) => ({ role: m.role, content: m.content }));

    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setSending(true);

    try {
      const result = await askAvcAssistant({
        message: text,
        role: audienceRole,
        currentPath: pathname,
        previousInteractionId: interactionId,
        history: recentHistory,
      });

      setActiveSource(result.source);
      if (result.interactionId) {
        setInteractionId(result.interactionId);
      }

      const assistantMsgId = `assistant-${Date.now()}`;
      setMessages((prev) => [
        ...prev,
        {
          id: assistantMsgId,
          role: 'assistant',
          content: result.reply,
          source: result.source,
          actions: result.actions,
        },
      ]);

      if (voiceOutputRef.current) {
        void speakMessage(assistantMsgId, result.reply);
      }
    } catch (err) {
      const errText =
        err instanceof Error
          ? err.message
          : 'Không thể xử lý yêu cầu lúc này. Vui lòng thử lại.';
      const errId = `err-${Date.now()}`;
      setMessages((prev) => [
        ...prev,
        {
          id: errId,
          role: 'assistant',
          content: errText,
        },
      ]);
      if (voiceOutputRef.current) {
        void speakMessage(errId, errText);
      }
    } finally {
      setSending(false);
    }
  }

  submitQuestionRef.current = submitQuestion;

  function handleFormSubmit(event: FormEvent) {
    event.preventDefault();
    void submitQuestion(input, { fromUserGesture: true });
  }

  const showSuggestions = messages.length <= 1 && !sending;

  const spaceLeft = robotPos ? Math.max(120, robotPos.x - VIEWPORT_PAD - 8) : 320;
  const spaceRight = robotPos
    ? Math.max(120, viewport.width - (robotPos.x + ROBOT_SIZE + 8) - VIEWPORT_PAD)
    : 320;
  const placeCalloutOnRight = robotPos !== null && spaceRight > spaceLeft;
  const calloutWrapperStyle = robotPos
    ? { maxWidth: `${Math.min(320, placeCalloutOnRight ? spaceRight : spaceLeft)}px` }
    : undefined;

  const dialogWidth = Math.min(400, viewport.width - VIEWPORT_PAD * 2);
  const dialogHeight = Math.min(544, viewport.height - VIEWPORT_PAD * 2);
  const customDialogStyle =
    robotPos && viewport.width >= 640
      ? {
          left: `${clamp(
            placeCalloutOnRight ? robotPos.x : robotPos.x + ROBOT_SIZE - dialogWidth,
            VIEWPORT_PAD,
            viewport.width - dialogWidth - VIEWPORT_PAD,
          )}px`,
          top: `${clamp(
            robotPos.y + ROBOT_SIZE - dialogHeight,
            VIEWPORT_PAD,
            viewport.height - dialogHeight - VIEWPORT_PAD,
          )}px`,
        }
      : undefined;

  return (
    <>
      {!open && !isSettingsOpen && (
        <div
          onPointerDown={handleLauncherPointerDown}
          onDragStart={(event) => event.preventDefault()}
          style={
            robotPos
              ? { left: `${robotPos.x}px`, top: `${robotPos.y}px` }
              : undefined
          }
          className={`fixed z-[39] touch-none select-none print:hidden ${
            isDragging ? 'cursor-grabbing' : 'cursor-grab'
          } ${
            robotPos
              ? 'h-16 w-16'
              : 'robot-patrol-track bottom-4 right-4 flex max-w-[calc(100vw-3rem)] items-center justify-end gap-2 sm:bottom-6 sm:right-6'
          }`}
        >
          {!calloutDismissed && (
            <div
              style={calloutWrapperStyle}
              className={
                robotPos
                  ? `absolute top-1/2 w-max -translate-y-1/2 ${
                      placeCalloutOnRight ? 'left-full pl-2' : 'right-full pr-2'
                    }`
                  : 'min-w-0'
              }
            >
              <div className="robot-callout-float flex min-w-0 items-center gap-2 rounded-xl border border-line bg-surface-card py-2 pl-4 pr-2 shadow-lg">
                <span className="relative flex h-2 w-2 shrink-0" aria-hidden="true">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand-red opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-brand-red" />
                </span>
                <button
                  type="button"
                  onClick={handleOpenFromLauncher}
                  className="min-w-0 text-left text-xs font-semibold text-ink-primary transition-colors hover:text-brand-navy focus-visible:outline-none focus-visible:underline sm:text-sm"
                >
                  Bạn có thắc mắc gì hãy hỏi AI AVC
                </button>
                <button
                  type="button"
                  data-no-drag="true"
                  onClick={() => setCalloutDismissed(true)}
                  aria-label="Ẩn thông báo gợi ý hỏi AI AVC"
                  title="Ẩn gợi ý"
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-ink-muted transition-colors hover:bg-surface-subtle hover:text-ink-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-navy"
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
            </div>
          )}

          <button
            ref={robotButtonRef}
            type="button"
            onClick={handleOpenFromLauncher}
            aria-label="Mở Trợ lý AI AVC Connect"
            aria-expanded={open}
            title="Kéo để di chuyển · Bấm để nói chuyện với Trợ lý AI AVC Connect"
            className={`flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl transition-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-navy focus-visible:ring-offset-2 ${
              isDragging
                ? 'cursor-grabbing'
                : 'cursor-grab hover:scale-105 active:scale-95'
            }`}
          >
            <AssistantRobot
              size="lg"
              facingLeft={facingLeft}
              dragging={isDragging}
              speaking={isSpeaking}
              listening={isListening}
            />
          </button>
        </div>
      )}

      {open && !isSettingsOpen && (
        <section
          role="dialog"
          aria-modal="false"
          aria-labelledby="avc-assistant-title"
          style={customDialogStyle}
          className={`fixed z-[39] flex h-[544px] max-h-[calc(100vh-2rem)] w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-2xl border border-line bg-surface-card shadow-2xl sm:w-[400px] print:hidden ${
            customDialogStyle ? '' : 'bottom-4 right-4 sm:bottom-6 sm:right-6'
          }`}
        >
          {/* Phần đầu hộp thoại trợ lý */}
          <div className="flex shrink-0 items-center justify-between gap-2 border-b border-line bg-brand-navy px-4 py-4 text-white">
            <div className="flex min-w-0 items-center gap-2">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-surface-bright">
                <AssistantRobot size="sm" speaking={isSpeaking} listening={isListening} />
              </div>
              <div className="min-w-0">
                <h2 id="avc-assistant-title" className="truncate text-sm font-bold leading-tight">
                  Trợ lý AVC Connect
                </h2>
                <p className="truncate text-xs font-normal text-white/80">
                  {isListening
                    ? `Đang lắng nghe · ${roleLabel}`
                    : isSpeaking
                      ? `Đang nói chuyện · ${roleLabel}`
                      : activeSource === 'gemini'
                        ? `Gemini AI · ${roleLabel}`
                        : activeSource === 'local'
                          ? `Tra cứu nội bộ · ${roleLabel}`
                          : `Trò chuyện tự nhiên · ${roleLabel}`}
                </p>
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-2">
              <button
                type="button"
                onClick={handleToggleVoiceOutput}
                aria-label={
                  voiceOutputEnabled
                    ? 'Tắt tự động đọc giọng nói'
                    : 'Bật tự động đọc giọng nói'
                }
                title={
                  voiceOutputEnabled
                    ? 'Đang bật giọng nói tự động (bấm để tắt)'
                    : 'Đang tắt giọng nói tự động (bấm để bật)'
                }
                className="flex h-8 w-8 items-center justify-center rounded-lg text-white/80 transition-colors hover:bg-white/15 hover:text-white"
              >
                {voiceOutputEnabled ? (
                  <Volume2 className="h-4 w-4" aria-hidden="true" />
                ) : (
                  <VolumeX className="h-4 w-4" aria-hidden="true" />
                )}
              </button>

              {robotPos && (
                <button
                  type="button"
                  onClick={handleResetPosition}
                  aria-label="Đưa robot về góc mặc định"
                  title="Đưa robot về góc mặc định"
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-white/80 transition-colors hover:bg-white/15 hover:text-white"
                >
                  <CornerDownRight className="h-4 w-4" aria-hidden="true" />
                </button>
              )}

              <button
                type="button"
                onClick={handleResetConversation}
                disabled={sending}
                aria-label="Bắt đầu cuộc trò chuyện mới"
                title="Cuộc trò chuyện mới"
                className="flex h-8 w-8 items-center justify-center rounded-lg text-white/80 transition-colors hover:bg-white/15 hover:text-white disabled:opacity-50"
              >
                <RotateCcw className="h-4 w-4" aria-hidden="true" />
              </button>

              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Đóng Trợ lý AI"
                title="Đóng (Esc)"
                className="flex h-8 w-8 items-center justify-center rounded-lg text-white/80 transition-colors hover:bg-white/15 hover:text-white"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>
          </div>

          {/* Nội dung hội thoại */}
          <div className="flex flex-1 flex-col gap-4 overflow-y-auto bg-surface-page p-4">
            {messages.map((msg) => {
              const isUser = msg.role === 'user';
              const isMsgSpeaking = speakingMessageId === msg.id;
              const isMsgLoadingSpeech = speechLoadingId === msg.id;
              return (
                <div
                  key={msg.id}
                  className={`flex flex-col gap-2 ${isUser ? 'items-end' : 'items-start'}`}
                >
                  <div
                    className={`max-w-[88%] whitespace-pre-line rounded-xl px-4 py-2 text-sm font-normal leading-relaxed ${
                      isUser
                        ? 'bg-brand-navy text-white'
                        : 'border border-line bg-surface-card text-ink-primary'
                    }`}
                  >
                    {msg.content}
                  </div>

                  {!isUser && (
                    <div className="flex flex-wrap items-center gap-2">
                      {msg.source && (
                        <Badge tone={msg.source === 'gemini' ? 'navy' : 'neutral'}>
                          {msg.source === 'gemini' ? 'Gemini AI' : 'Tra cứu nội bộ'}
                        </Badge>
                      )}

                      <button
                        type="button"
                        onClick={() => void speakMessage(msg.id, msg.content, { fromUserClick: true })}
                        aria-label={
                          isMsgSpeaking || isMsgLoadingSpeech
                            ? 'Dừng đọc tin nhắn'
                            : 'Nghe robot đọc tin nhắn'
                        }
                        className={`inline-flex h-8 items-center gap-2 rounded-lg border px-2 text-xs font-semibold transition-colors ${
                          isMsgSpeaking || isMsgLoadingSpeech
                            ? 'border-brand-red/30 bg-brand-redSoft text-brand-red'
                            : 'border-line bg-surface-card text-ink-secondary hover:border-brand-navy hover:text-brand-navy'
                        }`}
                      >
                        {isMsgLoadingSpeech ? (
                          <>
                            <Spinner size="sm" />
                            <span>Đang tạo giọng...</span>
                          </>
                        ) : isMsgSpeaking ? (
                          <>
                            <Square className="h-3 w-3 shrink-0" aria-hidden="true" />
                            <span>Dừng đọc</span>
                          </>
                        ) : (
                          <>
                            <Volume2 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                            <span>Nghe</span>
                          </>
                        )}
                      </button>
                    </div>
                  )}

                  {!isUser && msg.actions && msg.actions.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {msg.actions.map((action) => (
                        <button
                          key={`${msg.id}-${action.target}`}
                          type="button"
                          onClick={() => handleActionClick(action)}
                          className="inline-flex h-8 items-center gap-2 rounded-lg border border-brand-navy/20 bg-brand-navySoft px-4 text-xs font-semibold text-brand-navy transition-colors hover:bg-brand-navy hover:text-white"
                        >
                          {action.target === '#settings-modal' && (
                            <SlidersHorizontal className="h-3 w-3 shrink-0" aria-hidden="true" />
                          )}
                          <span>{action.label}</span>
                          <ArrowRight className="h-3 w-3 shrink-0" aria-hidden="true" />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}

            {showSuggestions && suggestedQuestions.length > 0 && (
              <div className="flex flex-col gap-2 pt-2">
                <span className="text-xs font-semibold text-ink-muted">Gợi ý nhanh cho bạn</span>
                <div className="flex flex-col gap-2">
                  {suggestedQuestions.map((question) => (
                    <button
                      key={question}
                      type="button"
                      onClick={() => void submitQuestion(question, { fromUserGesture: true })}
                      className="rounded-xl border border-line bg-surface-card px-4 py-2 text-left text-xs font-semibold text-ink-secondary transition-colors hover:border-brand-navy hover:bg-brand-navySoft/50 hover:text-brand-navy"
                    >
                      {question}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {sending && (
              <div className="flex items-center gap-2 self-start rounded-xl border border-line bg-surface-card px-4 py-2 text-xs font-normal text-ink-secondary">
                <Spinner size="sm" />
                <span>Đang suy nghĩ và trả lời...</span>
              </div>
            )}

            <div ref={scrollEndRef} />
          </div>

          {(voiceStatus || isSpeaking || speechLoadingId !== null) && (
            <div
              className={`flex shrink-0 items-center justify-between gap-2 border-t border-line px-4 py-2 text-xs font-semibold ${
                isListening
                  ? 'bg-brand-redSoft text-brand-red'
                  : 'bg-brand-navySoft text-brand-navy'
              }`}
            >
              <span className="min-w-0 truncate">
                {voiceStatus
                  ? voiceStatus
                  : speechLoadingId !== null
                    ? 'Đang chuẩn bị giọng nói tự nhiên...'
                    : 'Robot đang nói chuyện...'}
              </span>

              {(isSpeaking || speechLoadingId !== null) && (
                <button
                  type="button"
                  onClick={stopSpeaking}
                  className="inline-flex h-8 shrink-0 items-center rounded-lg px-2 text-xs font-semibold text-brand-red transition-colors hover:bg-brand-red/10"
                >
                  Dừng
                </button>
              )}
            </div>
          )}

          {/* Ô nhập câu hỏi và micro nói chuyện */}
          <form
            onSubmit={handleFormSubmit}
            className="flex shrink-0 items-center gap-2 border-t border-line bg-surface-card p-4"
          >
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(event) => {
                setInput(event.target.value);
                if (voiceStatus && !isListening) setVoiceStatus(null);
              }}
              placeholder={
                isListening
                  ? 'Đang lắng nghe giọng nói...'
                  : 'Nhắn hoặc bấm micro để nói...'
              }
              aria-label="Nhập câu hỏi cho Trợ lý AI"
              disabled={sending || micProcessing}
              className="h-10 min-w-0 flex-1 rounded-lg border border-line-strong bg-surface-page px-4 text-sm font-normal text-ink-primary placeholder:text-ink-muted focus:border-brand-navy focus:outline-none focus:ring-2 focus:ring-brand-navy/20 disabled:opacity-60"
            />
            <button
              type="button"
              onClick={() => void handleToggleMicrophone()}
              disabled={sending || micProcessing}
              aria-label={isListening ? 'Dừng nghe giọng nói' : 'Nói chuyện bằng micro'}
              title={
                isListening
                  ? 'Bấm để dừng và gửi câu vừa nói'
                  : 'Bấm để nói chuyện bằng tiếng Việt'
              }
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-navy disabled:cursor-not-allowed disabled:opacity-50 ${
                isListening
                  ? 'animate-pulse bg-brand-red text-white hover:bg-brand-redHover'
                  : 'border border-line-strong bg-surface-page text-ink-secondary hover:border-brand-navy hover:text-brand-navy'
              }`}
            >
              {micProcessing ? (
                <Spinner size="sm" />
              ) : isListening ? (
                <MicOff className="h-4 w-4" aria-hidden="true" />
              ) : (
                <Mic className="h-4 w-4" aria-hidden="true" />
              )}
            </button>
            <button
              type="submit"
              disabled={sending || micProcessing || isListening || !input.trim()}
              aria-label="Gửi câu hỏi"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-red text-white transition-colors hover:bg-brand-redHover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-navy disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Send className="h-4 w-4" aria-hidden="true" />
            </button>
          </form>
        </section>
      )}
    </>
  );
}
