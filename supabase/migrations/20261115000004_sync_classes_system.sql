-- Đồng bộ 2 chiều giữa Lớp học (classes / enrollments), Sinh viên (profiles)
-- và Thời khóa biểu (timetable_entries).
-- Chạy file này trong Supabase Dashboard -> SQL Editor.

CREATE OR REPLACE FUNCTION private.normalize_class_key(val text)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO ''
AS $function$
  select nullif(lower(regexp_replace(btrim(normalize(coalesce(val, ''), NFC)), '\s+', ' ', 'g')), '')
$function$;

ALTER TABLE public.classes
  ADD COLUMN IF NOT EXISTS class_key text;

UPDATE public.classes
SET name = regexp_replace(btrim(name), '\s+', ' ', 'g'),
    class_key = private.normalize_class_key(name)
WHERE class_key IS DISTINCT FROM private.normalize_class_key(name)
   OR name IS DISTINCT FROM regexp_replace(btrim(name), '\s+', ' ', 'g');

CREATE UNIQUE INDEX IF NOT EXISTS classes_class_key_uidx
  ON public.classes (class_key);

CREATE OR REPLACE FUNCTION private.classes_set_key()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
begin
  new.name := nullif(regexp_replace(btrim(coalesce(new.name, '')), '\s+', ' ', 'g'), '');
  if new.name is null then
    raise exception 'Tên lớp học không được để trống';
  end if;
  new.class_key := private.normalize_class_key(new.name);
  return new;
end
$function$;

DROP TRIGGER IF EXISTS classes_before_set_key ON public.classes;
CREATE TRIGGER classes_before_set_key
  BEFORE INSERT OR UPDATE OF name ON public.classes
  FOR EACH ROW
  EXECUTE FUNCTION private.classes_set_key();

CREATE OR REPLACE FUNCTION private.sync_class_after_write()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if pg_trigger_depth() <= 1 and tg_op = 'UPDATE' and old.class_key is not null then
    if old.name is distinct from new.name then
      update public.profiles
      set class_name = new.name,
          class_key = new.class_key
      where role = 'student'
        and class_key = old.class_key;

      update public.timetable_entries
      set class_name = new.name,
          class_key = new.class_key
      where class_key = old.class_key;
    end if;
  end if;

  if new.class_key is not null then
    insert into public.enrollments (class_id, student_id)
    select new.id, p.id
    from public.profiles p
    where p.role = 'student'
      and p.class_key = new.class_key
    on conflict (class_id, student_id) do nothing;
  end if;

  return new;
end
$function$;

DROP TRIGGER IF EXISTS classes_after_sync ON public.classes;
CREATE TRIGGER classes_after_sync
  AFTER INSERT OR UPDATE OF name, class_key ON public.classes
  FOR EACH ROW
  EXECUTE FUNCTION private.sync_class_after_write();

CREATE OR REPLACE FUNCTION private.sync_profile_class()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_key text;
  v_name text;
begin
  if pg_trigger_depth() > 1 then
    return new;
  end if;

  if tg_op = 'UPDATE' and old.class_key is not null and (
    new.role <> 'student' or old.class_key is distinct from new.class_key
  ) then
    delete from public.enrollments e
    using public.classes c
    where e.class_id = c.id
      and e.student_id = new.id
      and c.class_key = old.class_key;
  end if;

  if new.role = 'student' then
    v_name := nullif(regexp_replace(btrim(coalesce(new.class_name, '')), '\s+', ' ', 'g'), '');
    v_key := coalesce(private.normalize_class_key(v_name), nullif(btrim(coalesce(new.class_key, '')), ''));

    if v_key is not null then
      insert into public.classes (name, class_key)
      values (coalesce(v_name, v_key), v_key)
      on conflict (class_key) do nothing;

      insert into public.enrollments (class_id, student_id)
      select c.id, new.id
      from public.classes c
      where c.class_key = v_key
      on conflict (class_id, student_id) do nothing;
    end if;
  end if;

  return new;
end
$function$;

