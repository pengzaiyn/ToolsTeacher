-- Cho phép sinh viên xem danh sách bạn cùng lớp trong lớp mình đang theo học
-- qua hàm RPC bảo mật: chỉ trả về thông tin học vụ công khai trong lớp
-- (họ tên, mã SV, lớp, khóa, ngành, ảnh đại diện) — TUYỆT ĐỐI không trả SĐT, CCCD, ngày sinh, nơi sinh, email.

CREATE OR REPLACE FUNCTION private.list_class_classmates(p_class_id uuid)
RETURNS TABLE (
  student_id uuid,
  full_name text,
  student_code text,
  class_name text,
  cohort text,
  major text,
  avatar_url text,
  is_self boolean
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid uuid := (SELECT auth.uid());
  v_role text := COALESCE(private.user_role(), '');
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Bạn cần đăng nhập để xem danh sách lớp';
  END IF;

  IF v_role NOT IN ('admin', 'teacher') THEN
    IF NOT EXISTS (
      SELECT 1
      FROM public.enrollments e
      WHERE e.class_id = p_class_id
        AND e.student_id = v_uid
    ) THEN
      RAISE EXCEPTION 'Bạn không thuộc lớp học này';
    END IF;
  END IF;

  RETURN QUERY
  SELECT
    p.id AS student_id,
    p.full_name,
    p.student_code,
    p.class_name,
    p.cohort,
    p.major,
    p.avatar_url,
    (p.id = v_uid) AS is_self
  FROM public.enrollments e
  JOIN public.profiles p ON p.id = e.student_id
  WHERE e.class_id = p_class_id
    AND p.role = 'student'
    AND COALESCE(lower(btrim(p.academic_status)), '') NOT LIKE '%thôi học%'
    AND COALESCE(lower(btrim(p.academic_status)), '') NOT LIKE '%bỏ học%'
    AND COALESCE(lower(btrim(p.academic_status)), '') NOT LIKE '%nghỉ học%'
    AND COALESCE(lower(btrim(p.academic_status)), '') NOT LIKE '%đã nghỉ%'
  ORDER BY p.full_name ASC;
END;
$$;

CREATE OR REPLACE FUNCTION public.list_class_classmates(p_class_id uuid)
RETURNS TABLE (
  student_id uuid,
  full_name text,
  student_code text,
  class_name text,
  cohort text,
  major text,
  avatar_url text,
  is_self boolean
)
LANGUAGE plpgsql
STABLE
SET search_path = ''
AS $$
BEGIN
  IF (SELECT auth.uid()) IS NULL THEN
    RAISE EXCEPTION 'Bạn cần đăng nhập để xem danh sách lớp';
  END IF;

  RETURN QUERY
  SELECT
    c.student_id,
    c.full_name,
    c.student_code,
    c.class_name,
    c.cohort,
    c.major,
    c.avatar_url,
    c.is_self
  FROM private.list_class_classmates(p_class_id) c;
END;
$$;

REVOKE ALL ON FUNCTION public.list_class_classmates(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_class_classmates(uuid) TO authenticated;

