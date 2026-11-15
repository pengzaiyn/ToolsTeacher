-- Danh sách tài khoản giảng viên / cán bộ thật đang hoạt động cho trang Lịch dạy cá nhân.

CREATE OR REPLACE FUNCTION private.list_timetable_teacher_accounts()
 RETURNS TABLE(id uuid, full_name text, role text, subject text)
 LANGUAGE plpgsql
 STABLE
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if (select auth.uid()) is null or coalesce(private.user_role(), '') not in ('teacher', 'admin') then
    raise exception 'Bạn không có quyền xem danh sách tài khoản giảng viên';
  end if;

  return query
  select p.id, p.full_name, p.role, p.subject
  from public.profiles p
  where p.is_active = true
    and p.role in ('teacher', 'admin')
  order by
    case when p.role = 'teacher' then 0 else 1 end,
    p.full_name asc;
end
$function$;

REVOKE ALL ON FUNCTION private.list_timetable_teacher_accounts() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.list_timetable_teacher_accounts() TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.timetable_teacher_accounts()
 RETURNS TABLE(id uuid, full_name text, role text, subject text)
 LANGUAGE plpgsql
 STABLE
 SET search_path TO ''
AS $function$
begin
  if (select auth.uid()) is null or coalesce(private.user_role(), '') not in ('teacher', 'admin') then
    raise exception 'Bạn không có quyền xem danh sách tài khoản giảng viên';
  end if;

  return query
  select t.id, t.full_name, t.role, t.subject
  from private.list_timetable_teacher_accounts() t;
end
$function$;

REVOKE ALL ON FUNCTION public.timetable_teacher_accounts() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.timetable_teacher_accounts() TO authenticated, service_role;

