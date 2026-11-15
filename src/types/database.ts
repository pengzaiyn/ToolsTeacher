export type UserRole = 'admin' | 'teacher' | 'student';

export type Gender = 'Nam' | 'Nữ' | 'Khác';

export interface Profile {
  id: string;
  email: string;
  full_name: string;
  student_code: string | null;
  role: UserRole;
  subject: string | null;
  avatar_url: string | null;
  is_active: boolean;
  created_at: string;
  gender: Gender | null;
  date_of_birth: string | null;
  admissions_advisor: string | null;
  class_name: string | null;
  class_key: string | null;
}

export interface TimetableEntry {
  id: string;
  upload_id: string;
  class_name: string;
  class_key: string;
  weekday: number;
  period_start: number;
  period_end: number;
  subject: string;
  teacher_name: string | null;
  teacher_key: string | null;
  room: string | null;
  note: string | null;
  date_from: string | null;
  date_to: string | null;
}

export interface TimetableEntryInput {
  class_name: string;
  class_key: string;
  weekday: number;
  period_start: number;
  period_end: number;
  subject: string;
  teacher_name: string | null;
  teacher_key: string | null;
  room: string | null;
  note: string | null;
  date_from: string | null;
  date_to: string | null;
}

export interface TimetableClassSummary {
  class_name: string;
  class_key: string;
  entries: number;
}

export interface TimetableTeacherAccount {
  id: string;
  full_name: string;
  role: Extract<UserRole, 'teacher' | 'admin'>;
  subject: string | null;
}

export interface TimetableUpload {
  id: string;
  file_name: string | null;
  uploaded_by: string;
  created_at: string;
}

export interface Announcement {
  id: string;
  class_id: string | null;
  title: string;
  content: string | null;
  created_by: string;
  created_at: string;
}

export interface CollegeClass {
  id: string;
  name: string;
  class_key?: string | null;
  subject: string | null;
  description: string | null;
  cover_url: string | null;
  teacher_id: string | null;
  created_at: string;
  teacher?: Pick<Profile, 'id' | 'full_name' | 'email'> | null;
}

export interface Enrollment {
  id: string;
  class_id: string;
  student_id: string;
  enrolled_at: string;
  student?: Pick<
    Profile,
    'id' | 'full_name' | 'email' | 'student_code' | 'class_name' | 'is_active'
  > | null;
}

export interface Material {
  id: string;
  class_id: string;
  title: string;
  file_url: string;
  file_name: string | null;
  file_size: number | null;
  uploaded_by: string;
  created_at: string;
}

export type AssignmentType = 'multiple_choice' | 'essay' | 'short_answer' | 'file_upload';

export interface McqQuestion {
  id: string;
  prompt: string;
  options: string[];
  points: number;
}

export interface Assignment {
  id: string;
  class_id: string;
  title: string;
  description: string | null;
  type: AssignmentType;
  questions: McqQuestion[];
  max_score: number;
  ai_grading: boolean;
  due_date: string | null;
  created_by: string;
  created_at: string;
}

export interface AssignmentKey {
  assignment_id: string;
  answer_key: Record<string, number | string>;
}

export type SubmissionStatus = 'pending' | 'ai_graded' | 'graded';

export interface Grade {
  id: string;
  submission_id: string;
  score: number | null;
  feedback: string | null;
  graded_by: string | null;
  ai_score: number | null;
  ai_feedback: string | null;
  is_ai: boolean;
  graded_at: string | null;
}

export interface Submission {
  id: string;
  assignment_id: string;
  student_id: string;
  answers: Record<string, number | string>;
  file_url: string | null;
  status: SubmissionStatus;
  submitted_at: string;
  student?: Pick<Profile, 'id' | 'full_name' | 'email' | 'student_code'> | null;
  grade?: Grade[] | Grade | null;
}

export interface GradeRow {
  id: string;
  submission_id: string;
  score: number | null;
  feedback: string | null;
  graded_at: string | null;
  is_ai: boolean;
  student_name?: string;
  student_code?: string | null;
  assignment_title?: string;
  max_score?: number;
}

export type AttendanceStatus = 'present' | 'late' | 'excused' | 'absent';

export interface AttendanceSession {
  id: string;
  class_id: string;
  session_date: string;
  title: string;
  subject: string | null;
  period_start: number | null;
  period_end: number | null;
  room: string | null;
  note: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface AttendanceRecord {
  id: string;
  session_id: string;
  student_id: string;
  status: AttendanceStatus;
  note: string | null;
  marked_by: string;
  updated_at: string;
}

export interface ClassGradebookSettings {
  class_id: string;
  attendance_weight: number;
  assignment_weight: number;
  absence_warning_pct: number;
  late_weight: number;
  excused_weight: number;
  updated_by: string | null;
  updated_at: string;
}
