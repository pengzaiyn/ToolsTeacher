-- Bổ sung dữ liệu chia nhóm + trưởng nhóm (assignments.groups) và điểm riêng từng thành viên (grades.member_scores)
-- Chỉ Trưởng nhóm mới được nộp/sửa/hủy bài tập nhóm; các thành viên cùng nhóm được xem bài nộp & điểm của nhóm mình.

alter table public.assignments
  add column if not exists groups jsonb not null default '[]'::jsonb;

alter table public.grades
  add column if not exists member_scores jsonb not null default '{}'::jsonb;

create or replace function private.is_student_allowed_to_submit(aid uuid, uid uuid)
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
      and (
        coalesce(a.work_mode, 'individual') <> 'group'
        or exists (
          select 1
          from jsonb_array_elements(
            case
              when jsonb_typeof(a.groups) = 'array' then a.groups
              else '[]'::jsonb
            end
          ) g
          where g ->> 'leader_id' = uid::text
        )
      )
  );
$$;

revoke execute on function private.is_student_allowed_to_submit(uuid, uuid) from public, anon;
grant execute on function private.is_student_allowed_to_submit(uuid, uuid) to authenticated, service_role;

create or replace function private.is_teammate_of_submission(aid uuid, submitter_id uuid, viewer_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.assignments a,
         jsonb_array_elements(
           case
             when jsonb_typeof(a.groups) = 'array' then a.groups
             else '[]'::jsonb
           end
         ) g
    where a.id = aid
      and a.work_mode = 'group'
      and g ->> 'leader_id' = submitter_id::text
      and exists (
        select 1
        from jsonb_array_elements(
          case
            when jsonb_typeof(g -> 'members') = 'array' then g -> 'members'
            else '[]'::jsonb
          end
        ) m
        where m ->> 'student_id' = viewer_id::text
      )
  );
$$;

revoke execute on function private.is_teammate_of_submission(uuid, uuid, uuid) from public, anon;
grant execute on function private.is_teammate_of_submission(uuid, uuid, uuid) to authenticated, service_role;

create or replace function private.is_own_graded_submission(sid uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.submissions s
    where s.id = sid
      and s.status = 'graded'
      and (
        s.student_id = (select auth.uid())
        or private.is_teammate_of_submission(s.assignment_id, s.student_id, (select auth.uid()))
      )
  );
$$;

revoke execute on function private.is_own_graded_submission(uuid) from public, anon;
grant execute on function private.is_own_graded_submission(uuid) to authenticated, service_role;

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

  if not private.is_student_allowed_to_submit(old.assignment_id, (select auth.uid())) then
    raise exception 'Chỉ Trưởng nhóm mới có quyền nộp hoặc chỉnh sửa bài tập nhóm.';
  end if;

  if not private.is_assignment_open(old.assignment_id) then
    raise exception 'Đã hết thời gian nộp bài, không thể chỉnh sửa hoặc nộp lại.';
  end if;

  new.status := 'pending';
  new.submitted_at := now();

  update public.grades
  set score = null,
      member_scores = '{}'::jsonb,
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

alter policy submissions_select on public.submissions
using (
  student_id = (select auth.uid())
  or private.is_teammate_of_submission(assignment_id, student_id, (select auth.uid()))
  or private.is_admin()
  or private.is_class_teacher(private.class_of_assignment(assignment_id))
);

alter policy submissions_insert on public.submissions
with check (
  student_id = (select auth.uid())
  and status = 'pending'
  and private.is_class_student(private.class_of_assignment(assignment_id))
  and private.is_assignment_open(assignment_id)
  and private.is_student_allowed_to_submit(assignment_id, (select auth.uid()))
);

alter policy submissions_update on public.submissions
using (
  private.is_class_teacher(private.class_of_assignment(assignment_id))
  or (
    student_id = (select auth.uid())
    and private.is_assignment_open(assignment_id)
    and private.is_student_allowed_to_submit(assignment_id, (select auth.uid()))
  )
)
with check (
  private.is_class_teacher(private.class_of_assignment(assignment_id))
  or (
    student_id = (select auth.uid())
    and status = 'pending'
    and private.is_class_student(private.class_of_assignment(assignment_id))
    and private.is_assignment_open(assignment_id)
    and private.is_student_allowed_to_submit(assignment_id, (select auth.uid()))
  )
);

alter policy submissions_delete on public.submissions
using (
  private.is_class_teacher(private.class_of_assignment(assignment_id))
  or (
    student_id = (select auth.uid())
    and private.is_assignment_open(assignment_id)
    and private.is_student_allowed_to_submit(assignment_id, (select auth.uid()))
  )
);

alter policy submissions_read on storage.objects
using (
  bucket_id = 'submissions'
  and (
    (storage.foldername(name))[2] = ((select auth.uid()))::text
    or private.is_class_teacher(((storage.foldername(name))[1])::uuid)
    or private.is_admin()
    or (
      private.is_class_student(((storage.foldername(name))[1])::uuid)
      and exists (
        select 1
        from public.submissions s
        where s.file_url = name
          and private.is_teammate_of_submission(s.assignment_id, s.student_id, (select auth.uid()))
      )
    )
  )
);

