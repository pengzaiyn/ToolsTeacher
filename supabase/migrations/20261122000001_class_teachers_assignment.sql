-- Bảng phân công giáo viên bộ môn theo từng lớp (mỗi lớp có 1 GV chủ nhiệm ở classes.teacher_id và nhiều GV bộ môn ở class_teachers)

create table if not exists public.class_teachers (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes(id) on delete cascade,
  teacher_id uuid not null references public.profiles(id) on delete cascade,
  subject_name text,
  created_at timestamptz not null default now(),
  constraint class_teachers_class_teacher_unique unique (class_id, teacher_id)
);

create index if not exists class_teachers_class_id_idx
  on public.class_teachers (class_id);

create index if not exists class_teachers_teacher_id_idx
  on public.class_teachers (teacher_id);

-- Cập nhật hàm kiểm tra quyền giáo viên lớp: bao gồm cả GV chủ nhiệm (classes.teacher_id) và GV bộ môn (class_teachers)
create or replace function private.is_class_teacher(cid uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    private.is_admin()
    or (
      private.user_role() = 'teacher'
      and (
        exists (
          select 1
          from public.classes c
          where c.id = cid
            and c.teacher_id = (select auth.uid())
        )
        or exists (
          select 1
          from public.class_teachers ct
          where ct.class_id = cid
            and ct.teacher_id = (select auth.uid())
        )
      )
    )
$$;

alter table public.class_teachers enable row level security;

drop policy if exists class_teachers_select on public.class_teachers;
create policy class_teachers_select
on public.class_teachers
for select
to authenticated
using (
  private.is_admin()
  or teacher_id = (select auth.uid())
  or private.can_see_class(class_id)
);

drop policy if exists class_teachers_insert on public.class_teachers;
create policy class_teachers_insert
on public.class_teachers
for insert
to authenticated
with check (private.is_admin());

drop policy if exists class_teachers_update on public.class_teachers;
create policy class_teachers_update
on public.class_teachers
for update
to authenticated
using (private.is_admin())
with check (private.is_admin());

drop policy if exists class_teachers_delete on public.class_teachers;
create policy class_teachers_delete
on public.class_teachers
for delete
to authenticated
using (private.is_admin());

-- Bật realtime cho bảng class_teachers
do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'class_teachers'
  ) then
    alter publication supabase_realtime add table public.class_teachers;
  end if;
end $$;
