-- Cho phép Hiệu trưởng (admin) quản lý thông báo lớp, tài liệu (kể cả Storage),
-- bài tập, đáp án và chấm điểm trong mọi lớp học (bao gồm lớp chưa có giáo viên).
-- Chạy file này trong Supabase Dashboard -> SQL Editor nếu chưa áp dụng được qua MCP.

CREATE OR REPLACE FUNCTION private.is_class_teacher(cid uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select exists (
    select 1
    from public.classes c
    where c.id = cid
      and (
        private.is_admin()
        or (c.teacher_id = (select auth.uid()) and private.user_role() = 'teacher')
      )
  )
$function$;

