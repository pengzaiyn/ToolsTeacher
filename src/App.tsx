import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from '@/context/AuthContext';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { ToastProvider } from '@/components/ui/Toast';
import { ClassDetail } from '@/pages/ClassDetail';
import { ClassroomKit } from '@/pages/ClassroomKit';
import { Classes } from '@/pages/Classes';
import { Login } from '@/pages/Login';
import { Profile } from '@/pages/Profile';
import { TeacherSchedule } from '@/pages/TeacherSchedule';
import { TeacherTools } from '@/pages/TeacherTools';
import { Timetable } from '@/pages/Timetable';
import { TimetableUpload } from '@/pages/TimetableUpload';
import { Tools } from '@/pages/Tools';
import { AdminAnnouncements } from '@/pages/admin/AdminAnnouncements';
import { AdminClassDetail } from '@/pages/admin/AdminClassDetail';
import { AdminClasses } from '@/pages/admin/AdminClasses';
import { AdminDashboard } from '@/pages/admin/AdminDashboard';
import { AdminStudents } from '@/pages/admin/AdminStudents';
import { AdminTeachers } from '@/pages/admin/AdminTeachers';

export function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<Login />} />
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
              path="/profile"
              element={
                <ProtectedRoute>
                  <Profile />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin"
              element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <AdminDashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/students"
              element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <AdminStudents />
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
            <Route
              path="/admin/classes"
              element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <AdminClasses />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/classes/:id"
              element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <AdminClassDetail />
                </ProtectedRoute>
              }
            />
            <Route path="/" element={<Navigate to="/tools" replace />} />
            <Route path="*" element={<Navigate to="/tools" replace />} />
          </Routes>
        </AuthProvider>
      </ToastProvider>
    </BrowserRouter>
  );
}
export default App;

