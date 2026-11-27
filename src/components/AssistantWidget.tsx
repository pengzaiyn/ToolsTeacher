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
  RotateCcw,
  Send,
  SlidersHorizontal,
  X,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useSettingsModal } from '@/context/SettingsModalContext';
import {
  askAvcAssistant,
  type AssistantSource,
  type AssistantTurn,
} from '@/lib/assistantClient';
import {
  getSuggestedQuestions,
  type AssistantAction,
  type AssistantAudienceRole,
} from '@/lib/assistantKnowledge';
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
        'Chào bạn! Mình là Trợ lý AI của APC Connect. Bạn cần hướng dẫn đăng nhập, xác minh CAPTCHA, lấy lại mật khẩu qua email hay tìm hiểu các tính năng của trường thì cứ nhắn cho mình nhé.',
    };
  }

  if (role === 'student') {
    return {
      id: 'welcome',
      role: 'assistant',
      content: `Chào ${fullName}! Mình là Trợ lý AI của APC Connect. Bạn cần xem thời khóa biểu, kiểm tra bài tập hay hỏi cách dùng mục nào trên web thì cứ nhắn cho mình nhé.`,
    };
  }

  return {
    id: 'welcome',
    role: 'assistant',
    content: `Em chào ${fullName} (${roleLabel}) ạ! Em là Trợ lý AI của APC Connect. Thầy/cô cần hỗ trợ thao tác hay hỏi bất kỳ chức năng nào trên hệ thống cứ nhắn cho em ạ.`,
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
    setInteractionId(null);
    setActiveSource(null);
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

  async function submitQuestion(rawText: string) {
    if (sending) return;
    const text = rawText.trim();
    if (!text) return;

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
    } finally {
      setSending(false);
    }
  }

  function handleFormSubmit(event: FormEvent) {
    event.preventDefault();
    void submitQuestion(input);
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
            viewport.width - dialogWidth - VIEWPORT_PAD
          )}px`,
          top: `${clamp(
            robotPos.y + ROBOT_SIZE - dialogHeight,
            VIEWPORT_PAD,
            viewport.height - dialogHeight - VIEWPORT_PAD
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
                  Bạn có thắc mắc gì hãy hỏi AI APC
                </button>
                <button
                  type="button"
                  data-no-drag="true"
                  onClick={() => setCalloutDismissed(true)}
                  aria-label="Ẩn thông báo gợi ý hỏi AI APC"
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
            aria-label="Mở Trợ lý AI APC Connect"
            aria-expanded={open}
            title="Kéo để di chuyển · Bấm để trò chuyện với Trợ lý AI APC Connect"
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
                <AssistantRobot size="sm" />
              </div>
              <div className="min-w-0">
                <h2 id="avc-assistant-title" className="truncate text-sm font-bold leading-tight">
                  Trợ lý APC Connect
                </h2>
                <p className="truncate text-xs font-normal text-white/80">
                  {activeSource === 'gemini'
                    ? `Gemini AI · ${roleLabel}`
                    : activeSource === 'data'
                      ? `Dữ liệu hệ thống · ${roleLabel}`
                      : activeSource === 'local'
                        ? `Tra cứu nội bộ · ${roleLabel}`
                        : `Trợ lý hỏi đáp · ${roleLabel}`}
                </p>
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-2">
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

                  {!isUser && msg.source && (
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge
                        tone={
                          msg.source === 'gemini'
                            ? 'navy'
                            : msg.source === 'data'
                              ? 'success'
                              : 'neutral'
                        }
                      >
                        {msg.source === 'gemini'
                          ? 'Gemini AI'
                          : msg.source === 'data'
                            ? 'Dữ liệu hệ thống'
                            : 'Tra cứu nội bộ'}
                      </Badge>
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
                      onClick={() => void submitQuestion(question)}
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

          {/* Ô nhập câu hỏi */}
          <form
            onSubmit={handleFormSubmit}
            className="flex shrink-0 items-center gap-2 border-t border-line bg-surface-card p-4"
          >
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder="Nhập câu hỏi của bạn..."
              aria-label="Nhập câu hỏi cho Trợ lý AI"
              disabled={sending}
              className="h-10 min-w-0 flex-1 rounded-lg border border-line-strong bg-surface-page px-4 text-sm font-normal text-ink-primary placeholder:text-ink-muted focus:border-brand-navy focus:outline-none focus:ring-2 focus:ring-brand-navy/20 disabled:opacity-60"
            />
            <button
              type="submit"
              disabled={sending || !input.trim()}
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
