-- Cho phép cả Hiệu trưởng (private.is_admin()) lẫn Edge Function Cron ban đêm (service_role)
-- gọi public.sync_system_classes() để tự động tạo lớp mới và xếp lớp sinh viên lúc 02:00 sáng.

CREATE OR REPLACE FUNCTION public.sync_system_classes()
RETURNS integer
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF (SELECT auth.role()) IS DISTINCT FROM 'service_role' AND NOT private.is_admin() THEN
    RAISE EXCEPTION 'Chỉ hiệu trưởng hoặc tiến trình đồng bộ tự động mới có quyền đồng bộ lớp học';
  END IF;
  RETURN private.sync_classes_from_system();
END;
$$;

