import { Crown, Flame, Medal, Sparkles, Trophy } from 'lucide-react';
import { HskCharacterAvatar } from '@/components/hsk/HskCharacters';
import {
  HSK_THEME_INFO,
  type HskAvatarId,
  type HskTowerTheme,
} from '@/lib/hsk1Vocabulary';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';

export interface HskRoomPlayerRow {
  id: string;
  room_id: string;
  user_id: string;
  display_name: string;
  avatar_id: HskAvatarId | string;
  vote_mode: 'pinyin' | 'hanzi' | null;
  step: number;
  score: number;
  combo: number;
  wrong_count: number;
  reward_points: number;
  finished_at: string | null;
  joined_at: string;
}

interface HskTowerArenaProps {
  theme: HskTowerTheme;
  targetSteps: number;
  players: HskRoomPlayerRow[];
  currentUserId?: string | null;
}

const THEME_STYLES: Record<
  HskTowerTheme,
  {
    stageBg: string;
    pillarBg: string;
    rungActive: string;
    rungIdle: string;
    topLabel: string;
  }
> = {
  lantern: {
    stageBg: 'bg-brand-redSoft/45 border-brand-red/25',
    pillarBg: 'bg-brand-red/15 border-brand-red/30',
    rungActive: 'bg-brand-red text-white',
    rungIdle: 'bg-surface-card/85 text-ink-muted',
    topLabel: 'Đỉnh Tháp Đèn Lồng',
  },
  bamboo: {
    stageBg: 'bg-status-successBg/60 border-status-successBorder',
    pillarBg: 'bg-status-successText/15 border-status-successBorder',
    rungActive: 'bg-status-successText text-white',
    rungIdle: 'bg-surface-card/85 text-ink-muted',
    topLabel: 'Ngọn Tre Trúc',
  },
  great_wall: {
    stageBg: 'bg-brand-navySoft/50 border-brand-navy/25',
    pillarBg: 'bg-brand-navy/15 border-brand-navy/30',
    rungActive: 'bg-brand-navy text-white',
    rungIdle: 'bg-surface-card/85 text-ink-muted',
    topLabel: 'Đài Phong Hỏa',
  },
};

export function sortRankedPlayers(players: HskRoomPlayerRow[]): HskRoomPlayerRow[] {
  return [...players].sort((a, b) => {
    if (b.step !== a.step) return b.step - a.step;
    if (b.score !== a.score) return b.score - a.score;
    if (a.finished_at && b.finished_at) {
      return Date.parse(a.finished_at) - Date.parse(b.finished_at);
    }
    if (a.finished_at) return -1;
    if (b.finished_at) return 1;
    return Date.parse(a.joined_at) - Date.parse(b.joined_at);
  });
}

