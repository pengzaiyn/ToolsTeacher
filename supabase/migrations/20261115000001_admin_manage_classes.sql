-- Chuyển quyền tạo / sửa / xóa lớp học (public.classes) sang Hiệu trưởng (admin)
-- và cho phép Hiệu trưởng quản lý ghi danh sinh viên (public.enrollments).
-- Chạy file này trong Supabase Dashboard -> SQL Editor nếu chưa thể áp dụng qua MCP.

DROP POLICY IF EXISTS classes_insert ON public.classes;
CREATE POLICY classes_insert ON public.classes
  FOR INSERT
  TO authenticated
  WITH CHECK (private.is_admin());

DROP POLICY IF EXISTS classes_update ON public.classes;
CREATE POLICY classes_update ON public.classes
  FOR UPDATE
  TO authenticated
  USING (private.is_admin())
  WITH CHECK (private.is_admin());

DROP POLICY IF EXISTS classes_delete ON public.classes;
CREATE POLICY classes_delete ON public.classes
  FOR DELETE
  TO authenticated
  USING (private.is_admin());

DROP POLICY IF EXISTS enrollments_insert ON public.enrollments;
CREATE POLICY enrollments_insert ON public.enrollments
  FOR INSERT
  TO authenticated
  WITH CHECK (private.is_admin() OR private.is_class_teacher(class_id));

DROP POLICY IF EXISTS enrollments_delete ON public.enrollments;
CREATE POLICY enrollments_delete ON public.enrollments
  FOR DELETE
  TO authenticated
  USING (private.is_admin() OR private.is_class_teacher(class_id));

