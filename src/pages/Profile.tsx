import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { Camera, Eye, EyeOff, KeyRound, RotateCcw, Save, User } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { isValidAvatarUrl, resizeAvatarFileToDataUrl } from '@/lib/avatar';
import { maskCccd, maskPhone } from '@/lib/privacy';
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
  const [savingAvatar, setSavingAvatar] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);
  const [sensitiveInfo, setSensitiveInfo] = useState<{
    cccd: string | null;
    cccd_issued_date: string | null;
  } | null>(null);
  const [showPhone, setShowPhone] = useState(false);
  const [showCccd, setShowCccd] = useState(false);

  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name);
    }
  }, [profile]);

  useEffect(() => {
    if (!profile || profile.role !== 'student') {
      setSensitiveInfo(null);
      return;
    }
    let cancelled = false;
    supabase
      .from('student_sensitive_profiles')
      .select('cccd, cccd_issued_date')
      .eq('student_id', profile.id)
      .maybeSingle<{ cccd: string | null; cccd_issued_date: string | null }>()
      .then(({ data, error }) => {
        if (cancelled) return;
        if (!error && data) {
          setSensitiveInfo(data);
        } else {
          setSensitiveInfo({
            cccd: profile.cccd ?? null,
            cccd_issued_date: profile.cccd_issued_date ?? null,
          });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [profile]);

  if (!profile) return null;

  const hasCustomAvatar = isValidAvatarUrl(profile.avatar_url);

  async function handleSelectAvatar(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    setSavingAvatar(true);
    try {
      const dataUrl = await resizeAvatarFileToDataUrl(file);
      const { error } = await supabase
        .from('profiles')
        .update({ avatar_url: dataUrl })
        .eq('id', profile!.id);

      if (error) {
        throw new Error(error.message);
      }
      await refreshProfile();
      toast.success('Đã cập nhật ảnh đại diện');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Không cập nhật được ảnh đại diện');
    } finally {
      setSavingAvatar(false);
    }
  }

  async function handleResetAvatar() {
    setSavingAvatar(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ avatar_url: null })
        .eq('id', profile!.id);

      if (error) {
        throw new Error(error.message);
      }
      await refreshProfile();
      toast.success('Đã khôi phục ảnh đại diện mặc định');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Không khôi phục được ảnh đại diện');
    } finally {
      setSavingAvatar(false);
    }
  }

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

  const isStudentProfile = profile.role === 'student';
  const ownCccd = sensitiveInfo?.cccd ?? profile.cccd ?? null;
  const ownCccdIssuedDate = sensitiveInfo?.cccd_issued_date ?? profile.cccd_issued_date ?? null;

  const infoItems: Array<{
    label: string;
    value: string;
    toggle?: { revealed: boolean; onToggle: () => void };
  }> = isStudentProfile
    ? [
        { label: 'Email', value: profile.email },
        { label: 'Vai trò', value: ROLE_LABELS[profile.role] },
        { label: 'Mã sinh viên', value: profile.student_code || '—' },
        { label: 'Lớp học', value: profile.class_name || '—' },
        { label: 'Khóa học', value: profile.cohort || '—' },
        { label: 'Khoa', value: profile.faculty || '—' },
        { label: 'Ngành học', value: profile.major || '—' },
        {
          label: 'Ngày sinh',
          value: profile.date_of_birth ? formatDateVi(profile.date_of_birth) : '—',
        },
        { label: 'Nơi sinh', value: profile.place_of_birth || '—' },
        {
          label: 'Số điện thoại',
          value: profile.phone ? (showPhone ? profile.phone : maskPhone(profile.phone)) : '—',
          toggle: profile.phone
            ? { revealed: showPhone, onToggle: () => setShowPhone((v) => !v) }
            : undefined,
        },
        {
          label: 'Số CCCD',
          value: ownCccd ? (showCccd ? ownCccd : maskCccd(ownCccd)) : '—',
          toggle: ownCccd
            ? { revealed: showCccd, onToggle: () => setShowCccd((v) => !v) }
            : undefined,
        },
        {
          label: 'Ngày cấp CCCD',
          value: ownCccdIssuedDate ? formatDateVi(ownCccdIssuedDate) : '—',
        },
        ...(profile.gender ? [{ label: 'Giới tính', value: profile.gender }] : []),
        ...(profile.admissions_advisor
          ? [{ label: 'Tư vấn tuyển sinh', value: profile.admissions_advisor }]
          : []),
      ]
    : [
        { label: 'Email', value: profile.email },
        { label: 'Vai trò', value: ROLE_LABELS[profile.role] },
        ...(profile.subject ? [{ label: 'Chủ nhiệm môn', value: profile.subject }] : []),
        ...(profile.faculty ? [{ label: 'Khoa', value: profile.faculty }] : []),
        ...(profile.phone
          ? [
              {
                label: 'Số điện thoại',
                value: showPhone ? profile.phone : maskPhone(profile.phone),
                toggle: { revealed: showPhone, onToggle: () => setShowPhone((v) => !v) },
              },
            ]
          : []),
        ...(profile.gender ? [{ label: 'Giới tính', value: profile.gender }] : []),
        ...(profile.date_of_birth
          ? [{ label: 'Ngày sinh', value: formatDateVi(profile.date_of_birth) }]
          : []),
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

        <section className="rounded-2xl border border-line bg-surface-card p-6">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-center gap-4">
              <div className="relative shrink-0">
                <button
                  type="button"
                  disabled={savingAvatar}
                  onClick={() => avatarInputRef.current?.click()}
                  aria-label="Chọn ảnh đại diện"
                  className="group relative flex h-24 w-24 items-center justify-center overflow-hidden rounded-full bg-surface-page ring-2 ring-brand-navy/20 ring-offset-2 ring-offset-surface-card transition-all hover:ring-brand-red focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-red disabled:opacity-60"
                >
                  {hasCustomAvatar ? (
                    <img
                      src={profile.avatar_url!}
                      alt={profile.full_name}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <>
                      <img
                        src="/logo-light.png"
                        alt="Trường Cao đẳng Việt Mỹ Hà Nội"
                        className="h-16 w-16 object-contain dark:hidden"
                      />
                      <img
                        src="/logo-dark.png"
                        alt="Trường Cao đẳng Việt Mỹ Hà Nội"
                        className="hidden h-16 w-16 object-contain dark:block"
                      />
                    </>
                  )}
                  <span className="absolute inset-0 flex items-center justify-center bg-black/40 text-white opacity-0 transition-opacity group-hover:opacity-100">
                    <Camera className="h-5 w-5" aria-hidden="true" />
                  </span>
                </button>
                <button
                  type="button"
                  disabled={savingAvatar}
                  onClick={() => avatarInputRef.current?.click()}
                  aria-label="Đổi ảnh đại diện"
                  className="absolute -bottom-0.5 -right-0.5 flex h-8 w-8 items-center justify-center rounded-full border-2 border-surface-card bg-brand-navy text-white shadow-sm transition-transform hover:scale-105 hover:bg-brand-red disabled:opacity-60"
                >
                  <Camera className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              </div>

              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="truncate text-lg font-bold text-ink-primary">
                    {profile.full_name}
                  </h2>
                  <Badge tone="navy">{ROLE_LABELS[profile.role]}</Badge>
                </div>
                <p className="mt-0.5 truncate text-sm font-normal text-ink-secondary">
                  {profile.email}
                </p>
                <p className="mt-1.5 text-xs font-normal text-ink-muted">
                  Ảnh đại diện tùy chọn — mặc định dùng logo trường.
                </p>
              </div>
            </div>

            <div className="flex shrink-0 flex-wrap items-center gap-2 sm:flex-nowrap">
              <input
                ref={avatarInputRef}
                type="file"
                accept="image/*"
                onChange={handleSelectAvatar}
                className="hidden"
              />
              <Button
                type="button"
                variant="navy"
                size="sm"
                loading={savingAvatar}
                onClick={() => avatarInputRef.current?.click()}
                className="whitespace-nowrap"
              >
                <Camera className="h-4 w-4" aria-hidden="true" />
                <span>{hasCustomAvatar ? 'Đổi ảnh' : 'Chọn ảnh'}</span>
              </Button>
              {hasCustomAvatar && (
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  disabled={savingAvatar}
                  onClick={handleResetAvatar}
                  className="whitespace-nowrap"
                >
                  <RotateCcw className="h-4 w-4" aria-hidden="true" />
                  <span>Mặc định</span>
                </Button>
              )}
            </div>
          </div>

          <div className="mt-6 border-t border-line pt-6">
            <h3 className="mb-4 text-base font-bold text-ink-primary">Thông tin chung</h3>
            <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {infoItems.map((item) => (
                <div key={item.label} className="min-w-0 rounded-lg bg-surface-page p-4">
                  <div className="flex items-center justify-between gap-2">
                    <dt className="text-xs font-normal text-ink-muted">{item.label}</dt>
                    {item.toggle && (
                      <button
                        type="button"
                        onClick={item.toggle.onToggle}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-brand-navy hover:underline"
                      >
                        {item.toggle.revealed ? (
                          <EyeOff className="h-3.5 w-3.5" aria-hidden="true" />
                        ) : (
                          <Eye className="h-3.5 w-3.5" aria-hidden="true" />
                        )}
                        <span>{item.toggle.revealed ? 'Ẩn số' : 'Hiện số'}</span>
                      </button>
                    )}
                  </div>
                  <dd className="mt-2 break-words text-sm font-semibold text-ink-primary">
                    {item.value}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
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

