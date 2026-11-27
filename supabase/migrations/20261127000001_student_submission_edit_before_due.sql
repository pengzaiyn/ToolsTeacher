-- Cho phép sinh viên chỉnh sửa, nộp lại hoặc hủy/xóa bài nộp khi chưa quá hạn (due_date)
-- Khi đã quá hạn nộp bài do giảng viên cài đặt, khóa hoàn toàn quyền nộp mới / sửa / xóa của sinh viên ở tầng RLS & Trigger.

create or replace function private.is_assignment_open(aid uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.assignments a
    where a.id = aid
      and (a.due_date is null or a.due_date > now())
  );
$$;

revoke execute on function private.is_assignment_open(uuid) from public, anon;
grant execute on function private.is_assignment_open(uuid) to authenticated, service_role;

create or replace function private.handle_student_submission_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if private.is_admin() or private.is_class_teacher(private.class_of_assignment(old.assignment_id)) then
    return new;
  end if;

  if old.student_id is distinct from (select auth.uid()) then
    raise exception 'Bạn không có quyền chỉnh sửa bài nộp này.';
  end if;

  if old.assignment_id is distinct from new.assignment_id
     or old.student_id is distinct from new.student_id then
    raise exception 'Không được thay đổi thông tin định danh của bài nộp.';
  end if;

  if not private.is_assignment_open(old.assignment_id) then
    raise exception 'Đã hết thời gian nộp bài, không thể chỉnh sửa hoặc nộp lại.';
  end if;

  new.status := 'pending';
  new.submitted_at := now();

  update public.grades
  set score = null,
      feedback = null,
      graded_by = null,
      graded_at = null,
      ai_score = null,
      ai_feedback = null,
      is_ai = false
  where submission_id = old.id;

  return new;
end;
$$;

revoke execute on function private.handle_student_submission_update() from public, anon;
grant execute on function private.handle_student_submission_update() to authenticated, service_role;

create or replace trigger trg_student_submission_update
before update on public.submissions
for each row
execute function private.handle_student_submission_update();

alter policy submissions_insert on public.submissions
with check (
  student_id = (select auth.uid())
  and status = 'pending'
  and private.is_class_student(private.class_of_assignment(assignment_id))
  and private.is_assignment_open(assignment_id)
);

alter policy submissions_update on public.submissions
using (
  private.is_class_teacher(private.class_of_assignment(assignment_id))
  or (
    student_id = (select auth.uid())
    and private.is_assignment_open(assignment_id)
  )
)
with check (
  private.is_class_teacher(private.class_of_assignment(assignment_id))
  or (
    student_id = (select auth.uid())
    and status = 'pending'
    and private.is_class_student(private.class_of_assignment(assignment_id))
    and private.is_assignment_open(assignment_id)
  )
);

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'submissions' and policyname = 'submissions_delete'
  ) then
    create policy submissions_delete
    on public.submissions
    for delete
    to authenticated
    using (
      private.is_class_teacher(private.class_of_assignment(assignment_id))
      or (
        student_id = (select auth.uid())
        and private.is_assignment_open(assignment_id)
      )
    );
  else
    alter policy submissions_delete on public.submissions
    using (
      private.is_class_teacher(private.class_of_assignment(assignment_id))
      or (
        student_id = (select auth.uid())
        and private.is_assignment_open(assignment_id)
      )
    );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects' and policyname = 'submissions_remove'
  ) then
    create policy submissions_remove
    on storage.objects
    for delete
    to authenticated
    using (
      bucket_id = 'submissions'
      and (
        (storage.foldername(name))[2] = ((select auth.uid()))::text
        or private.is_class_teacher(((storage.foldername(name))[1])::uuid)
        or private.is_admin()
      )
    );
  else
    alter policy submissions_remove on storage.objects
    using (
      bucket_id = 'submissions'
      and (
        (storage.foldername(name))[2] = ((select auth.uid()))::text
        or private.is_class_teacher(((storage.foldername(name))[1])::uuid)
        or private.is_admin()
      )
    );
  end if;
end;
$$;