DROP TRIGGER IF EXISTS profiles_after_sync_class ON public.profiles;
CREATE TRIGGER profiles_after_sync_class
  AFTER INSERT OR UPDATE OF class_name, class_key, role ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION private.sync_profile_class();

CREATE OR REPLACE FUNCTION private.sync_classes_from_system()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_created integer := 0;
begin
  if (select auth.uid()) is not null and coalesce(private.user_role(), '') not in ('teacher', 'admin') then
    raise exception 'Không có quyền đồng bộ lớp học';
  end if;

  with src as (
    select distinct on (k)
      coalesce(nullif(regexp_replace(btrim(class_name), '\s+', ' ', 'g'), ''), k) as cname,
      k as ckey
    from (
      select class_name, coalesce(nullif(btrim(class_key), ''), private.normalize_class_key(class_name)) as k
      from public.profiles
      where role = 'student'
        and coalesce(nullif(btrim(class_key), ''), private.normalize_class_key(class_name)) is not null
      union all
      select class_name, coalesce(nullif(btrim(class_key), ''), private.normalize_class_key(class_name)) as k
      from public.timetable_entries
      where coalesce(nullif(btrim(class_key), ''), private.normalize_class_key(class_name)) is not null
    ) merged
    order by k, cname
  ),
  ins as (
    insert into public.classes (name, class_key)
    select s.cname, s.ckey
    from src s
    on conflict (class_key) do nothing
    returning 1
  )
  select count(*) into v_created from ins;

  insert into public.enrollments (class_id, student_id)
  select c.id, p.id
  from public.profiles p
  join public.classes c
    on c.class_key = coalesce(nullif(btrim(p.class_key), ''), private.normalize_class_key(p.class_name))
  where p.role = 'student'
  on conflict (class_id, student_id) do nothing;

  return coalesce(v_created, 0);
end
$function$;

CREATE OR REPLACE FUNCTION public.sync_system_classes()
 RETURNS integer
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
begin
  if not private.is_admin() then
    raise exception 'Chỉ hiệu trưởng mới có quyền đồng bộ lớp học';
  end if;
  return private.sync_classes_from_system();
end
$function$;

REVOKE ALL ON FUNCTION public.sync_system_classes() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.sync_system_classes() TO authenticated;

CREATE OR REPLACE FUNCTION public.replace_timetable(p_file_name text, p_entries jsonb)
 RETURNS integer
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare
  v_upload uuid;
  v_count integer;
begin
  if private.user_role() not in ('teacher', 'admin') then
    raise exception 'Bạn không có quyền tải thời khóa biểu';
  end if;
  if jsonb_typeof(p_entries) <> 'array' or jsonb_array_length(p_entries) = 0 then
    raise exception 'Dữ liệu thời khóa biểu trống';
  end if;
  if jsonb_array_length(p_entries) > 5000 then
    raise exception 'File có quá nhiều dòng (tối đa 5000)';
  end if;

  insert into public.timetable_uploads (file_name, uploaded_by)
  values (p_file_name, (select auth.uid()))
  returning id into v_upload;

  delete from public.timetable_entries
  where class_key in (select distinct e ->> 'class_key' from jsonb_array_elements(p_entries) e);

  insert into public.timetable_entries
    (upload_id, class_name, class_key, weekday, period_start, period_end, subject, teacher_name, teacher_key, room, note, date_from, date_to)
  select
    v_upload,
    e ->> 'class_name',
    e ->> 'class_key',
    (e ->> 'weekday')::smallint,
    (e ->> 'period_start')::smallint,
    (e ->> 'period_end')::smallint,
    e ->> 'subject',
    nullif(e ->> 'teacher_name', ''),
    nullif(e ->> 'teacher_key', ''),
    nullif(e ->> 'room', ''),
    nullif(e ->> 'note', ''),
    nullif(e ->> 'date_from', '')::date,
    nullif(e ->> 'date_to', '')::date
  from jsonb_array_elements(p_entries) e;

  get diagnostics v_count = row_count;

  perform private.sync_classes_from_system();

  return v_count;
end
$function$;

SELECT private.sync_classes_from_system();
