-- Đồng bộ chặt chẽ lớp học & ghi danh với dữ liệu CIS API:
-- 1. Tạo lớp còn thiếu từ profiles + timetable_entries (kèm ngành học từ CIS)
-- 2. Bổ sung ngành học (subject) cho các lớp chưa có ngành từ profiles.major (CIS)
-- 3. Ghi danh sinh viên vào đúng lớp theo profiles.class_key
-- 4. Tự động gỡ ghi danh lớp cũ khi sinh viên đã chuyển sang lớp mới trên CIS

CREATE OR REPLACE FUNCTION private.sync_classes_from_system()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_created integer := 0;
BEGIN
  IF (SELECT auth.uid()) IS NOT NULL
     AND COALESCE(private.user_role(), '') NOT IN ('teacher', 'admin') THEN
    RAISE EXCEPTION 'Không có quyền đồng bộ lớp học';
  END IF;

  -- 1. Tạo các lớp còn thiếu từ hồ sơ sinh viên & thời khóa biểu
  WITH src AS (
    SELECT DISTINCT ON (k)
      COALESCE(NULLIF(regexp_replace(btrim(class_name), '\s+', ' ', 'g'), ''), k) AS cname,
      k AS ckey
    FROM (
      SELECT class_name,
             COALESCE(NULLIF(btrim(class_key), ''), private.normalize_class_key(class_name)) AS k
      FROM public.profiles
      WHERE role = 'student'
        AND COALESCE(NULLIF(btrim(class_key), ''), private.normalize_class_key(class_name)) IS NOT NULL
      UNION ALL
      SELECT class_name,
             COALESCE(NULLIF(btrim(class_key), ''), private.normalize_class_key(class_name)) AS k
      FROM public.timetable_entries
      WHERE COALESCE(NULLIF(btrim(class_key), ''), private.normalize_class_key(class_name)) IS NOT NULL
    ) merged
    ORDER BY k, cname
  ),
  ins AS (
    INSERT INTO public.classes (name, class_key)
    SELECT s.cname, s.ckey
    FROM src s
    ON CONFLICT (class_key) DO NOTHING
    RETURNING 1
  )
  SELECT count(*) INTO v_created FROM ins;

  -- 2. Tự động điền ngành học (subject) cho các lớp đang trống dựa theo ngành phổ biến nhất từ CIS
  WITH dominant_major AS (
    SELECT DISTINCT ON (ckey)
      ckey,
      major_val
    FROM (
      SELECT
        COALESCE(NULLIF(btrim(p.class_key), ''), private.normalize_class_key(p.class_name)) AS ckey,
        btrim(p.major) AS major_val,
        count(*) AS cnt
      FROM public.profiles p
      WHERE p.role = 'student'
        AND p.major IS NOT NULL
        AND btrim(p.major) <> ''
        AND COALESCE(NULLIF(btrim(p.class_key), ''), private.normalize_class_key(p.class_name)) IS NOT NULL
      GROUP BY 1, 2
    ) agg
    ORDER BY ckey, cnt DESC, major_val ASC
  )
  UPDATE public.classes c
  SET subject = dm.major_val
  FROM dominant_major dm
  WHERE c.class_key = dm.ckey
    AND (c.subject IS NULL OR btrim(c.subject) = '');

  -- 3. Ghi danh sinh viên vào đúng lớp theo hồ sơ CIS
  INSERT INTO public.enrollments (class_id, student_id)
  SELECT c.id, p.id
  FROM public.profiles p
  JOIN public.classes c
    ON c.class_key = COALESCE(NULLIF(btrim(p.class_key), ''), private.normalize_class_key(p.class_name))
  WHERE p.role = 'student'
  ON CONFLICT (class_id, student_id) DO NOTHING;

  -- 4. Gỡ ghi danh lớp hành chính cũ nếu sinh viên đã chuyển lớp trên CIS
  DELETE FROM public.enrollments e
  USING public.profiles p, public.classes c
  WHERE e.student_id = p.id
    AND e.class_id = c.id
    AND p.role = 'student'
    AND p.class_key IS NOT NULL
    AND btrim(p.class_key) <> ''
    AND c.class_key IS NOT NULL
    AND btrim(c.class_key) <> ''
    AND c.class_key IS DISTINCT FROM p.class_key;

  RETURN COALESCE(v_created, 0);
END
$$;

-- Chạy đồng bộ ngay sau khi cập nhật hàm
SELECT private.sync_classes_from_system();

