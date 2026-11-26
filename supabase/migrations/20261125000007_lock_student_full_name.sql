-- Khóa cứng họ và tên (full_name) của sinh viên theo dữ liệu chính thức từ API CIS:
-- Sinh viên không được tự sửa full_name (chỉ được đổi ảnh đại diện avatar_url).

CREATE OR REPLACE FUNCTION private.protect_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF (SELECT auth.uid()) IS NOT NULL AND NOT private.is_admin() THEN
    IF (old.role = 'student' AND new.full_name IS DISTINCT FROM old.full_name)
       OR new.id IS DISTINCT FROM old.id
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
      RAISE EXCEPTION 'Họ tên và hồ sơ sinh viên được đồng bộ cố định từ hệ thống CIS của nhà trường';
    END IF;
  END IF;
  RETURN new;
END;
$$;

