-- Bổ sung đầy đủ các trường hồ sơ sinh viên từ API CIS (Cao đẳng Việt Mỹ Hà Nội)
-- và bảng lưu trạng thái đồng bộ tăng dần (updated_since).

alter table public.profiles
  add column if not exists phone text,
  add column if not exists cccd text,
  add column if not exists cccd_issued_date text,
  add column if not exists place_of_birth text,
  add column if not exists faculty text,
  add column if not exists cis_updated_at timestamptz;

create index if not exists profiles_student_code_lower_idx
  on public.profiles (lower(btrim(student_code)))
  where student_code is not null;

-- Cập nhật trigger bảo vệ hồ sơ: chỉ hiệu trưởng / hệ thống đồng bộ mới được sửa các trường CIS
create or replace function private.protect_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
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
       or new.status_note is distinct from old.status_note
       or new.phone is distinct from old.phone
       or new.cccd is distinct from old.cccd
       or new.cccd_issued_date is distinct from old.cccd_issued_date
       or new.place_of_birth is distinct from old.place_of_birth
       or new.faculty is distinct from old.faculty
       or new.cis_updated_at is distinct from old.cis_updated_at then
      raise exception 'Bạn không có quyền thay đổi các trường này';
    end if;
  end if;
  return new;
end;
$$;

-- Bảng lưu mốc đồng bộ CIS (1 dòng duy nhất id = 1, chỉ Hiệu trưởng truy cập)
create table if not exists public.cis_sync_state (
  id integer primary key default 1 check (id = 1),
  last_synced_at timestamptz,
  last_updated_since text,
  last_status text,
  last_summary jsonb,
  updated_by uuid references public.profiles(id) on delete set null
);

create index if not exists cis_sync_state_updated_by_idx
  on public.cis_sync_state (updated_by);

alter table public.cis_sync_state enable row level security;

revoke all on table public.cis_sync_state from anon;
grant select, insert, update on table public.cis_sync_state to authenticated;

drop policy if exists "cis_sync_state_admin_all" on public.cis_sync_state;
create policy "cis_sync_state_admin_all"
  on public.cis_sync_state
  for all
  to authenticated
  using (private.is_admin())
  with check (private.is_admin());

