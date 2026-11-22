import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link, Navigate, useSearchParams } from 'react-router-dom';
import {
  ArrowRight,
  CheckCircle2,
  Gamepad2,
  Lightbulb,
  Search,
  Send,
  Trophy,
  Users,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useRealtimeRefresh } from '@/hooks/useRealtimeRefresh';
import { formatDateTimeVi } from '@/lib/classStorage';
import { isAdmin } from '@/lib/roles';
import { supabase } from '@/lib/supabase';
import { Layout } from '@/components/Layout';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { LoadingState } from '@/components/ui/Spinner';
import { useToast } from '@/components/ui/Toast';

interface GameCatalogItem {
  id: string;
  to: string;
  title: string;
  major: string;
  description: string;
  maxPlayersLabel: string;
  badge?: string;
  icon: typeof Trophy;
  keywords: string;
}

const GAME_CATALOG: GameCatalogItem[] = [
  {
    id: 'hsk-tower',
    to: '/games/hsk-tower',
    title: 'Leo Tháp HSK 1',
    major: 'Tiếng Trung',
    description:
      'Đấu trường ghi từ vựng HSK 1 (ver 3.0) thời gian thực: tranh 5 suất vào phòng qua mã QR, bầu phiếu Gõ Pinyin hoặc Gõ Chữ Hán, chọn 3 chủ đề cột leo và vinh danh Top 3.',
    maxPlayersLabel: 'Tối đa 5 người / phòng',
    badge: 'Đang mở',
    icon: Trophy,
    keywords: 'tieng trung hsk 1 tu vung pinyin chu han leo thap',
  },
];

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

