import { useEffect, useState } from 'react';
import { Copy, Download, Shuffle, Users } from 'lucide-react';
import {
  exportTeamsToExcel,
  formatTeamsAsText,
  splitIntoTeams,
  type KitStudent,
  type KitTeam,
} from '@/lib/classroomKit';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { Input } from '@/components/ui/Input';
import { useToast } from '@/components/ui/Toast';

interface TeamBuilderTabProps {
  students: KitStudent[];
  sourceLabel: string;
  sourceSignature: string;
}

const PRESET_NUMBERS = [2, 3, 4, 5, 6];

export function TeamBuilderTab({
  students,
  sourceLabel,
  sourceSignature,
}: TeamBuilderTabProps) {
  const toast = useToast();
  const [mode, setMode] = useState<'by_count' | 'by_size'>('by_count');
  const [valueInput, setValueInput] = useState('4');
  const [teams, setTeams] = useState<KitTeam[]>([]);

  useEffect(() => {
    setTeams([]);
  }, [sourceSignature]);

  function handleGenerate() {
    if (students.length === 0) {
      toast.error('Danh sách sinh viên đang trống');
      return;
    }
    const parsed = Number.parseInt(valueInput, 10);
    if (!Number.isFinite(parsed) || parsed < 1) {
      toast.error(mode === 'by_count' ? 'Số nhóm phải từ 1 trở lên' : 'Sĩ số mỗi nhóm phải từ 1 trở lên');
      return;
    }
    const nextTeams = splitIntoTeams(students, mode, parsed);
    setTeams(nextTeams);
  }

  async function handleCopy() {
    if (teams.length === 0) return;
    try {
      await navigator.clipboard.writeText(formatTeamsAsText(teams));
      toast.success('Đã sao chép danh sách các nhóm');
    } catch {
      toast.error('Trình duyệt chưa cấp quyền sao chép, vui lòng dùng Xuất Excel');
    }
  }

  function handleExport() {
    if (teams.length === 0) return;
    exportTeamsToExcel(teams, sourceLabel || 'lop-hoc');
    toast.success('Đã tải xuống file Excel danh sách chia nhóm');
  }

  if (students.length === 0) {
    return (
      <EmptyState
        icon={Users}
        title="Chưa có sinh viên để chia nhóm"
        description="Chọn lớp học hoặc nhập danh sách sinh viên ở phía trên để bắt đầu chia nhóm ngẫu nhiên."
      />
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-4 rounded-xl border border-line bg-surface-card p-6">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <h2 className="text-lg font-bold text-brand-navy">Chia nhóm ngẫu nhiên</h2>
            <p className="text-sm font-normal text-ink-secondary">
              Xáo trộn đều {students.length} sinh viên theo số nhóm hoặc sĩ số tối đa mỗi nhóm
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              variant={mode === 'by_count' ? 'navy' : 'secondary'}
              onClick={() => setMode('by_count')}
            >
              Theo số nhóm
            </Button>
            <Button
              size="sm"
              variant={mode === 'by_size' ? 'navy' : 'secondary'}
              onClick={() => setMode('by_size')}
            >
              Theo số SV / nhóm
            </Button>
          </div>
        </div>

        <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
          <div className="w-full sm:w-48">
            <Input
              label={mode === 'by_count' ? 'Số nhóm muốn chia' : 'Số sinh viên mỗi nhóm'}
              type="number"
              min={1}
              max={Math.max(1, students.length)}
              value={valueInput}
              onChange={(e) => setValueInput(e.target.value)}
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {PRESET_NUMBERS.map((num) => (
              <Button
                key={num}
                size="sm"
                variant={valueInput === String(num) ? 'navy' : 'secondary'}
                onClick={() => setValueInput(String(num))}
              >
                {num} {mode === 'by_count' ? 'nhóm' : 'SV'}
              </Button>
            ))}
          </div>

          <div className="sm:ml-auto">
            <Button variant="primary" onClick={handleGenerate}>
              <Shuffle className="h-4 w-4" aria-hidden="true" />
              <span>{teams.length > 0 ? 'Xáo trộn chia lại' : 'Chia nhóm ngay'}</span>
            </Button>
          </div>
        </div>
      </section>

      {teams.length === 0 ? (
        <EmptyState
          icon={Shuffle}
          title="Chưa thực hiện chia nhóm"
          description="Chọn số nhóm hoặc sĩ số mong muốn rồi nhấn &quot;Chia nhóm ngay&quot;."
        />
      ) : (
        <section className="flex flex-col gap-4">
          <div className="flex flex-col justify-between gap-4 rounded-xl border border-line bg-surface-card p-4 sm:flex-row sm:items-center">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="navy">{teams.length} nhóm</Badge>
              <Badge tone="red">{students.length} sinh viên</Badge>
              <span className="text-sm font-normal text-ink-secondary">
                ({sourceLabel || 'Danh sách tùy chỉnh'})
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button size="sm" variant="secondary" onClick={() => void handleCopy()}>
                <Copy className="h-4 w-4 text-brand-navy" aria-hidden="true" />
                <span>Sao chép</span>
              </Button>
              <Button size="sm" variant="navy" onClick={handleExport}>
                <Download className="h-4 w-4" aria-hidden="true" />
                <span>Xuất Excel</span>
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {teams.map((team) => {
              const isAccentRed = team.index % 2 === 0;
              return (
                <article
                  key={team.index}
                  className="flex flex-col gap-4 rounded-xl border border-line bg-surface-card p-4"
                >
                  <div className="flex items-center justify-between gap-2 border-b border-line pb-2">
                    <h3 className="text-base font-bold text-brand-navy">{team.name}</h3>
                    <Badge tone={isAccentRed ? 'red' : 'navy'}>
                      {team.members.length} thành viên
                    </Badge>
                  </div>

                  <ol className="flex flex-col gap-2">
                    {team.members.map((member, idx) => (
                      <li
                        key={member.id}
                        className="flex items-center justify-between gap-2 rounded-lg bg-surface-page p-2"
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-ink-muted">{idx + 1}.</span>
                          <span className="text-sm font-semibold text-ink-primary">
                            {member.name}
                          </span>
                        </div>
                        {member.code && (
                          <span className="text-xs font-normal text-ink-muted">{member.code}</span>
                        )}
                      </li>
                    ))}
                  </ol>
                </article>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}

