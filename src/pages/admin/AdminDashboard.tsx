import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { BookOpen, Calendar, Megaphone, UserCheck, Users } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Layout } from '@/components/Layout';
import { LoadingState } from '@/components/ui/Spinner';

interface DashboardStats {
  students: number;
  teachers: number;
  timetableClasses: number;
  announcements: number;
  classes: number;
}

export function AdminDashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      try {
        const [stuRes, teaRes, ttRes, annRes, clsRes] = await Promise.all([
          supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'student'),
          supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'teacher'),
          supabase.rpc('timetable_classes'),
          supabase.from('announcements').select('id', { count: 'exact', head: true }).is('class_id', null),
          supabase.from('classes').select('id', { count: 'exact', head: true }),
        ]);

        if (!active) return;
        setStats({
          students: stuRes.count ?? 0,
          teachers: teaRes.count ?? 0,
          timetableClasses: Array.isArray(ttRes.data) ? ttRes.data.length : 0,
          announcements: annRes.count ?? 0,
          classes: clsRes.count ?? 0,
        });
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, []);

  const cards = [
    {
      label: 'Sinh viên',
      value: stats?.students ?? 0,
      to: '/admin/students',
      icon: Users,
    },
    {
      label: 'Giáo viên',
      value: stats?.teachers ?? 0,
      to: '/admin/teachers',
      icon: UserCheck,
    },
    {
      label: 'Lớp có TKB',
      value: stats?.timetableClasses ?? 0,
      to: '/timetable',
      icon: Calendar,
    },
    {
      label: 'Thông báo trường',
      value: stats?.announcements ?? 0,
      to: '/admin/announcements',
      icon: Megaphone,
    },
    {
      label: 'Lớp học',
      value: stats?.classes ?? 0,
      to: '/admin/classes',
      icon: BookOpen,
    },
  ];

  return (
    <Layout>
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-2xl font-bold text-brand-navy">Tổng quan quản trị</h1>
          <p className="text-sm font-normal text-ink-secondary">
            Thống kê nhanh tài khoản và dữ liệu toàn trường
          </p>
        </div>

        {loading ? (
          <LoadingState message="Đang tải thống kê..." />
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {cards.map((card) => {
              const Icon = card.icon;
              return (
                <Link
                  key={card.to}
                  to={card.to}
                  className="flex items-center justify-between rounded-xl border border-line bg-surface-card p-6 transition-colors hover:border-brand-navy"
                >
                  <div className="flex flex-col gap-2">
                    <span className="text-sm font-semibold text-ink-secondary">{card.label}</span>
                    <span className="text-3xl font-bold text-brand-navy">{card.value}</span>
                  </div>
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-navySoft text-brand-navy">
                    <Icon className="h-6 w-6" aria-hidden="true" />
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </Layout>
  );
}

