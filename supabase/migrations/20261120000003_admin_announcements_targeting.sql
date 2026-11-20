-- Mở rộng bảng announcements hỗ trợ thông báo toàn trường, riêng lớp, toàn bộ giáo viên hoặc riêng 1 giáo viên

alter table public.announcements
  add column if not exists target_type text not null default 'all',
  add column if not exists target_user_id uuid references public.profiles(id) on delete cascade;

-- Đồng bộ dữ liệu cũ: bản ghi có class_id sẽ mang target_type = 'class'
update public.announcements
set target_type = 'class'
where class_id is not null
  and target_type = 'all';

alter table public.announcements
  drop constraint if exists announcements_target_type_check;

alter table public.announcements
  add constraint announcements_target_type_check
  check (target_type in ('all', 'class', 'all_teachers', 'teacher'));

alter table public.announcements
  drop constraint if exists announcements_target_consistency;

alter table public.announcements
  add constraint announcements_target_consistency
  check (
    (target_type = 'all' and class_id is null and target_user_id is null)
    or (target_type = 'class' and class_id is not null and target_user_id is null)
    or (target_type = 'all_teachers' and class_id is null and target_user_id is null)
    or (target_type = 'teacher' and class_id is null and target_user_id is not null)
  );

create index if not exists announcements_target_user_id_idx
  on public.announcements (target_user_id);

create index if not exists announcements_target_type_created_at_idx
  on public.announcements (target_type, created_at desc);

-- Cập nhật RLS cho announcements
drop policy if exists announcements_select on public.announcements;
create policy announcements_select
on public.announcements
for select
to authenticated
using (
  private.is_admin()
  or target_type = 'all'
  or (target_type = 'class' and class_id is not null and private.can_see_class(class_id))
  or (target_type = 'all_teachers' and private.user_role() = 'teacher')
  or (target_type = 'teacher' and target_user_id = (select auth.uid()))
);

drop policy if exists announcements_insert on public.announcements;
create policy announcements_insert
on public.announcements
for insert
to authenticated
with check (
  created_by = (select auth.uid())
  and (
    private.is_admin()
    or (target_type = 'class' and class_id is not null and private.is_class_teacher(class_id))
  )
);

drop policy if exists announcements_update on public.announcements;
create policy announcements_update
on public.announcements
for update
to authenticated
using (
  private.is_admin()
  or (target_type = 'class' and class_id is not null and private.is_class_teacher(class_id))
)
with check (
  private.is_admin()
  or (target_type = 'class' and class_id is not null and private.is_class_teacher(class_id))
);

drop policy if exists announcements_delete on public.announcements;
create policy announcements_delete
on public.announcements
for delete
to authenticated
using (
  private.is_admin()
  or (target_type = 'class' and class_id is not null and private.is_class_teacher(class_id))
);

