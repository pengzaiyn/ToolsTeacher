-- Cho phép tạo lớp học khi chưa phân công giáo viên phụ trách (teacher_id có thể NULL).
-- Chạy file này trong Supabase Dashboard -> SQL Editor.

ALTER TABLE public.classes
  ALTER COLUMN teacher_id DROP NOT NULL;