export function HskTowerArena({
  theme,
  targetSteps,
  players,
  currentUserId,
}: HskTowerArenaProps) {
  const style = THEME_STYLES[theme] ?? THEME_STYLES.lantern;
  const slots = Array.from({ length: 5 }, (_, idx) => players[idx] ?? null);
  const displayRungs = Math.min(targetSteps, 12);

  return (
    <div className={`rounded-2xl border p-4 sm:p-6 ${style.stageBg}`}>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Trophy className="h-5 w-5 text-brand-red" aria-hidden="true" />
          <h3 className="text-base font-bold text-ink-primary">
            Sân khấu {HSK_THEME_INFO[theme].label}
          </h3>
        </div>
        <Badge tone="navy">
          Đích: {targetSteps} nấc · {style.topLabel}
        </Badge>
      </div>

      <div className="grid grid-cols-5 gap-2 sm:gap-4">
        {slots.map((player, slotIdx) => {
          const progress = player
            ? Math.min(100, Math.round((player.step / Math.max(1, targetSteps)) * 100))
            : 0;
          const isMe = Boolean(player && currentUserId && player.user_id === currentUserId);
          const bottomPct = Math.min(82, Math.max(4, progress * 0.78 + 4));

          return (
            <div
              key={player?.id ?? `empty-${slotIdx}`}
              className="flex flex-col items-center gap-2"
            >
              {/* Đỉnh tháp */}
              <div className="flex h-8 w-full items-center justify-center rounded-lg border border-line bg-surface-card px-1 text-center text-[11px] font-bold text-brand-red">
                <Crown className="mr-1 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                <span className="truncate">{targetSteps}</span>
              </div>

              {/* Cột leo thẳng đứng */}
              <div
                className={`relative h-72 w-full overflow-hidden rounded-xl border sm:h-80 ${style.pillarBg}`}
              >
                {/* Các nấc thang / đốt tre */}
                <div className="flex h-full flex-col-reverse justify-between p-1.5">
                  {Array.from({ length: displayRungs }, (_, rIdx) => {
                    const rungRatio = (rIdx + 1) / displayRungs;
                    const reached = player ? player.step / Math.max(1, targetSteps) >= rungRatio : false;
                    return (
                      <div
                        key={rIdx}
                        className={`h-2.5 w-full rounded-full transition-colors duration-300 ${
                          reached ? style.rungActive : style.rungIdle
                        }`}
                      />
                    );
                  })}
                </div>

                {/* Nhân vật leo trên cột */}
                {player ? (
                  <div
                    className="pointer-events-none absolute left-1/2 flex -translate-x-1/2 flex-col items-center transition-all duration-500 ease-out"
                    style={{ bottom: `${bottomPct}%` }}
                  >
                    {player.combo >= 2 && (
                      <span className="mb-0.5 inline-flex items-center gap-0.5 rounded-full bg-brand-red px-1.5 py-0.5 text-[10px] font-bold text-white shadow">
                        <Flame className="h-2.5 w-2.5" aria-hidden="true" />x{player.combo}
                      </span>
                    )}
                    <div
                      className={`rounded-full p-0.5 shadow-md ${
                        isMe ? 'bg-brand-red ring-2 ring-white' : 'bg-surface-card'
                      }`}
                    >
                      <HskCharacterAvatar
                        avatarId={player.avatar_id}
                        size={44}
                        mood={player.step >= targetSteps ? 'winner' : player.combo >= 2 ? 'happy' : 'idle'}
                      />
                    </div>
                  </div>
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center p-2 text-center text-[11px] font-normal text-ink-muted">
                    Trống
                  </div>
                )}
              </div>

              {/* Thẻ tên & điểm dưới chân cột */}
              <div
                className={`flex w-full flex-col items-center rounded-xl border px-2 py-2 text-center ${
                  isMe
                    ? 'border-brand-red bg-brand-redSoft/40'
                    : 'border-line bg-surface-card'
                }`}
              >
                <span className="w-full truncate text-xs font-bold text-ink-primary">
                  {player ? player.display_name : `Suất #${slotIdx + 1}`}
                </span>
                <span className="mt-0.5 text-[11px] font-semibold text-brand-navy">
                  {player ? `Nấc ${player.step}/${targetSteps} · ${player.score}đ` : 'Chờ vào'}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

interface HskPodiumStageProps {
  players: HskRoomPlayerRow[];
  canAwardPoints: boolean;
  rewardDrafts: Record<string, string>;
  onChangeReward: (playerId: string, value: string) => void;
  onSaveRewards: () => void;
  savingRewards: boolean;
}

export function HskPodiumStage({
  players,
  canAwardPoints,
  rewardDrafts,
  onChangeReward,
  onSaveRewards,
  savingRewards,
}: HskPodiumStageProps) {
  const ranked = sortRankedPlayers(players);
  const top1 = ranked[0] ?? null;
  const top2 = ranked[1] ?? null;
  const top3 = ranked[2] ?? null;
  const clappers = ranked.slice(3, 5);

  const podiumOrder = [
    { rank: 2, player: top2, height: 'h-28', badgeTone: 'navy' as const, label: 'Hạng 2' },
    { rank: 1, player: top1, height: 'h-36', badgeTone: 'red' as const, label: 'Quán quân' },
    { rank: 3, player: top3, height: 'h-24', badgeTone: 'warning' as const, label: 'Hạng 3' },
  ];

  return (
    <div className="flex flex-col gap-6 rounded-2xl border border-brand-red/30 bg-surface-card p-6">
      <div className="flex flex-col items-center gap-2 text-center">
        <div className="inline-flex items-center gap-2 rounded-full bg-brand-redSoft px-4 py-1.5 text-xs font-bold text-brand-red">
          <Sparkles className="h-4 w-4" aria-hidden="true" />
          <span>VINH DANH TOP 3 XUẤT SẮC NHẤT</span>
        </div>
        <h2 className="text-xl font-bold text-brand-navy">Bục Chiến Thắng Leo Tháp HSK</h2>
      </div>

      {/* Bục vinh quang Top 2 - Top 1 - Top 3 */}
      <div className="grid grid-cols-3 items-end gap-3 pt-4 sm:gap-6">
        {podiumOrder.map((slot) => (
          <div key={slot.rank} className="flex flex-col items-center gap-2">
            {slot.player ? (
              <>
                <div className="flex flex-col items-center">
                  <HskCharacterAvatar
                    avatarId={slot.player.avatar_id}
                    size={slot.rank === 1 ? 76 : 64}
                    mood={slot.rank === 1 ? 'winner' : 'happy'}
                  />
                  <span className="mt-1 max-w-full truncate text-center text-sm font-bold text-ink-primary">
                    {slot.player.display_name}
                  </span>
                  <span className="text-xs font-semibold text-brand-navy">
                    {slot.player.score} điểm · {slot.player.step} nấc
                  </span>
                  {Number(slot.player.reward_points) > 0 && (
                    <Badge tone="success" className="mt-1">
                      +{slot.player.reward_points} điểm thưởng
                    </Badge>
                  )}
                </div>

                <div
                  className={`flex w-full flex-col items-center justify-center rounded-t-2xl border border-b-0 p-3 text-center ${
                    slot.rank === 1
                      ? 'border-brand-red bg-brand-red text-white'
                      : slot.rank === 2
                        ? 'border-brand-navy bg-brand-navy text-white'
                        : 'border-status-warningBorder bg-status-warningBg text-status-warningText'
                  } ${slot.height}`}
                >
                  {slot.rank === 1 ? (
                    <Crown className="h-6 w-6" aria-hidden="true" />
                  ) : (
                    <Medal className="h-5 w-5" aria-hidden="true" />
                  )}
                  <span className="mt-1 text-lg font-bold">TOP {slot.rank}</span>
                  <span className="text-[11px] font-semibold opacity-90">{slot.label}</span>
                </div>
              </>
            ) : (
              <div
                className={`flex w-full items-center justify-center rounded-t-2xl border border-dashed border-line bg-surface-page text-xs text-ink-muted ${slot.height}`}
              >
                Top {slot.rank}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Hàng 2 thí sinh đứng dưới vỗ tay cổ vũ */}
      {clappers.length > 0 && (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-line bg-surface-page p-4">
          <span className="text-xs font-semibold text-ink-secondary">
            Cổ vũ nhiệt tình cho Top 3 xuất sắc!
          </span>
          <div className="flex flex-wrap items-center justify-center gap-6">
            {clappers.map((player, idx) => (
              <div key={player.id} className="flex items-center gap-3">
                <div className="animate-bounce">
                  <HskCharacterAvatar avatarId={player.avatar_id} size={52} mood="clapping" />
                </div>
                <div className="flex flex-col">
                  <span className="rounded-lg bg-surface-card px-2.5 py-1 text-xs font-semibold text-brand-navy shadow-sm">
                    {idx === 0 ? 'Vỗ tay! Đỉnh quá các bạn!' : 'Chúc mừng Top 3 nhé!'}
                  </span>
                  <span className="mt-1 text-xs font-bold text-ink-primary">
                    Hạng {idx + 4}: {player.display_name} ({player.score}đ)
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Bảng giáo viên cộng điểm thưởng tùy chọn */}
      {canAwardPoints && ranked.length > 0 && (
        <div className="flex flex-col gap-3 border-t border-line pt-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-bold text-ink-primary">
                Ghi nhận điểm thưởng cho thí sinh (tùy giáo viên)
              </h3>
              <p className="text-xs font-normal text-ink-secondary">
                Nhập mức điểm cộng (VD: Top 1: +1, Top 2: +0.5, Top 3: +0.25) rồi bấm Lưu.
              </p>
            </div>
            <Button variant="primary" size="sm" onClick={onSaveRewards} loading={savingRewards}>
              Lưu điểm thưởng
            </Button>
          </div>

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {ranked.map((player, idx) => (
              <div
                key={player.id}
                className="flex items-center justify-between gap-2 rounded-xl border border-line bg-surface-page px-3 py-2"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-bold text-ink-primary">
                    #{idx + 1} {player.display_name}
                  </p>
                  <p className="text-[11px] text-ink-muted">{player.score} điểm</p>
                </div>
                <input
                  type="number"
                  step="0.25"
                  min="0"
                  max="10"
                  value={rewardDrafts[player.id] ?? String(player.reward_points ?? 0)}
                  onChange={(e) => onChangeReward(player.id, e.target.value)}
                  aria-label={`Điểm thưởng cho ${player.display_name}`}
                  className="h-8 w-20 rounded-lg border border-line-strong bg-surface-card px-2 text-right text-xs font-bold text-brand-navy focus:border-brand-navy focus:outline-none"
                />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
