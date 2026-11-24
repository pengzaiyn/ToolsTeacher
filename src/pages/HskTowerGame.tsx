import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import QRCode from 'qrcode';
import {
  AlertTriangle,
  ArrowLeft,
  Clock,
  Copy,
  Crown,
  Maximize2,
  Play,
  Plus,
  QrCode,
  Search,
  Send,
  Sparkles,
  Trash2,
  Trophy,
  Users,
  Vote,
  X,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useRealtimeRefresh } from '@/hooks/useRealtimeRefresh';
import { HskCharacterAvatar } from '@/components/hsk/HskCharacters';
import {
  HskPodiumStage,
  HskTowerArena,
  type HskRoomPlayerRow,
} from '@/components/hsk/HskTowerArena';
import { formatDateTimeVi } from '@/lib/classStorage';
import {
  checkHskAnswer,
  generateRoomCode,
  HSK_AVATARS,
  HSK_THEME_INFO,
  HSK_TOPIC_LABELS,
  pickShuffledHskWords,
  type HskAvatarId,
  type HskInputMode,
  type HskTopicId,
  type HskTowerTheme,
  type HskWord,
} from '@/lib/hsk1Vocabulary';
import { isAdmin, isStaff } from '@/lib/roles';
import { supabase, supabaseAnonKey, supabaseUrl } from '@/lib/supabase';
import { Layout } from '@/components/Layout';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { DatePicker } from '@/components/ui/DatePicker';
import { EmptyState } from '@/components/ui/EmptyState';
import { GlowCardGrid } from '@/components/ui/GlowCardGrid';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Pagination } from '@/components/ui/Pagination';
import { QrShareCard } from '@/components/ui/QrShareCard';
import { Select } from '@/components/ui/Select';
import { LoadingState } from '@/components/ui/Spinner';
import { useToast } from '@/components/ui/Toast';

interface HskRoomRow {
  id: string;
  code: string;
  title: string;
  host_id: string;
  status: 'waiting' | 'playing' | 'finished';
  input_mode: HskInputMode;
  theme: HskTowerTheme;
  topic: HskTopicId;
  target_steps: number;
  time_limit_sec: number;
  max_players: number;
  words: HskWord[];
  started_at: string | null;
  finished_at: string | null;
  created_at: string;
}

function stripVi(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/\s+/g, ' ')
    .trim();
}

