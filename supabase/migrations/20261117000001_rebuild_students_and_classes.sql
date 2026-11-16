-- Cập nhật schema profiles để hỗ trợ đầy đủ dữ liệu sinh viên thực tế của trường:
-- 1. Nới lỏng định dạng mã sinh viên (5111..., 6111..., 8111..., 9111..., N811..., N812..., 9-13 ký tự)
-- 2. Thêm các trường Hệ đào tạo, Ngành đào tạo, Khóa, Khóa ban đầu, Trạng thái học tập, Lý do, Ghi chú
-- 3. Bảo vệ các trường mới trong protect_profile() và bỏ qua lớp ảo ("Chưa phân lớp", "CHỜ") trong sync_profile_class()

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_student_code_format;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_student_code_format
  CHECK (student_code IS NULL OR student_code ~ '^[A-Za-z0-9]{6,20}$');

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS education_system text,
  ADD COLUMN IF NOT EXISTS major text,
  ADD COLUMN IF NOT EXISTS cohort text,
  ADD COLUMN IF NOT EXISTS initial_cohort text,
  ADD COLUMN IF NOT EXISTS academic_status text,
  ADD COLUMN IF NOT EXISTS status_reason text,
  ADD COLUMN IF NOT EXISTS status_note text;

CREATE INDEX IF NOT EXISTS idx_profiles_academic_status
  ON public.profiles (academic_status)
  WHERE role = 'student';

CREATE INDEX IF NOT EXISTS idx_profiles_cohort
  ON public.profiles (cohort)
  WHERE role = 'student';

CREATE OR REPLACE FUNCTION private.protect_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
begin
  if (select auth.uid()) is not null and not private.is_admin() then
    if new.id is distinct from old.id
       or new.email is distinct from old.email
       or new.role is distinct from old.role
       or new.student_code is distinct from old.student_code
       or new.subject is distinct from old.subject
       or new.is_active is distinct from old.is_active
       or new.gender is distinct from old.gender
       or new.date_of_birth is distinct from old.date_of_birth
       or new.admissions_advisor is distinct from old.admissions_advisor
       or new.class_name is distinct from old.class_name
       or new.class_key is distinct from old.class_key
       or new.education_system is distinct from old.education_system
       or new.major is distinct from old.major
       or new.cohort is distinct from old.cohort
       or new.initial_cohort is distinct from old.initial_cohort
       or new.academic_status is distinct from old.academic_status
       or new.status_reason is distinct from old.status_reason
       or new.status_note is distinct from old.status_note then
      raise exception 'Bạn không có quyền thay đổi các trường này';
    end if;
  end if;
  return new;
end
$function$;

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

    -- Bỏ qua các nhãn giữ chỗ, không tạo lớp học thật
    if v_key is not null and v_key not in ('chưa phân lớp', 'chờ', '---') then
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

