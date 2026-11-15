import { createClient } from "npm:@supabase/supabase-js@2";

const DOMAIN = "@caodangvietmyhanoi.edu.vn";
const DEFAULT_PASSWORD = "123@123a";
const GENDERS = ["Nam", "Nữ", "Khác"];

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
const fail = (message: string, status = 400) => json({ error: message }, status);

// Bỏ dấu tiếng Việt, viết thường, chỉ giữ a-z và 0-9
const slug = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/[^a-z0-9]/g, "");

// Khóa so khớp tên lớp/tên giáo viên (phải giống hàm classKey ở frontend)
const classKey = (s: string) => s.normalize("NFC").trim().replace(/\s+/g, " ").toLowerCase();

// Email sinh viên = tên + 8 số cuối của MSV + đuôi trường
function studentEmail(fullName: string, code: string): string | null {
  const parts = fullName.trim().split(/\s+/);
  const given = slug(parts[parts.length - 1] ?? "");
  const digits = code.replace(/\D/g, "");
  if (!given || digits.length < 8) return null;
  return `${given}${digits.slice(-8)}${DOMAIN}`;
}

function validDob(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(value + "T00:00:00Z");
  if (isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== value) return false;
  return d.getTime() <= Date.now() && d.getUTCFullYear() >= 1930;
}

