-- Chuẩn hóa lại các số CCCD (10 hoặc 11 chữ số do bị Excel/CIS cắt số 0 ở đầu) thành đủ 12 chữ số,
-- dọn dấu nháy đơn / khoảng trắng thừa, và bổ sung số 0 đầu cho SĐT 9 chữ số.
-- Giữ nguyên CMND 9 số cũ và hộ chiếu có chữ cái.

-- 1. Dọn dấu nháy đơn ở đầu và khoảng trắng trong CCCD
UPDATE public.student_sensitive_profiles
SET cccd = regexp_replace(ltrim(btrim(cccd), ''''), '\s+', '', 'g'),
    updated_at = now()
WHERE cccd IS NOT NULL
  AND (cccd ~ '^\s*''' OR cccd ~ '\s');

-- 2. Bổ sung số 0 ở đầu cho CCCD có đúng 10 hoặc 11 chữ số -> đủ 12 chữ số
UPDATE public.student_sensitive_profiles
SET cccd = lpad(cccd, 12, '0'),
    updated_at = now()
WHERE cccd ~ '^[0-9]{10,11}$';

-- 3. Dọn khoảng trắng / dấu nháy đơn và bổ sung số 0 ở đầu cho SĐT 9 chữ số
UPDATE public.profiles
SET phone = CASE
      WHEN regexp_replace(ltrim(btrim(phone), ''''), '\s+', '', 'g') ~ '^[1-9][0-9]{8}$'
        THEN '0' || regexp_replace(ltrim(btrim(phone), ''''), '\s+', '', 'g')
      ELSE regexp_replace(ltrim(btrim(phone), ''''), '\s+', '', 'g')
    END
WHERE role = 'student'
  AND phone IS NOT NULL
  AND (
    phone ~ '^\s*'''
    OR phone ~ '\s'
    OR btrim(phone) ~ '^[1-9][0-9]{8}$'
  );

