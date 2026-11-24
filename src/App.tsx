import { lazy, Suspense } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from '@/context/AuthContext';
import { CursorEffectProvider } from '@/context/CursorEffectContext';
import { CustomThemeProvider } from '@/context/CustomThemeContext';
import { LanguageProvider } from '@/context/LanguageContext';
import { SettingsModalProvider } from '@/context/SettingsModalContext';
import { ThemeProvider } from '@/context/ThemeContext';
import { UnreadAnnouncementsProvider } from '@/context/UnreadAnnouncementsContext';
import { CursorEffectOverlay } from '@/components/CursorEffectOverlay';
import { GlobalCardGlow } from '@/components/GlobalCardGlow';
import { GlobalLanguageTranslator } from '@/components/GlobalLanguageTranslator';
import { AssistantWidget } from '@/components/AssistantWidget';
import { RealtimeAnnouncementPopup } from '@/components/RealtimeAnnouncementPopup';
import { SettingsModal } from '@/components/SettingsModal';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { LoadingState } from '@/components/ui/Spinner';
import { ToastProvider } from '@/components/ui/Toast';

const ClassDetail = lazy(() => import('@/pages/ClassDetail').then((m) => ({ default: m.ClassDetail })));
const ClassroomKit = lazy(() => import('@/pages/ClassroomKit').then((m) => ({ default: m.ClassroomKit })));
const Classes = lazy(() => import('@/pages/Classes').then((m) => ({ default: m.Classes })));
const Games = lazy(() => import('@/pages/Games').then((m) => ({ default: m.Games })));
const HskTowerGame = lazy(() =>
  import('@/pages/HskTowerGame').then((m) => ({ default: m.HskTowerGame }))
);
const Login = lazy(() => import('@/pages/Login').then((m) => ({ default: m.Login })));
const Profile = lazy(() => import('@/pages/Profile').then((m) => ({ default: m.Profile })));
const ResetPassword = lazy(() => import('@/pages/ResetPassword').then((m) => ({ default: m.ResetPassword })));
const Settings = lazy(() => import('@/pages/Settings').then((m) => ({ default: m.Settings })));
const TeacherAttendance = lazy(() => import('@/pages/TeacherAttendance').then((m) => ({ default: m.TeacherAttendance })));
const TeacherExamMixer = lazy(() => import('@/pages/TeacherExamMixer').then((m) => ({ default: m.TeacherExamMixer })));
const TeacherGradebook = lazy(() => import('@/pages/TeacherGradebook').then((m) => ({ default: m.TeacherGradebook })));
const TeacherSchedule = lazy(() => import('@/pages/TeacherSchedule').then((m) => ({ default: m.TeacherSchedule })));
const TeacherTools = lazy(() => import('@/pages/TeacherTools').then((m) => ({ default: m.TeacherTools })));
const Timetable = lazy(() => import('@/pages/Timetable').then((m) => ({ default: m.Timetable })));
const TimetableUpload = lazy(() => import('@/pages/TimetableUpload').then((m) => ({ default: m.TimetableUpload })));
const Tools = lazy(() => import('@/pages/Tools').then((m) => ({ default: m.Tools })));
const AdminAnnouncements = lazy(() =>
  import('@/pages/admin/AdminAnnouncements').then((m) => ({ default: m.AdminAnnouncements }))
);
const AdminTeachers = lazy(() => import('@/pages/admin/AdminTeachers').then((m) => ({ default: m.AdminTeachers })));

export function App() {
  return (
    <BrowserRouter>
      <LanguageProvider>
      <ThemeProvider>
        <CustomThemeProvider>
          <CursorEffectProvider>
            <ToastProvider>
              <AuthProvider>
                <UnreadAnnouncementsProvider>
                <SettingsModalProvider>
                  <Suspense fallback={<div className="p-8"><LoadingState message="Đang tải trang..." /></div>}>
                  <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route
              path="/tools"
              element={
                <ProtectedRoute>
                  <Tools />
                </ProtectedRoute>
              }
            />
            <Route
              path="/timetable"
              element={
                <ProtectedRoute>
                  <Timetable />
                </ProtectedRoute>
              }
            />
            <Route
              path="/timetable/upload"
              element={
                <ProtectedRoute allowedRoles={['teacher', 'admin']}>
                  <TimetableUpload />
                </ProtectedRoute>
              }
            />
            <Route
              path="/teacher/tools"
              element={
                <ProtectedRoute allowedRoles={['teacher', 'admin']}>
                  <TeacherTools />
                </ProtectedRoute>
              }
            />
            <Route
              path="/teacher/schedule"
              element={
                <ProtectedRoute allowedRoles={['teacher', 'admin']}>
                  <TeacherSchedule />
                </ProtectedRoute>
              }
            />
            <Route
              path="/teacher/classroom-kit"
              element={
                <ProtectedRoute allowedRoles={['teacher', 'admin']}>
                  <ClassroomKit />
                </ProtectedRoute>
              }
            />
            <Route
              path="/teacher/attendance"
              element={
                <ProtectedRoute allowedRoles={['teacher', 'admin']}>
                  <TeacherAttendance />
                </ProtectedRoute>
              }
            />
            <Route
              path="/teacher/gradebook"
              element={
                <ProtectedRoute allowedRoles={['teacher', 'admin']}>
                  <TeacherGradebook />
                </ProtectedRoute>
              }
            />
            <Route
              path="/teacher/exam-mixer"
              element={
                <ProtectedRoute allowedRoles={['teacher', 'admin']}>
                  <TeacherExamMixer />
                </ProtectedRoute>
              }
            />
            <Route
              path="/classes"
              element={
                <ProtectedRoute>
                  <Classes />
                </ProtectedRoute>
              }
            />
            <Route
              path="/classes/:id"
              element={
                <ProtectedRoute>
                  <ClassDetail />
                </ProtectedRoute>
              }
            />
            <Route
              path="/games"
              element={
                <ProtectedRoute>
                  <Games />
                </ProtectedRoute>
              }
            />
            <Route
              path="/games/hsk-tower"
              element={
                <ProtectedRoute>
                  <HskTowerGame />
                </ProtectedRoute>
              }
            />
            <Route
              path="/hsk-tower"
              element={
                <ProtectedRoute>
                  <HskTowerGame />
                </ProtectedRoute>
              }
            />
            <Route
              path="/profile"
              element={
                <ProtectedRoute>
                  <Profile />
                </ProtectedRoute>
              }
            />
            <Route
              path="/settings"
              element={
                <ProtectedRoute>
                  <Settings />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/teachers"
              element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <AdminTeachers />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/announcements"
              element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <AdminAnnouncements />
                </ProtectedRoute>
              }
            />
            <Route path="/" element={<Navigate to="/tools" replace />} />
            <Route path="*" element={<Navigate to="/tools" replace />} />
          </Routes>
                  </Suspense>
                  <SettingsModal />
                  <RealtimeAnnouncementPopup />
                  <AssistantWidget />
                </SettingsModalProvider>
                </UnreadAnnouncementsProvider>
              </AuthProvider>
            </ToastProvider>
            <CursorEffectOverlay />
            <GlobalCardGlow />
            <GlobalLanguageTranslator />
          </CursorEffectProvider>
        </CustomThemeProvider>
      </ThemeProvider>
      </LanguageProvider>
    </BrowserRouter>
  );
}
export default App;

