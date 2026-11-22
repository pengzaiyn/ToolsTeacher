-- Đấu trường Leo Tháp HSK (Tiếng Trung) + Hệ thống Đề xuất Trò chơi theo ngành gửi Hiệu trưởng

create table if not exists public.hsk_rooms (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  title text not null,
  host_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'waiting' check (status in ('waiting', 'playing', 'finished')),
  input_mode text not null default 'pinyin' check (input_mode in ('pinyin', 'hanzi')),
  theme text not null default 'lantern' check (theme in ('lantern', 'bamboo', 'great_wall')),
  topic text not null default 'all',
  target_steps int not null default 10 check (target_steps between 5 and 25),
  time_limit_sec int not null default 180 check (time_limit_sec between 30 and 900),
  max_players int not null default 5 check (max_players between 2 and 5),
  words jsonb not null default '[]'::jsonb,
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists hsk_rooms_host_id_idx
  on public.hsk_rooms (host_id);

create index if not exists hsk_rooms_status_created_idx
  on public.hsk_rooms (status, created_at desc);

create table if not exists public.hsk_room_players (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.hsk_rooms(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  display_name text not null,
  avatar_id text not null default 'panda',
  vote_mode text check (vote_mode in ('pinyin', 'hanzi')),
  step int not null default 0,
  score int not null default 0,
  combo int not null default 0,
  wrong_count int not null default 0,
  reward_points numeric(4,2) not null default 0,
  finished_at timestamptz,
  joined_at timestamptz not null default now(),
  constraint hsk_room_players_unique unique (room_id, user_id)
);

create index if not exists hsk_room_players_room_id_idx
  on public.hsk_room_players (room_id, step desc, score desc);

create index if not exists hsk_room_players_user_id_idx
  on public.hsk_room_players (user_id);

create table if not exists public.game_suggestions (
  id uuid primary key default gen_random_uuid(),
  major_name text not null,
  game_title text not null,
  description text not null,
  status text not null default 'pending' check (status in ('pending', 'reviewing', 'planned', 'done')),
  admin_note text,
  created_by uuid not null references public.profiles(id) on delete cascade,
  created_by_name text not null,
  created_at timestamptz not null default now()
);

create index if not exists game_suggestions_created_by_idx
  on public.game_suggestions (created_by);

create index if not exists game_suggestions_created_at_idx
  on public.game_suggestions (created_at desc);

-- Hàm RPC tranh suất vào phòng (tối đa 5 người/phòng, khóa giao dịch tránh vượt slot khi nhiều SV bấm cùng lúc)
create or replace function public.join_hsk_room(
  p_room_id uuid,
  p_avatar_id text default 'panda'
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_profile record;
  v_room record;
  v_existing record;
  v_count int;
  v_avatar text;
begin
  if v_uid is null then
    return jsonb_build_object('joined', false, 'reason', 'Bạn cần đăng nhập để tham gia phòng.');
  end if;

  select full_name, is_active into v_profile
  from public.profiles
  where id = v_uid;

  if v_profile is null or not v_profile.is_active then
    return jsonb_build_object('joined', false, 'reason', 'Tài khoản chưa được kích hoạt.');
  end if;

  -- Khóa theo room_id trong phạm vi giao dịch để đảm bảo tối đa max_players (5) người chơi
  perform pg_advisory_xact_lock(hashtext(p_room_id::text));

  select * into v_room
  from public.hsk_rooms
  where id = p_room_id;

  if v_room is null then
    return jsonb_build_object('joined', false, 'reason', 'Không tìm thấy phòng chơi.');
  end if;

  select * into v_existing
  from public.hsk_room_players
  where room_id = p_room_id and user_id = v_uid;

  if v_existing is not null then
    return jsonb_build_object('joined', true, 'already_joined', true, 'player_id', v_existing.id);
  end if;

  if v_room.status <> 'waiting' then
    return jsonb_build_object('joined', false, 'reason', 'Phòng đã bắt đầu hoặc kết thúc. Bạn có thể xem trực tiếp ở chế độ khán giả.');
  end if;

  select count(*) into v_count
  from public.hsk_room_players
  where room_id = p_room_id;

  if v_count >= v_room.max_players then
    return jsonb_build_object('joined', false, 'reason', 'Phòng đã đủ ' || v_room.max_players || '/' || v_room.max_players || ' người chơi! Bạn có thể xem ở chế độ khán giả.');
  end if;

  v_avatar := case
    when p_avatar_id in ('panda', 'cat', 'dragon', 'tiger', 'rabbit') then p_avatar_id
    else 'panda'
  end;

  insert into public.hsk_room_players (room_id, user_id, display_name, avatar_id)
  values (p_room_id, v_uid, coalesce(v_profile.full_name, 'Thành viên'), v_avatar);

  return jsonb_build_object('joined', true, 'already_joined', false);
end;
$$;

grant execute on function public.join_hsk_room(uuid, text) to authenticated;

-- Bật RLS cho 3 bảng mới
alter table public.hsk_rooms enable row level security;
alter table public.hsk_room_players enable row level security;
alter table public.game_suggestions enable row level security;

-- RLS cho hsk_rooms
drop policy if exists hsk_rooms_select on public.hsk_rooms;
create policy hsk_rooms_select
on public.hsk_rooms
for select
to authenticated
using (true);

drop policy if exists hsk_rooms_insert on public.hsk_rooms;
create policy hsk_rooms_insert
on public.hsk_rooms
for insert
to authenticated
with check (
  host_id = (select auth.uid())
  and (private.is_admin() or private.user_role() = 'teacher')
);

drop policy if exists hsk_rooms_update on public.hsk_rooms;
create policy hsk_rooms_update
on public.hsk_rooms
for update
to authenticated
using (host_id = (select auth.uid()) or private.is_admin())
with check (host_id = (select auth.uid()) or private.is_admin());

drop policy if exists hsk_rooms_delete on public.hsk_rooms;
create policy hsk_rooms_delete
on public.hsk_rooms
for delete
to authenticated
using (host_id = (select auth.uid()) or private.is_admin());

-- RLS cho hsk_room_players
drop policy if exists hsk_room_players_select on public.hsk_room_players;
create policy hsk_room_players_select
on public.hsk_room_players
for select
to authenticated
using (true);

drop policy if exists hsk_room_players_update on public.hsk_room_players;
create policy hsk_room_players_update
on public.hsk_room_players
for update
to authenticated
using (
  user_id = (select auth.uid())
  or private.is_admin()
  or exists (
    select 1 from public.hsk_rooms r
    where r.id = room_id and r.host_id = (select auth.uid())
  )
)
with check (
  user_id = (select auth.uid())
  or private.is_admin()
  or exists (
    select 1 from public.hsk_rooms r
    where r.id = room_id and r.host_id = (select auth.uid())
  )
);

drop policy if exists hsk_room_players_delete on public.hsk_room_players;
create policy hsk_room_players_delete
on public.hsk_room_players
for delete
to authenticated
using (
  user_id = (select auth.uid())
  or private.is_admin()
  or exists (
    select 1 from public.hsk_rooms r
    where r.id = room_id and r.host_id = (select auth.uid())
  )
);

-- RLS cho game_suggestions
drop policy if exists game_suggestions_select on public.game_suggestions;
create policy game_suggestions_select
on public.game_suggestions
for select
to authenticated
using (true);

drop policy if exists game_suggestions_insert on public.game_suggestions;
create policy game_suggestions_insert
on public.game_suggestions
for insert
to authenticated
with check (created_by = (select auth.uid()));

drop policy if exists game_suggestions_update on public.game_suggestions;
create policy game_suggestions_update
on public.game_suggestions
for update
to authenticated
using (private.is_admin())
with check (private.is_admin());

drop policy if exists game_suggestions_delete on public.game_suggestions;
create policy game_suggestions_delete
on public.game_suggestions
for delete
to authenticated
using (created_by = (select auth.uid()) or private.is_admin());

-- Bật Realtime cho 3 bảng mới
do $$
declare
  t text;
begin
  foreach t in array array['hsk_rooms', 'hsk_room_players', 'game_suggestions']
  loop
    if not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;
