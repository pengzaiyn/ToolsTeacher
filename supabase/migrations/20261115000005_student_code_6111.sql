-- Cấp mã sinh viên 11 chữ số theo quy tắc trường:
-- "6111" + 2 số cuối năm hiện tại (giờ Việt Nam) + 5 số thứ tự tăng dần (VD: 61112600002).
CREATE OR REPLACE FUNCTION public.next_student_code()
RETURNS text
LANGUAGE sql
SET search_path TO ''
AS $$
  SELECT '6111'
    || to_char(now() AT TIME ZONE 'Asia/Ho_Chi_Minh', 'YY')
    || lpad(nextval('public.student_code_seq')::text, 5, '0');
$$;

REVOKE ALL ON FUNCTION public.next_student_code() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.next_student_code() TO service_role;

