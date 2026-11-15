-- Đợt 2: Điểm danh theo buổi & Sổ điểm tổng hợp theo trọng số

CREATE TABLE IF NOT EXISTS public.attendance_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id uuid NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  session_date date NOT NULL,
  title text NOT NULL CHECK (char_length(btrim(title)) > 0),
  subject text,
  period_start smallint CHECK (period_start IS NULL OR (period_start >= 1 AND period_start <= 15)),
  period_end smallint CHECK (period_end IS NULL OR (period_end >= 1 AND period_end <= 15)),
  room text,
  note text,
  created_by uuid NOT NULL REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT attendance_sessions_period_range_chk CHECK (
    period_start IS NULL OR period_end IS NULL OR period_end >= period_start
  )
);

CREATE INDEX IF NOT EXISTS attendance_sessions_class_date_idx
  ON public.attendance_sessions (class_id, session_date DESC, created_at DESC);

CREATE INDEX IF NOT EXISTS attendance_sessions_created_by_idx
  ON public.attendance_sessions (created_by);

CREATE TABLE IF NOT EXISTS public.attendance_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.attendance_sessions(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'present' CHECK (status IN ('present', 'late', 'excused', 'absent')),
  note text,
  marked_by uuid NOT NULL REFERENCES public.profiles(id),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (session_id, student_id)
);

CREATE INDEX IF NOT EXISTS attendance_records_student_id_idx
  ON public.attendance_records (student_id);

CREATE INDEX IF NOT EXISTS attendance_records_marked_by_idx
  ON public.attendance_records (marked_by);

CREATE TABLE IF NOT EXISTS public.class_gradebook_settings (
  class_id uuid PRIMARY KEY REFERENCES public.classes(id) ON DELETE CASCADE,
  attendance_weight numeric(5,2) NOT NULL DEFAULT 10 CHECK (attendance_weight >= 0 AND attendance_weight <= 100),
  assignment_weight numeric(5,2) NOT NULL DEFAULT 90 CHECK (assignment_weight >= 0 AND assignment_weight <= 100),
  absence_warning_pct numeric(5,2) NOT NULL DEFAULT 20 CHECK (absence_warning_pct > 0 AND absence_warning_pct <= 100),
  late_weight numeric(3,2) NOT NULL DEFAULT 0.50 CHECK (late_weight >= 0 AND late_weight <= 1),
  excused_weight numeric(3,2) NOT NULL DEFAULT 1.00 CHECK (excused_weight >= 0 AND excused_weight <= 1),
  updated_by uuid REFERENCES public.profiles(id),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT class_gradebook_weights_sum_chk CHECK (attendance_weight + assignment_weight = 100)
);

CREATE INDEX IF NOT EXISTS class_gradebook_settings_updated_by_idx
  ON public.class_gradebook_settings (updated_by);

CREATE OR REPLACE FUNCTION private.class_of_attendance_session(sid uuid)
 RETURNS uuid
 LANGUAGE sql
 STABLE
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select s.class_id
  from public.attendance_sessions s
  where s.id = sid
$function$;

REVOKE ALL ON FUNCTION private.class_of_attendance_session(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.class_of_attendance_session(uuid) TO authenticated, service_role;

ALTER TABLE public.attendance_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.class_gradebook_settings ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.attendance_sessions FROM PUBLIC, anon;
REVOKE ALL ON TABLE public.attendance_records FROM PUBLIC, anon;
REVOKE ALL ON TABLE public.class_gradebook_settings FROM PUBLIC, anon;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.attendance_sessions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.attendance_records TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.class_gradebook_settings TO authenticated;

DROP POLICY IF EXISTS attendance_sessions_select ON public.attendance_sessions;
CREATE POLICY attendance_sessions_select ON public.attendance_sessions
  FOR SELECT
  TO authenticated
  USING (private.can_see_class(class_id));

DROP POLICY IF EXISTS attendance_sessions_insert ON public.attendance_sessions;
CREATE POLICY attendance_sessions_insert ON public.attendance_sessions
  FOR INSERT
  TO authenticated
  WITH CHECK (
    private.is_class_teacher(class_id)
    AND created_by = (select auth.uid())
  );

DROP POLICY IF EXISTS attendance_sessions_update ON public.attendance_sessions;
CREATE POLICY attendance_sessions_update ON public.attendance_sessions
  FOR UPDATE
  TO authenticated
  USING (private.is_class_teacher(class_id))
  WITH CHECK (private.is_class_teacher(class_id));

DROP POLICY IF EXISTS attendance_sessions_delete ON public.attendance_sessions;
CREATE POLICY attendance_sessions_delete ON public.attendance_sessions
  FOR DELETE
  TO authenticated
  USING (private.is_class_teacher(class_id));

DROP POLICY IF EXISTS attendance_records_select ON public.attendance_records;
CREATE POLICY attendance_records_select ON public.attendance_records
  FOR SELECT
  TO authenticated
  USING (
    student_id = (select auth.uid())
    OR private.is_class_teacher(private.class_of_attendance_session(session_id))
  );

DROP POLICY IF EXISTS attendance_records_insert ON public.attendance_records;
CREATE POLICY attendance_records_insert ON public.attendance_records
  FOR INSERT
  TO authenticated
  WITH CHECK (
    private.is_class_teacher(private.class_of_attendance_session(session_id))
    AND marked_by = (select auth.uid())
  );

DROP POLICY IF EXISTS attendance_records_update ON public.attendance_records;
CREATE POLICY attendance_records_update ON public.attendance_records
  FOR UPDATE
  TO authenticated
  USING (private.is_class_teacher(private.class_of_attendance_session(session_id)))
  WITH CHECK (
    private.is_class_teacher(private.class_of_attendance_session(session_id))
    AND marked_by = (select auth.uid())
  );

DROP POLICY IF EXISTS attendance_records_delete ON public.attendance_records;
CREATE POLICY attendance_records_delete ON public.attendance_records
  FOR DELETE
  TO authenticated
  USING (private.is_class_teacher(private.class_of_attendance_session(session_id)));

DROP POLICY IF EXISTS class_gradebook_settings_select ON public.class_gradebook_settings;
CREATE POLICY class_gradebook_settings_select ON public.class_gradebook_settings
  FOR SELECT
  TO authenticated
  USING (private.can_see_class(class_id));

DROP POLICY IF EXISTS class_gradebook_settings_insert ON public.class_gradebook_settings;
CREATE POLICY class_gradebook_settings_insert ON public.class_gradebook_settings
  FOR INSERT
  TO authenticated
  WITH CHECK (
    private.is_class_teacher(class_id)
    AND (updated_by IS NULL OR updated_by = (select auth.uid()))
  );

DROP POLICY IF EXISTS class_gradebook_settings_update ON public.class_gradebook_settings;
CREATE POLICY class_gradebook_settings_update ON public.class_gradebook_settings
  FOR UPDATE
  TO authenticated
  USING (private.is_class_teacher(class_id))
  WITH CHECK (
    private.is_class_teacher(class_id)
    AND (updated_by IS NULL OR updated_by = (select auth.uid()))
  );

DROP POLICY IF EXISTS class_gradebook_settings_delete ON public.class_gradebook_settings;
CREATE POLICY class_gradebook_settings_delete ON public.class_gradebook_settings
  FOR DELETE
  TO authenticated
  USING (private.is_class_teacher(class_id));

