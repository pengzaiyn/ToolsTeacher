-- Hàm RPC đếm nhanh sĩ số sinh viên đang học theo từng lớp (tránh tải hàng nghìn dòng enrollments về frontend).

CREATE OR REPLACE FUNCTION private.list_class_active_student_counts()
 RETURNS TABLE(class_id uuid, student_count integer)
 LANGUAGE plpgsql
 STABLE
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if (select auth.uid()) is null or coalesce(private.user_role(), '') not in ('teacher', 'admin') then
    raise exception 'Bạn không có quyền xem sĩ số lớp học';
  end if;

  return query
  select
    e.class_id,
    count(*)::integer as student_count
  from public.enrollments e
  join public.profiles p on p.id = e.student_id
  where p.role = 'student'
    and coalesce(lower(btrim(p.academic_status)), '') not like '%thôi học%'
    and coalesce(lower(btrim(p.academic_status)), '') not like '%bỏ học%'
    and coalesce(lower(btrim(p.academic_status)), '') not like '%nghỉ học%'
    and coalesce(lower(btrim(p.academic_status)), '') not like '%đã nghỉ%'
  group by e.class_id;
end
$function$;

REVOKE ALL ON FUNCTION private.list_class_active_student_counts() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.list_class_active_student_counts() TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.class_active_student_counts()
 RETURNS TABLE(class_id uuid, student_count integer)
 LANGUAGE plpgsql
 STABLE
 SET search_path TO ''
AS $function$
begin
  if (select auth.uid()) is null or coalesce(private.user_role(), '') not in ('teacher', 'admin') then
    raise exception 'Bạn không có quyền xem sĩ số lớp học';
  end if;

  return query
  select c.class_id, c.student_count
  from private.list_class_active_student_counts() c;
end
$function$;

REVOKE ALL ON FUNCTION public.class_active_student_counts() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.class_active_student_counts() TO authenticated, service_role;

