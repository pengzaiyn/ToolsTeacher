-- Bổ sung hình thức làm bài (Làm cá nhân / Làm theo nhóm) cho bảng public.assignments
alter table public.assignments
  add column if not exists work_mode text not null default 'individual';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.assignments'::regclass
      and conname = 'assignments_work_mode_check'
  ) then
    alter table public.assignments
      add constraint assignments_work_mode_check
      check (work_mode in ('individual', 'group'));
  end if;
end;
$$;

