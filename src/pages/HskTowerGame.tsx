import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import QRCode from 'qrcode';
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Clock,
  Copy,
  Crown,
  Lightbulb,
  Maximize2,
  Play,
  Plus,
  QrCode,
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
import { EmptyState } from '@/components/ui/EmptyState';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
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

interface GameSuggestionRow {
  id: string;
  major_name: string;
  game_title: string;
  description: string;
  status: 'pending' | 'reviewing' | 'planned' | 'done';
  admin_note: string | null;
  created_by: string;
  created_by_name: string;
  created_at: string;
}

const SUGGESTION_STATUS_META: Record<
  GameSuggestionRow['status'],
  { label: string; tone: 'neutral' | 'warning' | 'navy' | 'success' }
> = {
  pending: { label: 'Chờ Hiệu trưởng xem', tone: 'warning' },
  reviewing: { label: 'Đang xem xét', tone: 'navy' },
  planned: { label: 'Đã lên kế hoạch', tone: 'navy' },
  done: { label: 'Đã triển khai', tone: 'success' },
};

export function HskTowerGame() {
  const { user, profile } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const toast = useToast();

  const staffRole = isStaff(profile?.role);
  const adminRole = isAdmin(profile?.role);

  const [mainTab, setMainTab] = useState<'rooms' | 'suggestions'>(() =>
    searchParams.get('tab') === 'suggestions' ? 'suggestions' : 'rooms'
  );

  useEffect(() => {
    if (searchParams.get('tab') === 'suggestions') {
      setMainTab('suggestions');
      setActiveRoomId(null);
    }
  }, [searchParams]);
  const [tablesReady, setTablesReady] = useState(true);
  const [loading, setLoading] = useState(true);

  const [rooms, setRooms] = useState<HskRoomRow[]>([]);
  const [roomCounts, setRoomCounts] = useState<Map<string, number>>(new Map());
  const [suggestions, setSuggestions] = useState<GameSuggestionRow[]>([]);

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

  // Đề xuất trò chơi theo ngành gửi Hiệu trưởng
  const [suggestOpen, setSuggestOpen] = useState(false);
  const [suggesting, setSuggesting] = useState(false);
  const [suggestMajor, setSuggestMajor] = useState('');
  const [suggestTitle, setSuggestTitle] = useState('');
  const [suggestDesc, setSuggestDesc] = useState('');

  const loadLobby = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);
      try {
        const [roomRes, playerRes, suggestRes] = await Promise.all([
          supabase
            .from('hsk_rooms')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(20)
            .returns<HskRoomRow[]>(),
          supabase
            .from('hsk_room_players')
            .select('room_id')
            .returns<{ room_id: string }[]>(),
          supabase
            .from('game_suggestions')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(30)
            .returns<GameSuggestionRow[]>(),
        ]);

        if (roomRes.error) {
          setTablesReady(false);
          setRooms([]);
          setSuggestions([]);
          return;
        }

        setTablesReady(true);
        setRooms(roomRes.data ?? []);

        const counts = new Map<string, number>();
        for (const p of playerRes.data ?? []) {
          counts.set(p.room_id, (counts.get(p.room_id) ?? 0) + 1);
        }
        setRoomCounts(counts);

        if (!suggestRes.error) {
          setSuggestions(suggestRes.data ?? []);
        }
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
    tables: [{ table: 'hsk_rooms' }, { table: 'hsk_room_players' }, { table: 'game_suggestions' }],
    onRefresh: () => {
      void loadLobby(true);
      if (activeRoomId) void loadActivePlayers(activeRoomId);
    },
  });

  const activeRoom = useMemo(
    () => rooms.find((r) => r.id === activeRoomId) ?? null,
    [rooms, activeRoomId]
  );

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
    return `${window.location.origin}/hsk-tower?room=${encodeURIComponent(activeRoom.code)}`;
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
    if (!myPlayer) return;
    await supabase
      .from('hsk_room_players')
      .update({ avatar_id: avatarId })
      .eq('id', myPlayer.id);
  }

  async function handleVoteMode(mode: HskInputMode) {
    if (!activeRoom) return;
    if (myPlayer) {
      await supabase
        .from('hsk_room_players')
        .update({ vote_mode: mode })
        .eq('id', myPlayer.id);
    }
    if (isHost) {
      await supabase
        .from('hsk_rooms')
        .update({ input_mode: mode })
        .eq('id', activeRoom.id);
    }
  }

  async function handleChangeRoomTheme(theme: HskTowerTheme) {
    if (!activeRoom || !isHost) return;
    const { error } = await supabase
      .from('hsk_rooms')
      .update({ theme })
      .eq('id', activeRoom.id);
    if (error) {
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

  async function handleSubmitSuggestion(event: FormEvent) {
    event.preventDefault();
    if (!user || !profile) return;
    if (!suggestMajor.trim() || !suggestTitle.trim() || !suggestDesc.trim()) {
      toast.error('Vui lòng điền đầy đủ ngành học, tên trò chơi và mô tả ý tưởng');
      return;
    }
    setSuggesting(true);
    try {
      const { error } = await supabase.from('game_suggestions').insert({
        major_name: suggestMajor.trim(),
        game_title: suggestTitle.trim(),
        description: suggestDesc.trim(),
        created_by: user.id,
        created_by_name: profile.full_name,
      });
      if (error) throw new Error(error.message);
      toast.success('Đã gửi đề xuất trò chơi tới Hiệu trưởng!');
      setSuggestOpen(false);
      setSuggestMajor('');
      setSuggestTitle('');
      setSuggestDesc('');
      setMainTab('suggestions');
      await loadLobby(true);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Không gửi được đề xuất');
    } finally {
      setSuggesting(false);
    }
  }

  async function handleUpdateSuggestionStatus(
    id: string,
    status: GameSuggestionRow['status']
  ) {
    const { error } = await supabase
      .from('game_suggestions')
      .update({ status })
      .eq('id', id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success('Đã cập nhật trạng thái đề xuất');
    await loadLobby(true);
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
                  {/* Mã QR & Link mời sinh viên vào phòng */}
                  <div className="flex flex-col gap-4 border-t border-line pt-4 sm:flex-row sm:items-center">
                    <div className="flex shrink-0 items-center justify-center rounded-xl border border-line bg-white p-2">
                      {qrDataUrl ? (
                        <img
                          src={qrDataUrl}
                          alt={`Mã QR vào phòng ${activeRoom.code}`}
                          className="h-32 w-32 object-contain"
                        />
                      ) : (
                        <div className="flex h-32 w-32 items-center justify-center text-ink-muted">
                          <QrCode className="h-10 w-10" aria-hidden="true" />
                        </div>
                      )}
                    </div>

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
                        <Button size="sm" variant="secondary" onClick={() => void handleCopyRoomLink()}>
                          <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                          <span>Sao chép link</span>
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
          /* SẢNH CHÍNH: Danh sách phòng đấu + Tab Đề xuất trò chơi theo ngành */
          <>
            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-2xl font-bold text-brand-navy">
                    Leo Tháp HSK — Tiếng Trung
                  </h1>
                  <Badge tone="red">Tối đa 5 người / phòng</Badge>
                </div>
                <p className="mt-1 text-sm font-normal text-ink-secondary">
                  Tranh suất vào phòng, bầu phiếu chọn chế độ gõ Pinyin / Chữ Hán và đua leo đỉnh tháp nhận điểm thưởng!
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button variant="secondary" onClick={() => setSuggestOpen(true)}>
                  <Lightbulb className="h-4 w-4 text-brand-red" aria-hidden="true" />
                  <span>Đề xuất trò chơi cho ngành</span>
                </Button>
                {staffRole && (
                  <Button variant="primary" onClick={() => setCreateOpen(true)}>
                    <Plus className="h-4 w-4" aria-hidden="true" />
                    <span>Tạo phòng thi đấu</span>
                  </Button>
                )}
              </div>
            </div>

            {/* Chuyển tab Phòng đấu / Đề xuất trò chơi */}
            <div className="flex gap-2 border-b border-line pb-2" role="tablist">
              <button
                type="button"
                role="tab"
                aria-selected={mainTab === 'rooms'}
                onClick={() => setMainTab('rooms')}
                className={`inline-flex h-10 items-center gap-2 rounded-lg px-4 text-sm font-semibold transition-colors ${
                  mainTab === 'rooms'
                    ? 'bg-brand-navy text-white'
                    : 'bg-surface-card text-ink-secondary hover:bg-surface-subtle hover:text-ink-primary'
                }`}
              >
                <Trophy className="h-4 w-4" aria-hidden="true" />
                <span>Phòng thi đấu ({rooms.length})</span>
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={mainTab === 'suggestions'}
                onClick={() => setMainTab('suggestions')}
                className={`inline-flex h-10 items-center gap-2 rounded-lg px-4 text-sm font-semibold transition-colors ${
                  mainTab === 'suggestions'
                    ? 'bg-brand-navy text-white'
                    : 'bg-surface-card text-ink-secondary hover:bg-surface-subtle hover:text-ink-primary'
                }`}
              >
                <Lightbulb className="h-4 w-4" aria-hidden="true" />
                <span>Đề xuất trò chơi các ngành ({suggestions.length})</span>
              </button>
            </div>

            {mainTab === 'rooms' ? (
              <>
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

                {loading ? (
                  <LoadingState message="Đang tải danh sách phòng đấu HSK..." />
                ) : rooms.length === 0 ? (
                  <EmptyState
                    icon={Trophy}
                    title="Chưa có phòng thi đấu nào"
                    description={
                      staffRole
                        ? 'Nhấn "Tạo phòng thi đấu" để mở phòng HSK 1 cho sinh viên tranh suất vào chơi.'
                        : 'Chờ giáo viên mở phòng thi đấu HSK 1 để tham gia nhé!'
                    }
                  />
                ) : (
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {rooms.map((room) => {
                      const count = roomCounts.get(room.id) ?? 0;
                      const isFull = count >= room.max_players;
                      const canDelete = adminRole || room.host_id === user?.id;

                      return (
                        <article
                          key={room.id}
                          className="flex flex-col justify-between gap-4 rounded-2xl border border-line bg-surface-card p-6"
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
                        </article>
                      );
                    })}
                  </div>
                )}
              </>
            ) : (
              /* TAB ĐỀ XUẤT TRÒ CHƠI CHO CÁC NGÀNH GỬI HIỆU TRƯỞNG */
              <div className="flex flex-col gap-4">
                {suggestions.length === 0 ? (
                  <EmptyState
                    icon={Lightbulb}
                    title="Chưa có đề xuất trò chơi nào"
                    description="Hãy là người đầu tiên đề xuất ý tưởng trò chơi học tập cho ngành của bạn gửi tới Hiệu trưởng!"
                    action={
                      <Button variant="primary" onClick={() => setSuggestOpen(true)}>
                        Gửi đề xuất ngay
                      </Button>
                    }
                  />
                ) : (
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    {suggestions.map((item) => {
                      const meta = SUGGESTION_STATUS_META[item.status] ?? SUGGESTION_STATUS_META.pending;
                      return (
                        <article
                          key={item.id}
                          className="flex flex-col justify-between gap-3 rounded-2xl border border-line bg-surface-card p-6"
                        >
                          <div className="flex flex-col gap-2">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <Badge tone="red">{item.major_name}</Badge>
                              <Badge tone={meta.tone}>{meta.label}</Badge>
                            </div>
                            <h3 className="text-base font-bold text-ink-primary">
                              {item.game_title}
                            </h3>
                            <p className="whitespace-pre-line text-sm font-normal text-ink-secondary">
                              {item.description}
                            </p>
                            <span className="text-xs text-ink-muted">
                              Đề xuất bởi <strong>{item.created_by_name}</strong> ·{' '}
                              {formatDateTimeVi(item.created_at)}
                            </span>
                          </div>

                          {adminRole && (
                            <div className="flex flex-wrap items-center gap-2 border-t border-line pt-3">
                              <span className="text-xs font-semibold text-ink-muted">
                                Hiệu trưởng duyệt:
                              </span>
                              {(['reviewing', 'planned', 'done'] as const).map((st) => (
                                <Button
                                  key={st}
                                  size="sm"
                                  variant={item.status === st ? 'navy' : 'secondary'}
                                  onClick={() => void handleUpdateSuggestionStatus(item.id, st)}
                                >
                                  {st === 'done' && (
                                    <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                                  )}
                                  <span>{SUGGESTION_STATUS_META[st].label}</span>
                                </Button>
                              ))}
                            </div>
                          )}
                        </article>
                      );
                    })}
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

      {/* Modal đề xuất trò chơi cho ngành gửi Hiệu trưởng */}
      <Modal
        open={suggestOpen}
        onClose={() => {
          if (!suggesting) setSuggestOpen(false);
        }}
        title="Đề xuất trò chơi học tập cho ngành của bạn"
        size="md"
      >
        <form onSubmit={handleSubmitSuggestion} className="flex flex-col gap-4">
          <Input
            label="Ngành học / Bộ môn"
            value={suggestMajor}
            onChange={(e) => setSuggestMajor(e.target.value)}
            placeholder="VD: Công nghệ Thông tin, Công nghệ Ô tô, Tiếng Nhật, Chăm sóc sắc đẹp..."
            required
          />
          <Input
            label="Tên trò chơi đề xuất"
            value={suggestTitle}
            onChange={(e) => setSuggestTitle(e.target.value)}
            placeholder="VD: Đua gõ phím lệnh Linux, Ghép linh kiện PC, Đấu từ vựng N5..."
            required
          />
          <div className="flex flex-col gap-2">
            <label htmlFor="suggest-desc" className="text-sm font-semibold text-ink-primary">
              Mô tả cách chơi mong muốn <span className="text-brand-red">*</span>
            </label>
            <textarea
              id="suggest-desc"
              rows={4}
              value={suggestDesc}
              onChange={(e) => setSuggestDesc(e.target.value)}
              placeholder="Mô tả ngắn luật chơi, số người chơi và lợi ích cho buổi học..."
              required
              className="w-full rounded-lg border border-line-strong bg-surface-card p-4 text-sm font-normal text-ink-primary placeholder:text-ink-muted focus:border-brand-navy focus:outline-none focus:ring-2 focus:ring-brand-navy/20"
            />
          </div>
          <div className="flex justify-end gap-2 border-t border-line pt-4">
            <Button variant="secondary" onClick={() => setSuggestOpen(false)} disabled={suggesting}>
              Hủy
            </Button>
            <Button type="submit" variant="primary" loading={suggesting}>
              <Send className="h-4 w-4" aria-hidden="true" />
              <span>Gửi tới Hiệu trưởng</span>
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
            <div className="rounded-2xl border border-line bg-white p-4 shadow-sm">
              {qrDataUrl && (
                <img
                  src={qrDataUrl}
                  alt={`Mã QR lớn vào phòng ${activeRoom.code}`}
                  className="h-64 w-64 object-contain"
                />
              )}
            </div>
            <div className="flex flex-col items-center gap-1">
              <span className="text-xs font-semibold text-ink-muted">Mã phòng thi đấu</span>
              <span className="rounded-xl bg-brand-redSoft px-6 py-2 text-3xl font-bold tracking-widest text-brand-red">
                {activeRoom.code}
              </span>
            </div>
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
