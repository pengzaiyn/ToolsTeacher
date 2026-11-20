-- Nâng cấp bảng timetable_entries và hàm replace_timetable theo đúng mẫu Thời khóa biểu Phòng Đào tạo (7 kỳ học: HK1..HK4, HK5+6+7).

ALTER TABLE public.timetable_entries
  ADD COLUMN IF NOT EXISTS semester text,
  ADD COLUMN IF NOT EXISTS semester_order smallint,
  ADD COLUMN IF NOT EXISTS academic_year text,
  ADD COLUMN IF NOT EXISTS time_range text,
  ADD COLUMN IF NOT EXISTS exam_date date,
  ADD COLUMN IF NOT EXISTS total_periods smallint,
  ADD COLUMN IF NOT EXISTS periods_per_session smallint,
  ADD COLUMN IF NOT EXISTS credits numeric(4,1),
  ADD COLUMN IF NOT EXISTS is_internship boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS timetable_entries_class_semester_idx
  ON public.timetable_entries (class_key, semester_order, weekday, period_start);

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

  insert into public.timetable_entries (
    upload_id,
    class_name,
    class_key,
    weekday,
    period_start,
    period_end,
    subject,
    teacher_name,
    teacher_key,
    room,
    note,
    date_from,
    date_to,
    semester,
    semester_order,
    academic_year,
    time_range,
    exam_date,
    total_periods,
    periods_per_session,
    credits,
    is_internship
  )
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
    nullif(e ->> 'date_to', '')::date,
    nullif(e ->> 'semester', ''),
    nullif(e ->> 'semester_order', '')::smallint,
    nullif(e ->> 'academic_year', ''),
    nullif(e ->> 'time_range', ''),
    nullif(e ->> 'exam_date', '')::date,
    nullif(e ->> 'total_periods', '')::smallint,
    nullif(e ->> 'periods_per_session', '')::smallint,
    nullif(e ->> 'credits', '')::numeric(4,1),
    coalesce((e ->> 'is_internship')::boolean, false)
  from jsonb_array_elements(p_entries) e;

  get diagnostics v_count = row_count;

  perform private.sync_classes_from_system();

  return v_count;
end
$function$;