export function Games() {
  const { user, profile } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const toast = useToast();
  const adminRole = isAdmin(profile?.role);

  const requestedRoomCode = searchParams.get('room');

  const [activeTab, setActiveTab] = useState<'games' | 'suggestions'>(() =>
    searchParams.get('tab') === 'suggestions' ? 'suggestions' : 'games'
  );

  useEffect(() => {
    if (searchParams.get('tab') === 'suggestions') {
      setActiveTab('suggestions');
    }
  }, [searchParams]);

  const [loading, setLoading] = useState(true);
  const [hskRoomStats, setHskRoomStats] = useState({ total: 0, open: 0 });
  const [suggestions, setSuggestions] = useState<GameSuggestionRow[]>([]);

  const [searchText, setSearchText] = useState('');
  const [filterDate, setFilterDate] = useState('');

  // Modal đề xuất trò chơi cho các ngành gửi Hiệu trưởng
  const [suggestOpen, setSuggestOpen] = useState(false);
  const [suggesting, setSuggesting] = useState(false);
  const [suggestMajor, setSuggestMajor] = useState('');
  const [suggestTitle, setSuggestTitle] = useState('');
  const [suggestDesc, setSuggestDesc] = useState('');

  const loadData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const [roomsRes, suggestRes] = await Promise.all([
        supabase
          .from('hsk_rooms')
          .select('id, status')
          .returns<{ id: string; status: string }[]>(),
        supabase
          .from('game_suggestions')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(100)
          .returns<GameSuggestionRow[]>(),
      ]);

      if (!roomsRes.error && roomsRes.data) {
        const openCount = roomsRes.data.filter(
          (r) => r.status === 'waiting' || r.status === 'playing'
        ).length;
        setHskRoomStats({ total: roomsRes.data.length, open: openCount });
      }

      if (!suggestRes.error) {
        setSuggestions(suggestRes.data ?? []);
      }
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useRealtimeRefresh({
    channelName: 'games-hub-realtime',
    tables: [{ table: 'hsk_rooms' }, { table: 'game_suggestions' }],
    onRefresh: () => {
      void loadData(true);
    },
  });

  const filteredGames = useMemo(() => {
    const q = stripVi(searchText);
    if (!q) return GAME_CATALOG;
    return GAME_CATALOG.filter((game) =>
      stripVi(`${game.title} ${game.major} ${game.description} ${game.keywords}`).includes(q)
    );
  }, [searchText]);

  const filteredSuggestions = useMemo(() => {
    const q = stripVi(searchText);
    return suggestions.filter((item) => {
      if (filterDate && toLocalDateKey(item.created_at) !== filterDate) return false;
      if (!q) return true;
      return stripVi(
        `${item.major_name} ${item.game_title} ${item.description} ${item.created_by_name}`
      ).includes(q);
    });
  }, [suggestions, searchText, filterDate]);

  // Tương thích ngược nếu sinh viên quét mã QR cũ dạng /games?room=CODE
  if (requestedRoomCode) {
    return (
      <Navigate
        to={`/games/hsk-tower?room=${encodeURIComponent(requestedRoomCode)}`}
        replace
      />
    );
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
      setActiveTab('suggestions');
      setSearchParams({ tab: 'suggestions' }, { replace: true });
      await loadData(true);
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
    await loadData(true);
  }

  function handleSwitchTab(nextTab: 'games' | 'suggestions') {
    setActiveTab(nextTab);
    if (nextTab === 'suggestions') {
      setSearchParams({ tab: 'suggestions' }, { replace: true });
    } else {
      setSearchParams({}, { replace: true });
    }
  }

  return (
    <Layout>
      <div className="flex flex-col gap-6">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold text-brand-navy">
                Trò chơi học tập — Tất cả các ngành
              </h1>
              <Badge tone="navy">{GAME_CATALOG.length} trò chơi</Badge>
            </div>
            <p className="mt-1 text-sm font-normal text-ink-secondary">
              Chọn trò chơi theo ngành học để vào sảnh phòng thi đấu, hoặc gửi đề xuất trò chơi mới cho ngành của bạn tới Hiệu trưởng.
            </p>
          </div>

          <Button variant="primary" onClick={() => setSuggestOpen(true)}>
            <Lightbulb className="h-4 w-4" aria-hidden="true" />
            <span>Đề xuất trò chơi cho ngành</span>
          </Button>
        </div>

        {/* Chuyển tab Danh sách trò chơi / Đề xuất trò chơi các ngành */}
        <div className="flex flex-wrap gap-2 border-b border-line pb-2" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'games'}
            onClick={() => handleSwitchTab('games')}
            className={`inline-flex h-10 items-center gap-2 rounded-lg px-4 text-sm font-semibold transition-colors ${
              activeTab === 'games'
                ? 'bg-brand-navy text-white'
                : 'bg-surface-card text-ink-secondary hover:bg-surface-subtle hover:text-ink-primary'
            }`}
          >
            <Gamepad2 className="h-4 w-4" aria-hidden="true" />
            <span>Danh sách trò chơi ({filteredGames.length})</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'suggestions'}
            onClick={() => handleSwitchTab('suggestions')}
            className={`inline-flex h-10 items-center gap-2 rounded-lg px-4 text-sm font-semibold transition-colors ${
              activeTab === 'suggestions'
                ? 'bg-brand-navy text-white'
                : 'bg-surface-card text-ink-secondary hover:bg-surface-subtle hover:text-ink-primary'
            }`}
          >
            <Lightbulb className="h-4 w-4" aria-hidden="true" />
            <span>
              Đề xuất trò chơi các ngành ({filteredSuggestions.length}
              {filteredSuggestions.length !== suggestions.length ? `/${suggestions.length}` : ''})
            </span>
          </button>
        </div>

        {/* Thanh tìm kiếm chung */}
        <section className="grid grid-cols-1 gap-3 rounded-2xl border border-line bg-surface-card p-4 md:grid-cols-12">
          <div className={`relative ${activeTab === 'suggestions' ? 'md:col-span-7' : 'md:col-span-10'}`}>
            <Search
              className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted"
              aria-hidden="true"
            />
            <input
              type="search"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              placeholder={
                activeTab === 'games'
                  ? 'Tìm trò chơi theo tên trò chơi hoặc tên ngành học (VD: Tiếng Trung, HSK)...'
                  : 'Tìm đề xuất theo tên ngành học, tên trò chơi hoặc người đề xuất...'
              }
              aria-label="Tìm kiếm trò chơi hoặc ngành học"
              className="h-10 w-full rounded-lg border border-line-strong bg-surface-page pl-10 pr-4 text-sm font-normal text-ink-primary placeholder:text-ink-muted focus:border-brand-navy focus:outline-none focus:ring-2 focus:ring-brand-navy/20"
            />
          </div>

          {activeTab === 'suggestions' && (
            <div className="md:col-span-3">
              <input
                type="date"
                value={filterDate}
                onChange={(e) => setFilterDate(e.target.value)}
                aria-label="Lọc đề xuất theo ngày gửi"
                className="h-10 w-full rounded-lg border border-line-strong bg-surface-page px-3 text-sm font-normal text-ink-primary focus:border-brand-navy focus:outline-none focus:ring-2 focus:ring-brand-navy/20"
              />
            </div>
          )}

          <div className="flex items-center md:col-span-2">
            <Button
              type="button"
              variant="secondary"
              className="w-full"
              disabled={!searchText && !filterDate}
              onClick={() => {
                setSearchText('');
                setFilterDate('');
              }}
            >
              Xóa lọc
            </Button>
          </div>
        </section>

        {activeTab === 'games' ? (
          filteredGames.length === 0 ? (
            <EmptyState
              icon={Gamepad2}
              title="Chưa có trò chơi phù hợp"
              description="Chưa tìm thấy trò chơi cho từ khóa này. Bạn có thể gửi đề xuất trò chơi mới cho ngành của mình tới Hiệu trưởng!"
              action={
                <Button variant="primary" onClick={() => setSuggestOpen(true)}>
                  <Lightbulb className="h-4 w-4" aria-hidden="true" />
                  <span>Đề xuất trò chơi ngay</span>
                </Button>
              }
            />
          ) : (
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
              {filteredGames.map((game) => {
                const Icon = game.icon;
                return (
                  <Link
                    key={game.id}
                    to={game.to}
                    className="group flex flex-col justify-between gap-4 rounded-2xl border border-line bg-surface-card p-6 transition-all hover:border-brand-navy hover:shadow-md focus:outline-none focus:ring-2 focus:ring-brand-navy/30"
                  >
                    <div className="flex flex-col gap-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-redSoft text-brand-red">
                          <Icon className="h-6 w-6" aria-hidden="true" />
                        </div>
                        <div className="flex flex-wrap items-center gap-1.5">
                          <Badge tone="navy">{game.major}</Badge>
                          {game.badge && <Badge tone="success">{game.badge}</Badge>}
                        </div>
                      </div>

                      <div>
                        <h2 className="text-lg font-bold text-ink-primary transition-colors group-hover:text-brand-navy">
                          {game.title}
                        </h2>
                        <p className="mt-1 text-sm font-normal leading-relaxed text-ink-secondary">
                          {game.description}
                        </p>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 text-xs text-ink-muted">
                        <span className="inline-flex items-center gap-1 font-semibold text-brand-navy">
                          <Users className="h-3.5 w-3.5" aria-hidden="true" />
                          {game.maxPlayersLabel}
                        </span>
                        {game.id === 'hsk-tower' && (
                          <>
                            <span>•</span>
                            <span>
                              {hskRoomStats.open > 0
                                ? `${hskRoomStats.open} phòng đang mở`
                                : `${hskRoomStats.total} phòng đã tạo`}
                            </span>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center justify-between border-t border-line pt-4 text-sm font-semibold text-brand-navy">
                      <span>Vào sảnh trò chơi</span>
                      <ArrowRight
                        className="h-4 w-4 transition-transform group-hover:translate-x-1"
                        aria-hidden="true"
                      />
                    </div>
                  </Link>
                );
              })}

              {/* Thẻ kêu gọi đề xuất trò chơi cho các ngành khác */}
              <button
                type="button"
                onClick={() => setSuggestOpen(true)}
                className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-line-strong bg-surface-page p-6 text-center transition-colors hover:border-brand-red hover:bg-brand-redSoft/20"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-surface-card text-brand-red shadow-sm">
                  <Lightbulb className="h-6 w-6" aria-hidden="true" />
                </div>
                <div>
                  <p className="text-base font-bold text-ink-primary">
                    Ngành của bạn chưa có trò chơi?
                  </p>
                  <p className="mt-1 text-xs font-normal text-ink-secondary">
                    Nhấn vào đây để gửi đề xuất ý tưởng trò chơi trực tiếp tới Hiệu trưởng!
                  </p>
                </div>
              </button>
            </div>
          )
        ) : loading ? (
          <LoadingState message="Đang tải danh sách đề xuất trò chơi..." />
        ) : filteredSuggestions.length === 0 ? (
          <EmptyState
            icon={Lightbulb}
            title="Chưa có đề xuất trò chơi phù hợp"
            description={
              suggestions.length === 0
                ? 'Hãy là người đầu tiên đề xuất ý tưởng trò chơi học tập cho ngành của bạn gửi tới Hiệu trưởng!'
                : 'Không tìm thấy đề xuất khớp với từ khóa hoặc ngày đã chọn.'
            }
            action={
              suggestions.length === 0 ? (
                <Button variant="primary" onClick={() => setSuggestOpen(true)}>
                  Gửi đề xuất ngay
                </Button>
              ) : undefined
            }
          />
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {filteredSuggestions.map((item) => {
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
                    <h3 className="text-base font-bold text-ink-primary">{item.game_title}</h3>
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
    </Layout>
  );
}
