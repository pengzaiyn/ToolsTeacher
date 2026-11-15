import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ListChecks,
  Search,
  Shuffle,
  Wrench,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { TOOLS } from '@/lib/toolsCatalog';
import { Layout } from '@/components/Layout';
import { ToolCard } from '@/components/ToolCard';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';

const UPCOMING_TOOLS = [
  {
    id: 'quiz-builder',
    title: 'Nhập nhanh & Trộn đề trắc nghiệm',
    description: 'Nhập câu hỏi từ Excel/văn bản, trộn nhiều mã đề và giao trực tiếp cho lớp học.',
    icon: ListChecks,
    phase: 'Đợt 3',
  },
];

export function TeacherTools() {
  const { profile } = useAuth();
  const [search, setSearch] = useState('');

  const teachingTools = useMemo(() => {
    const q = search.trim().toLowerCase();
    return TOOLS.filter((tool) => {
      if (tool.category !== 'teaching') return false;
      if (profile && !tool.roles.includes(profile.role)) return false;
      if (!q) return true;
      return (
        tool.title.toLowerCase().includes(q) ||
        tool.description.toLowerCase().includes(q)
      );
    });
  }, [profile, search]);

  return (
    <Layout>
      <div className="flex flex-col gap-8">
        <section className="rounded-2xl border border-line bg-surface-card p-6 sm:p-8">
          <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
            <div className="flex flex-col gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <Wrench className="h-5 w-5 text-brand-red" aria-hidden="true" />
                <h1 className="text-2xl font-bold text-brand-navy">Công cụ giảng dạy</h1>
                <Badge tone="navy">{teachingTools.length} công cụ</Badge>
              </div>
              <p className="text-sm font-normal text-ink-secondary">
                Kho tiện ích đứng lớp và quản lý giảng dạy dành cho giáo viên
                {profile?.subject ? ` — Chủ nhiệm môn: ${profile.subject}` : ''}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-4">
              <div className="relative w-full sm:w-64">
                <Search
                  className="pointer-events-none absolute left-4 top-3 h-4 w-4 text-ink-muted"
                  aria-hidden="true"
                />
                <input
                  type="search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Tìm nhanh công cụ..."
                  aria-label="Tìm nhanh công cụ giảng dạy"
                  className="h-10 w-full rounded-lg border border-line-strong bg-surface-card pl-10 pr-4 text-sm font-normal text-ink-primary placeholder:text-ink-muted focus:border-brand-navy focus:outline-none focus:ring-2 focus:ring-brand-navy/20"
                />
              </div>

              <Link to="/teacher/classroom-kit">
                <Button variant="primary">
                  <Shuffle className="h-4 w-4" aria-hidden="true" />
                  <span>Mở bộ điều phối lớp</span>
                </Button>
              </Link>
            </div>
          </div>
        </section>

        <section className="flex flex-col gap-4">
          <h2 className="text-lg font-bold text-ink-primary">Công cụ đang hoạt động</h2>
          {teachingTools.length === 0 ? (
            <EmptyState
              icon={Wrench}
              title="Không tìm thấy công cụ phù hợp"
              description="Thử xóa từ khóa tìm kiếm để xem toàn bộ công cụ giảng dạy."
              action={
                search ? (
                  <Button variant="secondary" onClick={() => setSearch('')}>
                    Xóa bộ lọc
                  </Button>
                ) : undefined
              }
            />
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {teachingTools.map((tool) => (
                <ToolCard key={tool.id} tool={tool} />
              ))}
            </div>
          )}
        </section>

        <section className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-bold text-ink-primary">Lộ trình mở rộng</h2>
            <span className="text-xs font-normal text-ink-muted">
              Các công cụ tiếp theo sẽ tự động cập nhật tại đây
            </span>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {UPCOMING_TOOLS.map((item) => {
              const Icon = item.icon;
              return (
                <article
                  key={item.id}
                  className="flex flex-col justify-between gap-4 rounded-xl border border-dashed border-line-strong bg-surface-page p-6"
                >
                  <div className="flex flex-col gap-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-surface-card text-ink-muted">
                        <Icon className="h-6 w-6" aria-hidden="true" />
                      </div>
                      <Badge tone="neutral">{item.phase} • Sắp ra mắt</Badge>
                    </div>
                    <div className="flex flex-col gap-2">
                      <h3 className="text-base font-bold text-ink-primary">{item.title}</h3>
                      <p className="text-sm font-normal leading-relaxed text-ink-secondary">
                        {item.description}
                      </p>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      </div>
    </Layout>
  );
}

