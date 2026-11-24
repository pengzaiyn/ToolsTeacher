import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, RotateCcw, SlidersHorizontal } from 'lucide-react';
import type { SettingsSectionId } from '@/context/SettingsModalContext';
import { Layout } from '@/components/Layout';
import { SettingsPanel, useResetAppearanceSettings } from '@/components/SettingsPanel';
import { Button } from '@/components/ui/Button';

const VALID_TABS = new Set<SettingsSectionId>(['theme', 'custom', 'cursor']);

function parseTabParam(raw: string | null): SettingsSectionId {
  if (raw && VALID_TABS.has(raw as SettingsSectionId)) {
    return raw as SettingsSectionId;
  }
  return 'theme';
}

export function Settings() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const activeTab = parseTabParam(searchParams.get('tab'));
  const handleReset = useResetAppearanceSettings();

  function handleSelectTab(tab: SettingsSectionId) {
    setSearchParams({ tab }, { replace: true });
  }

  function handleGoBack() {
    const historyIdx =
      typeof window !== 'undefined' && typeof window.history.state?.idx === 'number'
        ? window.history.state.idx
        : 0;
    if (historyIdx > 0) {
      navigate(-1);
      return;
    }
    navigate('/tools');
  }

  return (
    <Layout>
      <div className="mx-auto flex max-w-6xl flex-col gap-6">
        {/* Tiêu đề trang Cài đặt */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-navySoft text-brand-navy">
              <SlidersHorizontal className="h-6 w-6" aria-hidden="true" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-brand-navy">Cài đặt giao diện</h1>
              <p className="text-sm font-normal text-ink-secondary">
                Tùy chỉnh chế độ Sáng/Tối, chủ đề cá nhân (ảnh nền, bảng màu nhấn) và hiệu ứng con trỏ chuột
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button variant="secondary" size="sm" onClick={handleGoBack}>
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              <span>Quay lại</span>
            </Button>

            <Button variant="secondary" size="sm" onClick={handleReset}>
              <RotateCcw className="h-4 w-4" aria-hidden="true" />
              <span>Khôi phục mặc định</span>
            </Button>
          </div>
        </div>

        <SettingsPanel activeTab={activeTab} onSelectTab={handleSelectTab} />
      </div>
    </Layout>
  );
}
