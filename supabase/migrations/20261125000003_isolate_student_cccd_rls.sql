-- Tách dữ liệu nhạy cảm (CCCD, ngày cấp CCCD) ra bảng riêng với RLS chặt chẽ:
-- Chỉ chính sinh viên đó, Hiệu trưởng (admin), hoặc Cố vấn học tập / GV chủ nhiệm của lớp đó (classes.teacher_id)
-- mới được truy vấn. Giáo viên bộ môn hoàn toàn không đọc được kể cả qua REST API.

CREATE TABLE IF NOT EXISTS public.student_sensitive_profiles (
  student_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  cccd text,
  cccd_issued_date text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 1. Di chuyển dữ liệu CCCD hiện có từ public.profiles sang bảng riêng (an toàn khi chạy lại)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'profiles'
      AND column_name = 'cccd'
  ) THEN
    INSERT INTO public.student_sensitive_profiles (student_id, cccd, cccd_issued_date, updated_at)
    SELECT id, cccd, cccd_issued_date, now()
    FROM public.profiles
    WHERE role = 'student'
      AND (cccd IS NOT NULL OR cccd_issued_date IS NOT NULL)
    ON CONFLICT (student_id) DO UPDATE
      SET cccd = COALESCE(EXCLUDED.cccd, public.student_sensitive_profiles.cccd),
          cccd_issued_date = COALESCE(EXCLUDED.cccd_issued_date, public.student_sensitive_profiles.cccd_issued_date),
          updated_at = now();
  END IF;
END
$$;

-- 2. Cập nhật trigger bảo vệ hồ sơ (bỏ 2 cột cccd, cccd_issued_date trước khi drop)
CREATE OR REPLACE FUNCTION private.protect_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF (SELECT auth.uid()) IS NOT NULL AND NOT private.is_admin() THEN
    IF new.id IS DISTINCT FROM old.id
       OR new.email IS DISTINCT FROM old.email
       OR new.role IS DISTINCT FROM old.role
       OR new.student_code IS DISTINCT FROM old.student_code
       OR new.subject IS DISTINCT FROM old.subject
       OR new.is_active IS DISTINCT FROM old.is_active
       OR new.gender IS DISTINCT FROM old.gender
       OR new.date_of_birth IS DISTINCT FROM old.date_of_birth
       OR new.admissions_advisor IS DISTINCT FROM old.admissions_advisor
       OR new.class_name IS DISTINCT FROM old.class_name
       OR new.class_key IS DISTINCT FROM old.class_key
       OR new.education_system IS DISTINCT FROM old.education_system
       OR new.major IS DISTINCT FROM old.major
       OR new.cohort IS DISTINCT FROM old.cohort
       OR new.initial_cohort IS DISTINCT FROM old.initial_cohort
       OR new.academic_status IS DISTINCT FROM old.academic_status
       OR new.status_reason IS DISTINCT FROM old.status_reason
       OR new.status_note IS DISTINCT FROM old.status_note
       OR new.phone IS DISTINCT FROM old.phone
       OR new.place_of_birth IS DISTINCT FROM old.place_of_birth
       OR new.faculty IS DISTINCT FROM old.faculty
       OR new.cis_updated_at IS DISTINCT FROM old.cis_updated_at THEN
      RAISE EXCEPTION 'Bạn không có quyền thay đổi các trường này';
    END IF;
  END IF;
  RETURN new;
END;
$$;

-- 3. Gỡ hoàn toàn 2 cột CCCD khỏi bảng public.profiles để role teacher không thể query
ALTER TABLE public.profiles
  DROP COLUMN IF EXISTS cccd,
  DROP COLUMN IF EXISTS cccd_issued_date;

-- 4. Hàm kiểm tra người gọi có phải Cố vấn học tập / GV chủ nhiệm của sinh viên đó không
CREATE OR REPLACE FUNCTION private.is_student_homeroom_advisor(p_student_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.enrollments e
    JOIN public.classes c ON c.id = e.class_id
    WHERE e.student_id = p_student_id
      AND c.teacher_id = (SELECT auth.uid())
  );
$$;

-- 5. Bật RLS & cấp quyền tối thiểu trên public.student_sensitive_profiles
ALTER TABLE public.student_sensitive_profiles ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.student_sensitive_profiles FROM anon;
GRANT SELECT ON TABLE public.student_sensitive_profiles TO authenticated;
GRANT INSERT, UPDATE, DELETE ON TABLE public.student_sensitive_profiles TO authenticated;

DROP POLICY IF EXISTS "student_sensitive_select" ON public.student_sensitive_profiles;
CREATE POLICY "student_sensitive_select"
  ON public.student_sensitive_profiles
  FOR SELECT
  TO authenticated
  USING (
    student_id = (SELECT auth.uid())
    OR private.is_admin()
    OR private.is_student_homeroom_advisor(student_id)
  );

DROP POLICY IF EXISTS "student_sensitive_admin_insert" ON public.student_sensitive_profiles;
CREATE POLICY "student_sensitive_admin_insert"
  ON public.student_sensitive_profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (private.is_admin());

DROP POLICY IF EXISTS "student_sensitive_admin_update" ON public.student_sensitive_profiles;
CREATE POLICY "student_sensitive_admin_update"
  ON public.student_sensitive_profiles
  FOR UPDATE
  TO authenticated
  USING (private.is_admin())
  WITH CHECK (private.is_admin());

DROP POLICY IF EXISTS "student_sensitive_admin_delete" ON public.student_sensitive_profiles;
CREATE POLICY "student_sensitive_admin_delete"
  ON public.student_sensitive_profiles
  FOR DELETE
  TO authenticated
  USING (private.is_admin());

