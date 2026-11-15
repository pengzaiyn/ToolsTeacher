import { useEffect, useState, type FormEvent } from 'react';
import { KeyRound, Save, User } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { ROLE_LABELS } from '@/lib/roles';
import { supabase } from '@/lib/supabase';
import { formatDateVi } from '@/lib/week';
import { Layout } from '@/components/Layout';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useToast } from '@/components/ui/Toast';

export function Profile() {
  const { profile, refreshProfile } = useAuth();
  const toast = useToast();

  const [fullName, setFullName] = useState(profile?.full_name ?? '');
  const [savingName, setSavingName] = useState(false);

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);

  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name);
    }
  }, [profile]);

  if (!profile) return null;

  async function handleUpdateName(event: FormEvent) {
    event.preventDefault();
    const trimmed = fullName.trim();
    if (!trimmed) {
      toast.error('Họ và tên không được để trống');
      return;
    }

    setSavingName(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ full_name: trimmed })
        .eq('id', profile!.id);

      if (error) {
        throw new Error(error.message);
      }
      await refreshProfile();
      toast.success('Đã cập nhật họ tên');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Không cập nhật được thông tin');
    } finally {
      setSavingName(false);
    }
  }

  async function handleChangePassword(event: FormEvent) {
    event.preventDefault();
    if (newPassword.length < 8) {
      toast.error('Mật khẩu mới cần ít nhất 8 ký tự');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error('Mật khẩu nhập lại không khớp');
      return;
    }

    setSavingPassword(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) {
        throw new Error(error.message);
      }
      setNewPassword('');
      setConfirmPassword('');
      toast.success('Đã đổi mật khẩu thành công');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Không đổi được mật khẩu');
    } finally {
      setSavingPassword(false);
    }
  }

  const infoItems = [
    { label: 'Email', value: profile.email },
    { label: 'Vai trò', value: ROLE_LABELS[profile.role] },
    ...(profile.student_code ? [{ label: 'Mã sinh viên', value: profile.student_code }] : []),
    ...(profile.class_name ? [{ label: 'Lớp học', value: profile.class_name }] : []),
    ...(profile.gender ? [{ label: 'Giới tính', value: profile.gender }] : []),
    ...(profile.date_of_birth
      ? [{ label: 'Ngày sinh', value: formatDateVi(profile.date_of_birth) }]
      : []),
    ...(profile.admissions_advisor
      ? [{ label: 'Tư vấn tuyển sinh', value: profile.admissions_advisor }]
      : []),
    ...(profile.subject ? [{ label: 'Chủ nhiệm môn', value: profile.subject }] : []),
  ];

  return (
    <Layout>
      <div className="mx-auto flex max-w-4xl flex-col gap-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-navySoft text-brand-navy">
              <User className="h-6 w-6" aria-hidden="true" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-brand-navy">Hồ sơ cá nhân</h1>
              <p className="text-sm font-normal text-ink-secondary">
                Thông tin tài khoản và bảo mật đăng nhập
              </p>
            </div>
          </div>
          <Badge tone={profile.is_active ? 'success' : 'danger'}>
            {profile.is_active ? 'Đang hoạt động' : 'Đã khóa'}
          </Badge>
        </div>

        <section className="rounded-xl border border-line bg-surface-card p-6">
          <h2 className="mb-4 text-base font-bold text-ink-primary">Thông tin chung</h2>
          <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {infoItems.map((item) => (
              <div key={item.label} className="rounded-lg bg-surface-page p-4">
                <dt className="text-xs font-normal text-ink-muted">{item.label}</dt>
                <dd className="mt-2 text-sm font-semibold text-ink-primary">{item.value}</dd>
              </div>
            ))}
          </dl>
        </section>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <section className="rounded-xl border border-line bg-surface-card p-6">
            <h2 className="mb-4 text-base font-bold text-ink-primary">Cập nhật họ tên</h2>
            <form onSubmit={handleUpdateName} className="flex flex-col gap-4">
              <Input
                label="Họ và tên"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
                hint="Các thông tin như email, mã sinh viên, lớp do nhà trường quản lý."
              />
              <div>
                <Button type="submit" variant="navy" loading={savingName}>
                  <Save className="h-4 w-4" aria-hidden="true" />
                  <span>Lưu thay đổi</span>
                </Button>
              </div>
            </form>
          </section>

          <section className="rounded-xl border border-line bg-surface-card p-6">
            <h2 className="mb-4 text-base font-bold text-ink-primary">Đổi mật khẩu</h2>
            <form onSubmit={handleChangePassword} className="flex flex-col gap-4">
              <Input
                label="Mật khẩu mới"
                type="password"
                autoComplete="new-password"
                placeholder="Ít nhất 8 ký tự"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
              />
              <Input
                label="Nhập lại mật khẩu mới"
                type="password"
                autoComplete="new-password"
                placeholder="Nhập lại mật khẩu mới"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
              />
              <div>
                <Button type="submit" variant="primary" loading={savingPassword}>
                  <KeyRound className="h-4 w-4" aria-hidden="true" />
                  <span>Đổi mật khẩu</span>
                </Button>
              </div>
            </form>
          </section>
        </div>
      </div>
    </Layout>
  );
}