type Extra = {
  student_code?: string;
  subject?: string;
  gender?: string;
  date_of_birth?: string;
  admissions_advisor?: string;
  class_name?: string;
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return fail("Phương thức không được hỗ trợ", 405);

  const url = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  // Xác thực người gọi và kiểm tra là hiệu trưởng đang hoạt động
  const userClient = createClient(url, anonKey, {
    global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
  });
  const { data: { user } } = await userClient.auth.getUser();
  if (!user) return fail("Bạn cần đăng nhập", 401);

  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
  const { data: me } = await admin.from("profiles").select("role, is_active").eq("id", user.id).single();
  if (!me || me.role !== "admin" || !me.is_active) return fail("Chỉ hiệu trưởng mới có quyền thực hiện", 403);

  let body: Record<string, string | boolean | undefined>;
  try {
    body = await req.json();
  } catch {
    return fail("Dữ liệu gửi lên không hợp lệ");
  }

  // Tạo auth user + profile, hoàn tác nếu profile lỗi
  async function createAccount(email: string, fullName: string, role: "student" | "teacher", extra: Extra) {
    const { data: created, error } = await admin.auth.admin.createUser({
      email,
      password: DEFAULT_PASSWORD,
      email_confirm: true,
      app_metadata: { role },
    });
    if (error || !created.user) {
      const dup = error?.message?.toLowerCase().includes("already");
      return { error: dup ? "Email đã tồn tại" : "Không tạo được tài khoản", status: dup ? 409 : 500 };
    }
    const profile = {
      id: created.user.id,
      email,
      full_name: fullName,
      role,
      is_active: true,
      student_code: extra.student_code ?? null,
      subject: extra.subject ?? null,
      gender: extra.gender ?? null,
      date_of_birth: extra.date_of_birth ?? null,
      admissions_advisor: extra.admissions_advisor || null,
      class_name: extra.class_name || null,
      class_key: extra.class_name ? classKey(extra.class_name) : null,
    };
    const { error: pErr } = await admin.from("profiles").insert(profile);
    if (pErr) {
      await admin.auth.admin.deleteUser(created.user.id);
      return { error: "Không lưu được hồ sơ, vui lòng thử lại", status: 500 };
    }
    return { profile };
  }

  const isTaken = async (code: string, email: string) => {
    const { data } = await admin.from("profiles").select("id").or(`student_code.eq.${code},email.eq.${email}`).limit(1);
    return !!(data && data.length);
  };

  const action = body.action;

  if (action === "create_student") {
    const rawCode = String(body.student_code ?? "").trim();
    const fullName = String(body.full_name ?? "").trim();
    const gender = String(body.gender ?? "");
    const dob = String(body.date_of_birth ?? "");
    if (!fullName) return fail("Vui lòng nhập họ tên sinh viên");
    if (!GENDERS.includes(gender)) return fail("Vui lòng chọn giới tính");
    if (!validDob(dob)) return fail("Ngày sinh không hợp lệ");

    const normalizedCode = !rawCode
      ? ""
      : /^\d{7}$/.test(rawCode)
        ? `6111${rawCode}`
        : /^6111\d{7}$/.test(rawCode)
          ? rawCode
          : null;
    if (normalizedCode === null) {
      return fail("Mã sinh viên phải bắt đầu bằng 6111 và gồm 11 chữ số (hoặc nhập 7 số cuối)");
    }

    let code = normalizedCode;
    let email: string | null = null;

    if (code) {
      email = studentEmail(fullName, code);
      if (!email) return fail("Họ tên không hợp lệ");
      if (await isTaken(code, email)) return fail("Mã sinh viên hoặc email đã tồn tại, vui lòng điều chỉnh mã", 409);
    } else {
      // Không nhập mã: hệ thống tự cấp mã 11 chữ số (6111 + YY + 5 số), thử lại nếu trùng
      for (let i = 0; i < 5 && !email; i++) {
        const { data, error } = await admin.rpc("next_student_code");
        if (error || !data) return fail("Không tạo được mã sinh viên, vui lòng thử lại", 500);
        const candidate = String(data);
        const candidateEmail = studentEmail(fullName, candidate);
        if (!candidateEmail) return fail("Họ tên không hợp lệ");
        if (!(await isTaken(candidate, candidateEmail))) {
          code = candidate;
          email = candidateEmail;
        }
      }
      if (!email) return fail("Không tạo được mã sinh viên, vui lòng thử lại", 500);
    }

    const res = await createAccount(email, fullName, "student", {
      student_code: code,
      gender,
      date_of_birth: dob,
      admissions_advisor: String(body.admissions_advisor ?? "").trim(),
      class_name: String(body.class_name ?? "").trim(),
    });
    if ("error" in res) return fail(res.error!, res.status);
    return json({ user: res.profile }, 201);
  }

  if (action === "create_teacher") {
    let email = String(body.email ?? "").trim().toLowerCase();
    const fullName = String(body.full_name ?? "").trim();
    if (!email || !fullName) return fail("Vui lòng nhập email và họ tên");
    if (!email.includes("@")) email += DOMAIN;
    if (!email.endsWith(DOMAIN)) return fail(`Email phải có đuôi ${DOMAIN}`);

    const { data: dup } = await admin.from("profiles").select("id").eq("email", email).limit(1);
    if (dup && dup.length) return fail("Email đã tồn tại", 409);

    const res = await createAccount(email, fullName, "teacher", { subject: String(body.subject ?? "") });
    if ("error" in res) return fail(res.error!, res.status);
    return json({ user: res.profile }, 201);
  }

  if (action === "set_active" || action === "reset_password") {
    const targetId = String(body.user_id ?? "");
    if (!targetId) return fail("Thiếu mã tài khoản");
    if (targetId === user.id) return fail("Không thể thao tác trên tài khoản của chính bạn");
    const { data: target } = await admin.from("profiles").select("id, role").eq("id", targetId).single();
    if (!target || target.role === "admin") return fail("Không tìm thấy tài khoản sinh viên hoặc giáo viên", 404);

    if (action === "set_active") {
      const active = body.is_active === true;
      const { error: e1 } = await admin.from("profiles").update({ is_active: active }).eq("id", targetId);
      const { error: e2 } = await admin.auth.admin.updateUserById(targetId, { ban_duration: active ? "none" : "876000h" });
      if (e1 || e2) return fail("Không cập nhật được trạng thái tài khoản", 500);
      return json({ ok: true, is_active: active });
    }

    const { error } = await admin.auth.admin.updateUserById(targetId, { password: DEFAULT_PASSWORD });
    if (error) return fail("Không đặt lại được mật khẩu", 500);
    return json({ ok: true });
  }

  if (action === "delete_student") {
    const targetId = String(body.user_id ?? "");
    if (!targetId) return fail("Thiếu mã tài khoản");
    if (targetId === user.id) return fail("Không thể xóa tài khoản của chính bạn");

    const { data: target } = await admin
      .from("profiles")
      .select("id, role")
      .eq("id", targetId)
      .single();
    if (!target || target.role !== "student") {
      return fail("Không tìm thấy tài khoản sinh viên", 404);
    }

    // Dọn file bài nộp (nếu có) trong bucket submissions trước khi xóa tài khoản
    const { data: subs } = await admin
      .from("submissions")
      .select("file_url")
      .eq("student_id", targetId);
    const storagePaths = (subs ?? [])
      .map((row) => row.file_url as string | null)
      .filter((path): path is string => Boolean(path) && !/^https?:\/\//i.test(path));
    if (storagePaths.length > 0) {
      await admin.storage.from("submissions").remove(storagePaths);
    }

    // Xóa auth.users kéo theo CASCADE xóa profiles, enrollments và submissions
    const { error } = await admin.auth.admin.deleteUser(targetId);
    if (error) return fail("Không xóa được tài khoản sinh viên", 500);
    return json({ ok: true });
  }

  return fail("Hành động không hợp lệ");
});

