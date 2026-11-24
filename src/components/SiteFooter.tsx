// Lucian UX/UI Prompt #418 · MIT License (c) 2026 Seokwoooo · https://lucianlabs.dev/uxui-prompt/#418
import { Link } from 'react-router-dom';
import { Globe, Mail, Share2, Video } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useLanguage } from '@/context/LanguageContext';
import { isAdmin, isStaff } from '@/lib/roles';
import './lucian-418.css';

export function SiteFooter() {
  const { profile } = useAuth();
  const { t } = useLanguage();
  const staffRole = isStaff(profile?.role);
  const adminRole = isAdmin(profile?.role);

  return (
    <footer className="ux u418 mx-auto w-full max-w-7xl px-4 pb-6 pt-2 sm:px-6">
      <div className="u418-ft">
        <div className="u418-main">
          {/* Cột trái: Logo trường + tên Trường */}
          <div className="u418-brand">
            <Link className="u418-logo" to="/tools" aria-label="Trang chủ AVC Connect">
              <img
                src="/logo-light.png"
                alt="Trường Cao đẳng Việt Mỹ Hà Nội"
                className="h-16 w-auto max-w-full object-contain dark:hidden"
              />
              <img
                src="/logo-dark.png"
                alt="Trường Cao đẳng Việt Mỹ Hà Nội"
                className="hidden h-16 w-auto max-w-full object-contain dark:block"
              />
            </Link>
            <p className="u418-school-name">{t('footer.schoolName')}</p>
          </div>

          {/* Cột phải: 2 nhóm liên kết cân đối + icon kết nối ở góc phải trên */}
          <div className="u418-right">
            <nav className="u418-cols" aria-label="Liên kết nhanh">
              <div>
                <h4>{t('footer.col1')}</h4>
                <ul>
                  <li>
                    <Link to="/tools">{t('nav.home')}</Link>
                  </li>
                  <li>
                    <Link to="/timetable">{t('nav.timetable')}</Link>
                  </li>
                  <li>
                    <Link to="/classes">{t('nav.classes')}</Link>
                  </li>
                  <li>
                    <Link to="/games">{t('footer.games')}</Link>
                  </li>
                </ul>
              </div>

              <div>
                <h4>{staffRole ? t('footer.col2Staff') : t('footer.col2Student')}</h4>
                <ul>
                  {staffRole ? (
                    <>
                      <li>
                        <Link to="/teacher/tools">{t('nav.teacherTools')}</Link>
                      </li>
                      <li>
                        <Link to="/teacher/schedule">{t('footer.teacherSchedule')}</Link>
                      </li>
                    </>
                  ) : (
                    <>
                      <li>
                        <Link to="/games/hsk-tower">{t('footer.hskTower')}</Link>
                      </li>
                      <li>
                        <Link to="/games?tab=suggestions">{t('footer.suggestGame')}</Link>
                      </li>
                    </>
                  )}
                  <li>
                    <Link to="/profile">{t('footer.profile')}</Link>
                  </li>
                  <li>
                    <Link to="/settings">{t('footer.appearance')}</Link>
                  </li>
                  {adminRole && (
                    <li>
                      <Link to="/admin/announcements">{t('footer.manageAnn')}</Link>
                    </li>
                  )}
                </ul>
              </div>
            </nav>

            <ul className="u418-so" aria-label="Kênh thông tin nhà trường">
              <li>
                <a
                  className="web"
                  href="https://caodangvietmyhanoi.edu.vn"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Website Trường Cao đẳng Việt Mỹ Hà Nội"
                  title="Website nhà trường"
                >
                  <Globe className="h-4 w-4" aria-hidden="true" />
                </a>
              </li>
              <li>
                <a
                  className="fb"
                  href="https://www.facebook.com/caodangvietmyhanoi"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Facebook Trường Cao đẳng Việt Mỹ Hà Nội"
                  title="Facebook nhà trường"
                >
                  <Share2 className="h-4 w-4" aria-hidden="true" />
                </a>
              </li>
              <li>
                <a
                  className="yt"
                  href="https://www.youtube.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="YouTube nhà trường"
                  title="Kênh YouTube"
                >
                  <Video className="h-4 w-4" aria-hidden="true" />
                </a>
              </li>
              <li>
                <a
                  className="mail"
                  href="mailto:tuyensinh@caodangvietmyhanoi.edu.vn"
                  aria-label="Gửi email liên hệ nhà trường"
                  title="Email liên hệ"
                >
                  <Mail className="h-4 w-4" aria-hidden="true" />
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="u418-bt">
          <span>© 2026 {t('footer.schoolName')}</span>
          <span>{t('footer.tagline')}</span>
        </div>
      </div>
    </footer>
  );
}