function toLocalDateKey(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function HskTowerGame() {
  const { user, profile } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const toast = useToast();

  const staffRole = isStaff(profile?.role);
  const adminRole = isAdmin(profile?.role);

  const [tablesReady, setTablesReady] = useState(true);
  const [loading, setLoading] = useState(true);

  const [rooms, setRooms] = useState<HskRoomRow[]>([]);
  const [roomCounts, setRoomCounts] = useState<Map<string, number>>(new Map());

  const [activeRoomId, setActiveRoomId] = useState<string | null>(null);
  const [activePlayers, setActivePlayers] = useState<HskRoomPlayerRow[]>([]);
  const [joinCode, setJoinCode] = useState('');
  const [selectedAvatar, setSelectedAvatar] = useState<HskAvatarId>('panda');
  const [joining, setJoining] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [qrModalOpen, setQrModalOpen] = useState(false);
  const autoJoinedCodeRef = useRef<string | null>(null);
  const accessTokenRef = useRef<string | null>(null);
  const leaveInfoRef = useRef<{ playerId: string; roomStatus: HskRoomRow['status'] } | null>(null);

  // Tạo phòng mới (GV / HT)
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [roomTitle, setRoomTitle] = useState('Đấu trường từ vựng HSK 1');
  const [roomTopic, setRoomTopic] = useState<HskTopicId>('all');
  const [roomTheme, setRoomTheme] = useState<HskTowerTheme>('lantern');
  const [roomTargetSteps, setRoomTargetSteps] = useState('10');
  const [roomTimeLimit, setRoomTimeLimit] = useState('180');

  // Trả lời trong trận
  const [answerInput, setAnswerInput] = useState('');
  const [submittingAnswer, setSubmittingAnswer] = useState(false);
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string } | null>(null);
  const [remainingSec, setRemainingSec] = useState<number>(0);
  const answerInputRef = useRef<HTMLInputElement>(null);

  // Điểm thưởng sau trận
  const [rewardDrafts, setRewardDrafts] = useState<Record<string, string>>({});
  const [savingRewards, setSavingRewards] = useState(false);
  const [deleteRoomTarget, setDeleteRoomTarget] = useState<HskRoomRow | null>(null);
  const [deletingRoom, setDeletingRoom] = useState(false);

  // Bộ lọc tìm kiếm chung (tên phòng, mã phòng, tên ngành, ngày chơi)
  const [lobbySearch, setLobbySearch] = useState('');
  const [lobbyDate, setLobbyDate] = useState('');
  const [roomTab, setRoomTab] = useState<'open' | 'finished'>('open');
  const [roomPage, setRoomPage] = useState(1);
  const ROOMS_PER_PAGE = 9;

  useEffect(() => {
    setRoomPage(1);
  }, [lobbySearch, lobbyDate, roomTab]);

  const loadLobby = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);
      try {
        const [roomRes, playerRes] = await Promise.all([
          supabase
            .from('hsk_rooms')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(100)
            .returns<HskRoomRow[]>(),
          supabase
            .from('hsk_room_players')
            .select('room_id')
            .returns<{ room_id: string }[]>(),
        ]);

        if (roomRes.error) {
          setTablesReady(false);
          setRooms([]);
          return;
        }

        setTablesReady(true);
        setRooms(roomRes.data ?? []);

        const counts = new Map<string, number>();
        for (const p of playerRes.data ?? []) {
          counts.set(p.room_id, (counts.get(p.room_id) ?? 0) + 1);
        }
        setRoomCounts(counts);
      } finally {
        if (!silent) setLoading(false);
      }
    },
    []
  );

  const loadActivePlayers = useCallback(async (roomId: string) => {
    const { data, error } = await supabase
      .from('hsk_room_players')
      .select('*')
      .eq('room_id', roomId)
      .order('joined_at', { ascending: true })
      .returns<HskRoomPlayerRow[]>();
    if (!error) {
      setActivePlayers(data ?? []);
    }
  }, []);

  useEffect(() => {
    void loadLobby();
  }, [loadLobby]);

  useEffect(() => {
    if (!activeRoomId) {
      setActivePlayers([]);
      return;
    }
    void loadActivePlayers(activeRoomId);
  }, [activeRoomId, loadActivePlayers]);

  useRealtimeRefresh({
    channelName: `hsk-tower-realtime-${activeRoomId ?? 'lobby'}`,
    tables: [{ table: 'hsk_rooms' }, { table: 'hsk_room_players' }],
    onRefresh: () => {
      void loadLobby(true);
      if (activeRoomId) void loadActivePlayers(activeRoomId);
    },
  });

  const activeRoom = useMemo(
    () => rooms.find((r) => r.id === activeRoomId) ?? null,
    [rooms, activeRoomId]
  );

  const filteredRooms = useMemo(() => {
    const q = stripVi(lobbySearch);
    return rooms.filter((room) => {
      if (lobbyDate) {
        const playDay = toLocalDateKey(room.started_at || room.created_at);
        if (playDay !== lobbyDate) return false;
      }
      if (!q) return true;
      const themeLabel = HSK_THEME_INFO[room.theme]?.label ?? '';
      const topicLabel = HSK_TOPIC_LABELS[room.topic] ?? '';
      const haystack = stripVi(
        `${room.title} ${room.code} ${themeLabel} ${topicLabel} tieng trung hsk`
      );
      return haystack.includes(q);
    });
  }, [rooms, lobbySearch, lobbyDate]);

  const filteredOpenRooms = useMemo(
    () => filteredRooms.filter((r) => r.status === 'waiting' || r.status === 'playing'),
    [filteredRooms]
  );

  const filteredFinishedRooms = useMemo(
    () => filteredRooms.filter((r) => r.status === 'finished'),
    [filteredRooms]
  );

  const visibleRooms = roomTab === 'open' ? filteredOpenRooms : filteredFinishedRooms;

  const myPlayer = useMemo(
    () => activePlayers.find((p) => p.user_id === user?.id) ?? null,
    [activePlayers, user?.id]
  );

  const isHost = Boolean(
    activeRoom && user && (activeRoom.host_id === user.id || adminRole)
  );

  // Giữ thông tin player hiện tại + access_token để tự động xóa khỏi phòng khi rời trang hoặc đóng tab
  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => {
      accessTokenRef.current = data.session?.access_token ?? null;
    });
  }, [user]);

  useEffect(() => {
    if (myPlayer && activeRoom && activeRoom.status !== 'finished') {
      leaveInfoRef.current = {
        playerId: myPlayer.id,
        roomStatus: activeRoom.status,
      };
    } else {
      leaveInfoRef.current = null;
    }
  }, [myPlayer, activeRoom]);

  const removePlayerKeepalive = useCallback((playerId: string) => {
    const token = accessTokenRef.current;
    if (!token || !supabaseUrl || !supabaseAnonKey) {
      void supabase.from('hsk_room_players').delete().eq('id', playerId);
      return;
    }
    try {
      void fetch(
        `${supabaseUrl}/rest/v1/hsk_room_players?id=eq.${encodeURIComponent(playerId)}`,
        {
          method: 'DELETE',
          keepalive: true,
          headers: {
            apikey: supabaseAnonKey,
            Authorization: `Bearer ${token}`,
          },
        }
      );
    } catch {
      void supabase.from('hsk_room_players').delete().eq('id', playerId);
    }
  }, []);

  // Tự động rời phòng khi đóng tab / F5 / chuyển sang trang khác trong web (không để nhân vật AFK)
  useEffect(() => {
    const handlePageExit = () => {
      const info = leaveInfoRef.current;
      if (info && info.roomStatus !== 'finished') {
        leaveInfoRef.current = null;
        removePlayerKeepalive(info.playerId);
      }
    };

    window.addEventListener('pagehide', handlePageExit);
    window.addEventListener('beforeunload', handlePageExit);
    return () => {
      window.removeEventListener('pagehide', handlePageExit);
      window.removeEventListener('beforeunload', handlePageExit);
      handlePageExit();
    };
  }, [removePlayerKeepalive]);

  async function handleLeaveRoom() {
    const info = leaveInfoRef.current;
    leaveInfoRef.current = null;
    if (info && info.roomStatus !== 'finished') {
      await supabase.from('hsk_room_players').delete().eq('id', info.playerId);
      setActivePlayers((prev) => prev.filter((p) => p.id !== info.playerId));
    }
    setActiveRoomId(null);
    setFeedback(null);
    await loadLobby(true);
  }

  async function handleKickPlayer(player: HskRoomPlayerRow) {
    if (!isHost) return;
    const { error } = await supabase.from('hsk_room_players').delete().eq('id', player.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.info(`Đã mời ${player.display_name} rời phòng`);
    if (activeRoomId) await loadActivePlayers(activeRoomId);
  }

  const roomJoinUrl = useMemo(() => {
    if (!activeRoom || typeof window === 'undefined') return '';
    return `${window.location.origin}/games/hsk-tower?room=${encodeURIComponent(activeRoom.code)}`;
  }, [activeRoom]);

  // Tạo mã QR ngay trên trình duyệt (không cần mạng ngoài)
  useEffect(() => {
    if (!roomJoinUrl) {
      setQrDataUrl(null);
      return;
    }
    let cancelled = false;
    void QRCode.toDataURL(roomJoinUrl, {
      width: 320,
      margin: 2,
      color: { dark: '#1A365D', light: '#FFFFFF' },
    })
      .then((url) => {
        if (!cancelled) setQrDataUrl(url);
      })
      .catch(() => {
        if (!cancelled) setQrDataUrl(null);
      });
    return () => {
      cancelled = true;
    };
  }, [roomJoinUrl]);

  // Tự động vào phòng khi sinh viên quét mã QR mở link ?room=CODE
  const requestedRoomCode = searchParams.get('room');
  useEffect(() => {
    if (!requestedRoomCode || loading || rooms.length === 0) return;
    const cleanCode = requestedRoomCode.trim().toUpperCase();
    if (!cleanCode || autoJoinedCodeRef.current === cleanCode) return;

    const matched = rooms.find((r) => r.code.toUpperCase() === cleanCode);
    if (!matched) return;

    autoJoinedCodeRef.current = cleanCode;
    setSearchParams({}, { replace: true });
    void handleJoinRoom(matched.id, matched.status !== 'waiting');
  }, [requestedRoomCode, loading, rooms]);

  // Đếm phiếu bầu chọn chế độ trong phòng chờ (bỏ trắc nghiệm, chỉ Gõ Pinyin / Gõ Chữ Hán)
  const voteStats = useMemo(() => {
    let pinyin = 0;
    let hanzi = 0;
    for (const p of activePlayers) {
      if (p.vote_mode === 'pinyin') pinyin += 1;
      if (p.vote_mode === 'hanzi') hanzi += 1;
    }
    return { pinyin, hanzi, total: pinyin + hanzi };
  }, [activePlayers]);

  // Đồng hồ đếm ngược khi trận đang diễn ra
  useEffect(() => {
    if (!activeRoom || activeRoom.status !== 'playing' || !activeRoom.started_at) {
      setRemainingSec(0);
      return;
    }
    const endTime = Date.parse(activeRoom.started_at) + activeRoom.time_limit_sec * 1000;
    const updateClock = () => {
      const left = Math.max(0, Math.ceil((endTime - Date.now()) / 1000));
      setRemainingSec(left);
      if (left === 0 && isHost && activeRoom.status === 'playing') {
        void supabase
          .from('hsk_rooms')
          .update({ status: 'finished', finished_at: new Date().toISOString() })
          .eq('id', activeRoom.id);
      }
    };
    updateClock();
    const id = window.setInterval(updateClock, 1000);
    return () => window.clearInterval(id);
  }, [activeRoom, isHost]);

  // Chuẩn bị điểm thưởng mặc định khi trận kết thúc
  useEffect(() => {
    if (!activeRoom || activeRoom.status !== 'finished') return;
    const sorted = [...activePlayers].sort((a, b) =>
      b.step !== a.step ? b.step - a.step : b.score - a.score
    );
    const nextDrafts: Record<string, string> = {};
    sorted.forEach((p, idx) => {
      const existing = Number(p.reward_points);
      if (existing > 0) {
        nextDrafts[p.id] = String(existing);
      } else {
        nextDrafts[p.id] = idx === 0 ? '1' : idx === 1 ? '0.5' : idx === 2 ? '0.25' : '0';
      }
    });
    setRewardDrafts(nextDrafts);
  }, [activeRoom?.status, activeRoom?.id, activePlayers.length]);

  async function handleCreateRoom(event: FormEvent) {
    event.preventDefault();
    if (!user || !roomTitle.trim()) return;
    setCreating(true);
    try {
      const steps = Math.max(5, Math.min(25, Number(roomTargetSteps) || 10));
      const limitSec = Math.max(30, Math.min(900, Number(roomTimeLimit) || 180));
      const words = pickShuffledHskWords(roomTopic, steps + 8);
      const code = generateRoomCode();

      const { data, error } = await supabase
        .from('hsk_rooms')
        .insert({
          code,
          title: roomTitle.trim(),
          host_id: user.id,
          status: 'waiting',
          input_mode: 'pinyin',
          theme: roomTheme,
          topic: roomTopic,
          target_steps: steps,
          time_limit_sec: limitSec,
          max_players: 5,
          words,
        })
        .select('*')
        .single<HskRoomRow>();

      if (error) throw new Error(error.message);
      toast.success(`Đã tạo phòng ${data.code} (tối đa 5 sinh viên tranh suất)`);
      setCreateOpen(false);
      setActiveRoomId(data.id);
      await loadLobby(true);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Không tạo được phòng chơi');
    } finally {
      setCreating(false);
    }
  }

  async function handleJoinRoom(roomId: string, asSpectator = false) {
    if (asSpectator) {
      setActiveRoomId(roomId);
      return;
    }

    setJoining(true);
    try {
      const { data, error } = await supabase.rpc('join_hsk_room', {
        p_room_id: roomId,
        p_avatar_id: selectedAvatar,
      });
      if (error) throw new Error(error.message);
      const res = data as { joined?: boolean; reason?: string } | null;
      if (res?.joined) {
        toast.success('Bạn đã giành được 1 suất vào phòng thi đấu!');
      } else if (res?.reason) {
        toast.info(res.reason);
      }
      setActiveRoomId(roomId);
      await loadActivePlayers(roomId);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Không vào được phòng');
    } finally {
      setJoining(false);
    }
  }

  async function handleCopyRoomLink() {
    if (!roomJoinUrl) return;
    try {
      await navigator.clipboard.writeText(roomJoinUrl);
      toast.success('Đã sao chép đường dẫn vào phòng!');
    } catch {
      toast.error('Không sao chép được đường dẫn');
    }
  }

  async function handleJoinByCode(event: FormEvent) {
    event.preventDefault();
    const clean = joinCode.trim().toUpperCase();
    if (!clean) return;
    const found = rooms.find((r) => r.code.toUpperCase() === clean);
    if (!found) {
      toast.error(`Không tìm thấy phòng có mã "${clean}"`);
      return;
    }
    await handleJoinRoom(found.id);
    setJoinCode('');
  }

  async function handleChangeAvatar(avatarId: HskAvatarId) {
    setSelectedAvatar(avatarId);
    if (!myPlayer || myPlayer.avatar_id === avatarId) return;
    const prevAvatar = myPlayer.avatar_id;
    const playerId = myPlayer.id;

    // Cập nhật ngay trên giao diện (optimistic) để chuyển nhân vật tức thì không bị trễ
    setActivePlayers((prev) =>
      prev.map((p) => (p.id === playerId ? { ...p, avatar_id: avatarId } : p))
    );

    const { error } = await supabase
      .from('hsk_room_players')
      .update({ avatar_id: avatarId })
      .eq('id', playerId);

    if (error) {
      setActivePlayers((prev) =>
        prev.map((p) => (p.id === playerId ? { ...p, avatar_id: prevAvatar } : p))
      );
      toast.error(error.message || 'Không đổi được nhân vật');
    }
  }

  async function handleVoteMode(mode: HskInputMode) {
    if (!activeRoom) return;
    if (myPlayer) {
      const playerId = myPlayer.id;
      setActivePlayers((prev) =>
        prev.map((p) => (p.id === playerId ? { ...p, vote_mode: mode } : p))
      );
      const { error } = await supabase
        .from('hsk_room_players')
        .update({ vote_mode: mode })
        .eq('id', playerId);
      if (error) toast.error(error.message);
    }
    if (isHost) {
      const roomId = activeRoom.id;
      setRooms((prev) => prev.map((r) => (r.id === roomId ? { ...r, input_mode: mode } : r)));
      const { error } = await supabase
        .from('hsk_rooms')
        .update({ input_mode: mode })
        .eq('id', roomId);
      if (error) toast.error(error.message);
    }
  }

  async function handleChangeRoomTheme(theme: HskTowerTheme) {
    if (!activeRoom || !isHost) return;
    const roomId = activeRoom.id;
    const prevTheme = activeRoom.theme;
    setRooms((prev) => prev.map((r) => (r.id === roomId ? { ...r, theme } : r)));
    const { error } = await supabase
      .from('hsk_rooms')
      .update({ theme })
      .eq('id', roomId);
    if (error) {
      setRooms((prev) => prev.map((r) => (r.id === roomId ? { ...r, theme: prevTheme } : r)));
      toast.error(error.message);
    }
  }

  async function handleStartMatch() {
    if (!activeRoom || !isHost) return;
    if (activePlayers.length === 0) {
      toast.error('Cần ít nhất 1 thí sinh trong phòng để bắt đầu');
      return;
    }

    // Chốt chế độ theo kết quả bầu phiếu nếu có phiếu
    let finalMode: HskInputMode = activeRoom.input_mode;
    if (voteStats.hanzi > voteStats.pinyin) finalMode = 'hanzi';
    else if (voteStats.pinyin > voteStats.hanzi) finalMode = 'pinyin';

    const { error } = await supabase
      .from('hsk_rooms')
      .update({
        status: 'playing',
        input_mode: finalMode,
        started_at: new Date().toISOString(),
        finished_at: null,
      })
      .eq('id', activeRoom.id);

    if (error) {
      toast.error(error.message);
      return;
    }
    setFeedback(null);
    setAnswerInput('');
    window.setTimeout(() => answerInputRef.current?.focus(), 80);
  }

  async function handleFinishMatch() {
    if (!activeRoom || !isHost) return;
    await supabase
      .from('hsk_rooms')
      .update({ status: 'finished', finished_at: new Date().toISOString() })
      .eq('id', activeRoom.id);
  }

  const currentWord: HskWord | null = useMemo(() => {
    if (!activeRoom || !myPlayer) return null;
    const words = Array.isArray(activeRoom.words) ? activeRoom.words : [];
    if (words.length === 0) return null;
    return words[myPlayer.step % words.length] ?? null;
  }, [activeRoom, myPlayer]);

  async function handleSubmitAnswer(event: FormEvent) {
    event.preventDefault();
    if (!activeRoom || !myPlayer || !currentWord || submittingAnswer) return;
    if (activeRoom.status !== 'playing') return;
    if (myPlayer.step >= activeRoom.target_steps) return;

    const ok = checkHskAnswer(currentWord, answerInput, activeRoom.input_mode);
    setSubmittingAnswer(true);
    try {
      if (ok) {
        const nextStep = myPlayer.step + 1;
        const nextCombo = myPlayer.combo + 1;
        const pointsGained = 10 + Math.min(10, (nextCombo - 1) * 2);
        const nextScore = myPlayer.score + pointsGained;
        const reachedTop = nextStep >= activeRoom.target_steps;

        await supabase
          .from('hsk_room_players')
          .update({
            step: nextStep,
            score: nextScore,
            combo: nextCombo,
            finished_at: reachedTop ? new Date().toISOString() : null,
          })
          .eq('id', myPlayer.id);

        setFeedback({
          ok: true,
          text: `Chính xác! ${currentWord.hanzi} (${currentWord.pinyin}) · +${pointsGained}đ`,
        });
        setAnswerInput('');

        if (reachedTop) {
          toast.success('Chúc mừng bạn đã chạm đỉnh tháp đầu tiên!');
          await supabase
            .from('hsk_rooms')
            .update({ status: 'finished', finished_at: new Date().toISOString() })
            .eq('id', activeRoom.id);
        }
      } else {
        await supabase
          .from('hsk_room_players')
          .update({
            combo: 0,
            wrong_count: myPlayer.wrong_count + 1,
          })
          .eq('id', myPlayer.id);
        setFeedback({
          ok: false,
          text: `Chưa đúng! Thử lại nhé (gợi ý: ${
            activeRoom.input_mode === 'pinyin'
              ? `${currentWord.pinyin.slice(0, 2)}...`
              : `${currentWord.hanzi.length} ký tự Hán`
          })`,
        });
      }
      window.setTimeout(() => answerInputRef.current?.focus(), 30);
    } finally {
      setSubmittingAnswer(false);
    }
  }

  async function handleSaveRewards() {
    if (!activeRoom || !isHost) return;
    setSavingRewards(true);
    try {
      for (const p of activePlayers) {
        const val = Number(rewardDrafts[p.id] ?? 0);
        if (!Number.isFinite(val) || val < 0) continue;
        const { error } = await supabase
          .from('hsk_room_players')
          .update({ reward_points: val })
          .eq('id', p.id);
        if (error) throw new Error(error.message);
      }
      toast.success('Đã lưu điểm thưởng cho các thí sinh!');
      await loadActivePlayers(activeRoom.id);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Không lưu được điểm thưởng');
    } finally {
      setSavingRewards(false);
    }
  }

  async function handleDeleteRoom() {
    if (!deleteRoomTarget) return;
    setDeletingRoom(true);
    try {
      const { error } = await supabase
        .from('hsk_rooms')
        .delete()
        .eq('id', deleteRoomTarget.id);
      if (error) throw new Error(error.message);
      toast.success(`Đã xóa phòng ${deleteRoomTarget.code}`);
      if (activeRoomId === deleteRoomTarget.id) setActiveRoomId(null);
      setDeleteRoomTarget(null);
      await loadLobby(true);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Không xóa được phòng');
    } finally {
      setDeletingRoom(false);
    }
  }

  return (
    <Layout>
      <div className="flex flex-col gap-6">
        {!tablesReady && (
          <div className="flex items-start gap-3 rounded-xl border border-status-warningBorder bg-status-warningBg p-4 text-sm text-status-warningText">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
            <div>
              <p className="font-semibold">Chưa chạy SQL khởi tạo trò chơi Leo Tháp HSK</p>
              <p className="mt-1 text-xs font-normal">
                Vui lòng chạy file{' '}
                <code>supabase/migrations/20261122000002_hsk_tower_game.sql</code> trên Supabase
                SQL Editor để bật phòng chơi Realtime 5 người và hộp thư Đề xuất trò chơi theo ngành.
              </p>
            </div>
          </div>
        )}

        {/* CHẾ ĐỘ BÊN TRONG PHÒNG CHƠI */}
        {activeRoom ? (
          <div className="flex flex-col gap-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex flex-wrap items-center gap-3">
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => void handleLeaveRoom()}
                >
                  <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                  <span>{myPlayer && activeRoom.status !== 'finished' ? 'Rời phòng' : 'Về sảnh phòng'}</span>
                </Button>
                <h1 className="text-xl font-bold text-brand-navy">{activeRoom.title}</h1>
                <Badge tone="red">Mã phòng: {activeRoom.code}</Badge>
                <Badge tone="navy">
                  {activePlayers.length}/{activeRoom.max_players} thí sinh
                </Badge>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {activeRoom.status === 'playing' && (
                  <Badge tone={remainingSec <= 20 ? 'danger' : 'navy'} className="gap-1 px-3 py-1.5 text-sm">
                    <Clock className="h-4 w-4" aria-hidden="true" />
                    <span>
                      {Math.floor(remainingSec / 60)}:
                      {String(remainingSec % 60).padStart(2, '0')}
                    </span>
                  </Badge>
                )}

                {activeRoom.status === 'waiting' && isHost && (
                  <Button variant="primary" onClick={handleStartMatch}>
                    <Play className="h-4 w-4" aria-hidden="true" />
                    <span>Bắt đầu thi đấu</span>
                  </Button>
                )}

                {activeRoom.status === 'playing' && isHost && (
                  <Button variant="danger" size="sm" onClick={handleFinishMatch}>
                    Kết thúc trận
                  </Button>
                )}
              </div>
            </div>

            {/* PHÒNG CHỜ: Bầu phiếu chế độ + Chọn nhân vật + Đổi chủ đề cột */}
            {activeRoom.status === 'waiting' && (
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
                <div className="flex flex-col gap-4 rounded-2xl border border-line bg-surface-card p-6 lg:col-span-7">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h2 className="text-base font-bold text-ink-primary">
                      Danh sách tranh suất ({activePlayers.length}/{activeRoom.max_players})
                    </h2>
                    {!myPlayer && activePlayers.length < activeRoom.max_players && (
                      <Button
                        size="sm"
                        variant="primary"
                        onClick={() => void handleJoinRoom(activeRoom.id)}
                        loading={joining}
                      >
                        Tranh suất vào chơi ngay!
                      </Button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-5">
                    {Array.from({ length: activeRoom.max_players }, (_, i) => {
                      const p = activePlayers[i];
                      return (
                        <div
                          key={p?.id ?? `wait-${i}`}
                          className={`relative flex flex-col items-center gap-2 rounded-xl border p-3 text-center ${
                            p
                              ? 'border-brand-navy/30 bg-brand-navySoft/30'
                              : 'border-dashed border-line bg-surface-page'
                          }`}
                        >
                          {p ? (
                            <>
                              {isHost && p.user_id !== user?.id && (
                                <button
                                  type="button"
                                  onClick={() => void handleKickPlayer(p)}
                                  title={`Mời ${p.display_name} rời phòng`}
                                  aria-label={`Mời ${p.display_name} rời phòng`}
                                  className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full text-ink-muted transition-colors hover:bg-brand-redSoft hover:text-brand-red"
                                >
                                  <X className="h-3.5 w-3.5" aria-hidden="true" />
                                </button>
                              )}
                              <HskCharacterAvatar avatarId={p.avatar_id} size={52} mood="happy" />
                              <span className="w-full truncate text-xs font-bold text-ink-primary">
                                {p.display_name}
                              </span>
                              <span className="text-[10px] font-semibold text-brand-navy">
                                {p.vote_mode === 'hanzi'
                                  ? 'Bầu: Chữ Hán'
                                  : p.vote_mode === 'pinyin'
                                    ? 'Bầu: Pinyin'
                                    : 'Chưa bầu phiếu'}
                              </span>
                            </>
                          ) : (
                            <span className="py-6 text-xs text-ink-muted">Suất #{i + 1} trống</span>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Chọn nhân vật của bạn */}
                  {myPlayer && (
                    <div className="flex flex-col gap-2 border-t border-line pt-4">
                      <span className="text-xs font-bold text-ink-primary">
                        Chọn nhân vật đại diện của bạn:
                      </span>
                      <div className="flex flex-wrap gap-2">
                        {HSK_AVATARS.map((av) => {
                          const selected = myPlayer.avatar_id === av.id;
                          return (
                            <button
                              key={av.id}
                              type="button"
                              onClick={() => void handleChangeAvatar(av.id)}
                              className={`flex items-center gap-2 rounded-xl border px-3 py-1.5 text-xs font-semibold transition-colors ${
                                selected
                                  ? 'border-brand-red bg-brand-redSoft text-brand-red'
                                  : 'border-line bg-surface-page text-ink-secondary hover:border-brand-navy'
                              }`}
                            >
                              <HskCharacterAvatar avatarId={av.id} size={28} />
                              <span>{av.name}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                  {/* Mã QR & Link mời sinh viên vào phòng (#478) */}
                  <div className="flex flex-col items-center gap-5 border-t border-line pt-4 sm:flex-row sm:items-center">
                    <QrShareCard
                      url={roomJoinUrl}
                      qrDataUrl={qrDataUrl}
                      displayLabel={`Phòng ${activeRoom.code}`}
                      altText={`Mã QR vào phòng ${activeRoom.code}`}
                      onCopied={() => toast.success('Đã sao chép đường dẫn vào phòng!')}
                    />

                    <div className="flex min-w-0 flex-1 flex-col gap-2">
                      <div className="flex items-center gap-2">
                        <QrCode className="h-4 w-4 text-brand-red" aria-hidden="true" />
                        <span className="text-sm font-bold text-ink-primary">
                          Quét mã QR để tranh suất vào phòng
                        </span>
                      </div>
                      <p className="text-xs font-normal text-ink-secondary">
                        Sinh viên dùng điện thoại quét mã QR này để tự động vào phòng{' '}
                        <strong className="text-brand-navy">{activeRoom.code}</strong> (tối đa{' '}
                        {activeRoom.max_players} thí sinh nhanh nhất).
                      </p>
                      <div className="flex flex-wrap items-center gap-2 pt-1">
                        <Button
                          size="sm"
                          variant="navy"
                          onClick={() => setQrModalOpen(true)}
                          disabled={!qrDataUrl}
                        >
                          <Maximize2 className="h-3.5 w-3.5" aria-hidden="true" />
                          <span>Phóng to QR (chiếu bảng)</span>
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Cột phải phòng chờ: Bầu phiếu chế độ gõ & Cài đặt 3 chủ đề cột */}
                <div className="flex flex-col gap-4 rounded-2xl border border-line bg-surface-card p-6 lg:col-span-5">
                  <div className="flex items-center gap-2">
                    <Vote className="h-5 w-5 text-brand-red" aria-hidden="true" />
                    <h2 className="text-base font-bold text-ink-primary">
                      Bầu phiếu chế độ gõ HSK 1
                    </h2>
                  </div>
                  <p className="text-xs font-normal text-ink-secondary">
                    Thí sinh và giáo viên cùng bầu chọn chế độ thi đấu (không dùng trắc nghiệm).
                  </p>

                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => void handleVoteMode('pinyin')}
                      className={`flex flex-col gap-1 rounded-xl border p-4 text-left transition-colors ${
                        myPlayer?.vote_mode === 'pinyin' ||
                        (!myPlayer && activeRoom.input_mode === 'pinyin')
                          ? 'border-brand-red bg-brand-redSoft/40'
                          : 'border-line bg-surface-page hover:border-brand-navy'
                      }`}
                    >
                      <span className="text-sm font-bold text-ink-primary">Gõ Pinyin</span>
                      <span className="text-[11px] text-ink-secondary">VD: ni hao</span>
                      <Badge tone="red" className="mt-2 self-start">
                        {voteStats.pinyin} phiếu
                      </Badge>
                    </button>

                    <button
                      type="button"
                      onClick={() => void handleVoteMode('hanzi')}
                      className={`flex flex-col gap-1 rounded-xl border p-4 text-left transition-colors ${
                        myPlayer?.vote_mode === 'hanzi' ||
                        (!myPlayer && activeRoom.input_mode === 'hanzi')
                          ? 'border-brand-navy bg-brand-navySoft/60'
                          : 'border-line bg-surface-page hover:border-brand-navy'
                      }`}
                    >
                      <span className="text-sm font-bold text-ink-primary">Gõ Chữ Hán</span>
                      <span className="text-[11px] text-ink-secondary">VD: 你好</span>
                      <Badge tone="navy" className="mt-2 self-start">
                        {voteStats.hanzi} phiếu
                      </Badge>
                    </button>
                  </div>

                  {/* Cài đặt chủ đề cột leo (3 chủ đề) */}
                  <div className="flex flex-col gap-2 border-t border-line pt-4">
                    <span className="text-xs font-bold text-ink-primary">
                      Chủ đề cột leo ({HSK_THEME_INFO[activeRoom.theme].label})
                    </span>
                    <div className="flex flex-col gap-2">
                      {(['lantern', 'bamboo', 'great_wall'] as HskTowerTheme[]).map((t) => {
                        const active = activeRoom.theme === t;
                        return (
                          <button
                            key={t}
                            type="button"
                            disabled={!isHost}
                            onClick={() => void handleChangeRoomTheme(t)}
                            className={`flex flex-col rounded-xl border p-3 text-left transition-colors disabled:cursor-default ${
                              active
                                ? 'border-brand-navy bg-brand-navySoft/50'
                                : 'border-line bg-surface-page hover:border-line-strong'
                            }`}
                          >
                            <span className="text-xs font-bold text-ink-primary">
                              {HSK_THEME_INFO[t].label}
                            </span>
                            <span className="text-[11px] text-ink-secondary">
                              {HSK_THEME_INFO[t].description}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ĐANG THI ĐẤU: Sân khấu 5 cột leo + Khung gõ từ vựng HSK 1 */}
            {activeRoom.status === 'playing' && (
              <div className="flex flex-col gap-6">
                <HskTowerArena
                  theme={activeRoom.theme}
                  targetSteps={activeRoom.target_steps}
                  players={activePlayers}
                  currentUserId={user?.id}
                />

                {myPlayer && currentWord ? (
                  <section className="rounded-2xl border border-brand-navy/30 bg-surface-card p-6">
                    <div className="flex flex-col items-center gap-4 text-center">
                      <div className="flex flex-wrap items-center justify-center gap-2">
                        <Badge tone="navy">
                          Câu {Math.min(myPlayer.step + 1, activeRoom.target_steps)} /{' '}
                          {activeRoom.target_steps}
                        </Badge>
                        <Badge tone="red">
                          {activeRoom.input_mode === 'pinyin'
                            ? 'Chế độ: Gõ Pinyin'
                            : 'Chế độ: Gõ Chữ Hán'}
                        </Badge>
                        {currentWord.partOfSpeech && (
                          <Badge tone="neutral">{currentWord.partOfSpeech}</Badge>
                        )}
                        {currentWord.isNewV3 && <Badge tone="success">HSK 3.0 mới</Badge>}
                      </div>

                      <div className="flex flex-col items-center gap-1">
                        <p className="text-3xl font-bold text-brand-navy">
                          {activeRoom.input_mode === 'pinyin'
                            ? currentWord.hanzi
                            : currentWord.pinyin}
                        </p>
                        <p className="text-base font-semibold text-ink-primary">
                          Nghĩa: {currentWord.meaning}
                        </p>
                      </div>

                      <form
                        onSubmit={handleSubmitAnswer}
                        className="flex w-full max-w-md gap-2"
                      >
                        <input
                          ref={answerInputRef}
                          type="text"
                          value={answerInput}
                          onChange={(e) => setAnswerInput(e.target.value)}
                          placeholder={
                            activeRoom.input_mode === 'pinyin'
                              ? 'Gõ Pinyin (VD: ni hao)...'
                              : 'Gõ chữ Hán (VD: 你好)...'
                          }
                          autoFocus
                          className="h-11 min-w-0 flex-1 rounded-xl border border-line-strong bg-surface-page px-4 text-base font-semibold text-ink-primary focus:border-brand-navy focus:outline-none focus:ring-2 focus:ring-brand-navy/20"
                        />
                        <Button type="submit" variant="primary" loading={submittingAnswer}>
                          <Send className="h-4 w-4" aria-hidden="true" />
                          <span>Leo nấc</span>
                        </Button>
                      </form>

                      {feedback && (
                        <p
                          className={`text-xs font-bold ${
                            feedback.ok ? 'text-status-successText' : 'text-brand-red'
                          }`}
                        >
                          {feedback.text}
                        </p>
                      )}
                    </div>
                  </section>
                ) : (
                  <div className="rounded-xl border border-line bg-surface-card p-4 text-center text-sm text-ink-secondary">
                    Bạn đang theo dõi trực tiếp trận đấu ở chế độ <strong>Khán giả</strong>.
                  </div>
                )}
              </div>
            )}

            {/* KẾT THÚC TRẬN: Bục Top 3 + Top 4 & 5 đứng dưới vỗ tay */}
            {activeRoom.status === 'finished' && (
              <HskPodiumStage
                players={activePlayers}
                canAwardPoints={isHost}
                rewardDrafts={rewardDrafts}
                onChangeReward={(pid, val) =>
                  setRewardDrafts((prev) => ({ ...prev, [pid]: val }))
                }
                onSaveRewards={() => void handleSaveRewards()}
                savingRewards={savingRewards}
              />
            )}
          </div>
        ) : (
          /* SẢNH PHÒNG LEO THÁP HSK 1 */
          <>
            <div className="flex flex-col gap-3">
              <div>
                <Link
                  to="/games"
                  className="inline-flex items-center gap-1.5 text-sm font-semibold text-ink-secondary transition-colors hover:text-brand-navy"
                >
                  <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                  <span>Danh sách trò chơi</span>
                </Link>
              </div>

              <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h1 className="text-2xl font-bold text-brand-navy">
                      Leo Tháp HSK 1 — Tiếng Trung
                    </h1>
                    <Badge tone="red">Tối đa 5 người / phòng</Badge>
                  </div>
                  <p className="mt-1 text-sm font-normal text-ink-secondary">
                    Tranh suất vào phòng, bầu phiếu chọn chế độ gõ Pinyin / Chữ Hán và đua leo đỉnh tháp nhận điểm thưởng!
                  </p>
                </div>
                {staffRole && (
                  <Button variant="primary" onClick={() => setCreateOpen(true)}>
                    <Plus className="h-4 w-4" aria-hidden="true" />
                    <span>Tạo phòng thi đấu</span>
                  </Button>
                )}
              </div>
            </div>

            {/* Thanh tìm kiếm phòng: tên phòng, mã phòng, chủ đề, ngày chơi */}
            <section className="grid grid-cols-1 gap-3 rounded-2xl border border-line bg-surface-card p-4 md:grid-cols-12">
              <div className="relative md:col-span-7">
                <Search
                  className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted"
                  aria-hidden="true"
                />
                <input
                  type="search"
                  value={lobbySearch}
                  onChange={(e) => setLobbySearch(e.target.value)}
                  placeholder="Tìm theo tên phòng, mã phòng, tên ngành hoặc chủ đề..."
                  aria-label="Tìm kiếm phòng thi đấu"
                  className="h-10 w-full rounded-lg border border-line-strong bg-surface-page pl-10 pr-4 text-sm font-normal text-ink-primary placeholder:text-ink-muted focus:border-brand-navy focus:outline-none focus:ring-2 focus:ring-brand-navy/20"
                />
              </div>
              <div className="md:col-span-3">
                <DatePicker
                  value={lobbyDate}
                  onChange={setLobbyDate}
                  ariaLabel="Lọc theo ngày chơi"
                  surface="page"
                  clearable
                />
              </div>
              <div className="flex items-center md:col-span-2">
                <Button
                  type="button"
                  variant="secondary"
                  className="w-full"
                  disabled={!lobbySearch && !lobbyDate}
                  onClick={() => {
                    setLobbySearch('');
                    setLobbyDate('');
                  }}
                >
                  Xóa lọc
                </Button>
              </div>
            </section>

            {/* Nhập mã phòng nhanh & chọn nhân vật trước khi tranh suất */}
            <section className="flex flex-col justify-between gap-4 rounded-2xl border border-line bg-surface-card p-4 lg:flex-row lg:items-center">
              <form onSubmit={handleJoinByCode} className="flex flex-1 gap-2">
                <input
                  type="text"
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                  placeholder="Nhập mã phòng (VD: HSK82) để tranh suất nhanh..."
                  className="h-10 min-w-0 flex-1 rounded-lg border border-line-strong bg-surface-page px-4 text-sm font-semibold uppercase text-ink-primary placeholder:normal-case placeholder:font-normal placeholder:text-ink-muted focus:border-brand-navy focus:outline-none"
                />
                <Button type="submit" variant="navy" loading={joining}>
                  Vào phòng
                </Button>
              </form>

              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-semibold text-ink-muted">Nhân vật:</span>
                {HSK_AVATARS.map((av) => (
                  <button
                    key={av.id}
                    type="button"
                    onClick={() => setSelectedAvatar(av.id)}
                    title={av.name}
                    className={`rounded-lg border p-1 transition-colors ${
                      selectedAvatar === av.id
                        ? 'border-brand-red bg-brand-redSoft'
                        : 'border-line bg-surface-page hover:border-brand-navy'
                    }`}
                  >
                    <HskCharacterAvatar avatarId={av.id} size={28} />
                  </button>
                ))}
              </div>
            </section>

            {/* Phân tách Phòng đang mở / Phòng đã kết thúc */}
            <div className="flex flex-wrap gap-2 border-b border-line pb-2" role="tablist">
              <button
                type="button"
                role="tab"
                aria-selected={roomTab === 'open'}
                onClick={() => setRoomTab('open')}
                className={`inline-flex h-10 items-center gap-2 rounded-lg px-4 text-sm font-semibold transition-colors ${
                  roomTab === 'open'
                    ? 'bg-brand-navy text-white'
                    : 'bg-surface-card text-ink-secondary hover:bg-surface-subtle hover:text-ink-primary'
                }`}
              >
                <Sparkles className="h-4 w-4" aria-hidden="true" />
                <span>Phòng đang mở ({filteredOpenRooms.length})</span>
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={roomTab === 'finished'}
                onClick={() => setRoomTab('finished')}
                className={`inline-flex h-10 items-center gap-2 rounded-lg px-4 text-sm font-semibold transition-colors ${
                  roomTab === 'finished'
                    ? 'bg-brand-navy text-white'
                    : 'bg-surface-card text-ink-secondary hover:bg-surface-subtle hover:text-ink-primary'
                }`}
              >
                <Trophy className="h-4 w-4" aria-hidden="true" />
                <span>Phòng đã kết thúc ({filteredFinishedRooms.length})</span>
              </button>
            </div>

            {loading ? (
              <LoadingState message="Đang tải danh sách phòng đấu HSK..." />
            ) : visibleRooms.length === 0 ? (
              <EmptyState
                icon={roomTab === 'open' ? Sparkles : Trophy}
                title={
                  roomTab === 'open'
                    ? 'Hiện chưa có phòng nào đang mở'
                    : 'Chưa có phòng nào đã kết thúc'
                }
                description={
                  lobbySearch || lobbyDate
                    ? 'Không tìm thấy phòng khớp với từ khóa hoặc ngày chơi đã chọn.'
                    : roomTab === 'open'
                      ? staffRole
                        ? 'Nhấn "Tạo phòng thi đấu" để mở phòng HSK 1 cho sinh viên tranh suất vào chơi.'
                        : 'Chờ giáo viên mở phòng thi đấu HSK 1 để tham gia nhé!'
                      : 'Các phòng thi đấu sau khi hoàn thành sẽ được lưu tại đây để xem lại bục vinh danh.'
                }
                action={
                  roomTab === 'open' && filteredFinishedRooms.length > 0 ? (
                    <Button variant="secondary" onClick={() => setRoomTab('finished')}>
                      Xem {filteredFinishedRooms.length} phòng đã kết thúc
                    </Button>
                  ) : undefined
                }
              />
            ) : (
              <div className="flex flex-col gap-6">
              <GlowCardGrid className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                {visibleRooms
                  .slice((roomPage - 1) * ROOMS_PER_PAGE, roomPage * ROOMS_PER_PAGE)
                  .map((room) => {
                  const count = roomCounts.get(room.id) ?? 0;
                  const isFull = count >= room.max_players;
                  const canDelete = adminRole || room.host_id === user?.id;

                  return (
                    <article
                      key={room.id}
                      data-u228-card
                      className="u228-c rounded-2xl"
                    >
                      <div
                        data-u228-inner
                        className="u228-in flex flex-col justify-between gap-4 overflow-hidden rounded-[calc(1rem-1.5px)] p-6"
                      >
                        <div className="flex flex-col gap-2">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <Badge tone="navy">{room.code}</Badge>
                            <Badge
                              tone={
                                room.status === 'waiting'
                                  ? 'success'
                                  : room.status === 'playing'
                                    ? 'red'
                                    : 'neutral'
                              }
                            >
                              {room.status === 'waiting'
                                ? 'Đang mở tranh suất'
                                : room.status === 'playing'
                                  ? 'Đang thi đấu'
                                  : 'Đã kết thúc'}
                            </Badge>
                          </div>
                          <h2 className="text-base font-bold text-ink-primary">{room.title}</h2>
                          <div className="flex flex-wrap items-center gap-2 text-xs text-ink-secondary">
                            <span>{HSK_THEME_INFO[room.theme]?.label}</span>
                            <span>•</span>
                            <span>{room.target_steps} nấc</span>
                            <span>•</span>
                            <span className="inline-flex items-center gap-1 font-semibold text-brand-navy">
                              <Users className="h-3.5 w-3.5" aria-hidden="true" />
                              {count}/{room.max_players}
                            </span>
                          </div>
                          <span className="text-[11px] text-ink-muted">
                            Tạo lúc: {formatDateTimeVi(room.created_at)}
                          </span>
                        </div>

                        <div className="flex items-center justify-between gap-2 border-t border-line pt-4">
                          {room.status === 'waiting' && !isFull ? (
                            <Button
                              size="sm"
                              variant="primary"
                              onClick={() => void handleJoinRoom(room.id)}
                              loading={joining}
                            >
                              <Sparkles className="h-4 w-4" aria-hidden="true" />
                              <span>Tranh suất ({count}/{room.max_players})</span>
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              variant="navy"
                              onClick={() => void handleJoinRoom(room.id, true)}
                            >
                              <span>
                                {room.status === 'finished' ? 'Xem bục vinh danh' : 'Xem trực tiếp'}
                              </span>
                            </Button>
                          )}

                          {canDelete && (
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => setDeleteRoomTarget(room)}
                              aria-label={`Xóa phòng ${room.code}`}
                            >
                              <Trash2 className="h-4 w-4 text-brand-red" aria-hidden="true" />
                            </Button>
                          )}
                        </div>
                      </div>
                    </article>
                  );
                })}
              </GlowCardGrid>
              {visibleRooms.length > ROOMS_PER_PAGE && (
                <div className="flex justify-center pt-1">
                  <Pagination
                    page={roomPage}
                    totalPages={Math.ceil(visibleRooms.length / ROOMS_PER_PAGE)}
                    onPageChange={setRoomPage}
                  />
                </div>
              )}
              </div>
            )}
          </>
        )}
      </div>

      {/* Modal tạo phòng thi đấu HSK 1 */}
      <Modal
        open={createOpen}
        onClose={() => {
          if (!creating) setCreateOpen(false);
        }}
        title="Tạo phòng Leo Tháp HSK 1"
        size="md"
      >
        <form onSubmit={handleCreateRoom} className="flex flex-col gap-4">
          <Input
            label="Tên phòng thi đấu"
            value={roomTitle}
            onChange={(e) => setRoomTitle(e.target.value)}
            required
          />
          <Select
            label="Chủ đề từ vựng HSK 1"
            value={roomTopic}
            onChange={(e) => setRoomTopic(e.target.value as HskTopicId)}
            options={Object.entries(HSK_TOPIC_LABELS).map(([value, label]) => ({
              value,
              label,
            }))}
          />
          <Select
            label="Chủ đề cột leo"
            value={roomTheme}
            onChange={(e) => setRoomTheme(e.target.value as HskTowerTheme)}
            options={(['lantern', 'bamboo', 'great_wall'] as HskTowerTheme[]).map((value) => ({
              value,
              label: `${HSK_THEME_INFO[value].label} — ${HSK_THEME_INFO[value].description}`,
            }))}
          />
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Số nấc thang (5–25)"
              type="number"
              min={5}
              max={25}
              value={roomTargetSteps}
              onChange={(e) => setRoomTargetSteps(e.target.value)}
              required
            />
            <Input
              label="Thời gian (giây)"
              type="number"
              min={30}
              max={900}
              value={roomTimeLimit}
              onChange={(e) => setRoomTimeLimit(e.target.value)}
              required
            />
          </div>
          <p className="text-xs text-ink-muted">
            Phòng giới hạn tối đa <strong>5 thí sinh</strong> tranh suất. Chế độ gõ (Pinyin hoặc Chữ Hán) sẽ được cả phòng bầu phiếu trước khi bắt đầu.
          </p>
          <div className="flex justify-end gap-2 border-t border-line pt-4">
            <Button variant="secondary" onClick={() => setCreateOpen(false)} disabled={creating}>
              Hủy
            </Button>
            <Button type="submit" variant="primary" loading={creating}>
              <Crown className="h-4 w-4" aria-hidden="true" />
              <span>Mở phòng ngay</span>
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modal phóng to mã QR chiếu trên màn hình lớp học */}
      <Modal
        open={qrModalOpen && Boolean(activeRoom)}
        onClose={() => setQrModalOpen(false)}
        title={activeRoom ? `Quét mã QR vào phòng ${activeRoom.code}` : 'Mã QR vào phòng'}
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => void handleCopyRoomLink()}>
              <Copy className="h-4 w-4" aria-hidden="true" />
              <span>Sao chép link</span>
            </Button>
            <Button variant="navy" onClick={() => setQrModalOpen(false)}>
              Đóng
            </Button>
          </>
        }
      >
        {activeRoom && (
          <div className="flex flex-col items-center gap-4 text-center">
            <QrShareCard
              url={roomJoinUrl}
              qrDataUrl={qrDataUrl}
              displayLabel={`Mã phòng: ${activeRoom.code}`}
              altText={`Mã QR lớn vào phòng ${activeRoom.code}`}
              size="lg"
              onCopied={() => toast.success('Đã sao chép đường dẫn vào phòng!')}
            />
            <p className="text-xs font-normal text-ink-secondary">
              Mở camera điện thoại quét mã QR để vào phòng tranh suất ngay (
              <strong>
                {activePlayers.length}/{activeRoom.max_players}
              </strong>{' '}
              thí sinh đã vào).
            </p>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={Boolean(deleteRoomTarget)}
        onClose={() => setDeleteRoomTarget(null)}
        onConfirm={handleDeleteRoom}
        loading={deletingRoom}
        confirmLabel="Xóa phòng"
        title="Xác nhận xóa phòng thi đấu"
        message={`Bạn chắc chắn muốn xóa phòng "${deleteRoomTarget?.title ?? ''}" (${deleteRoomTarget?.code ?? ''})?`}
      />
    </Layout>
  );
}
