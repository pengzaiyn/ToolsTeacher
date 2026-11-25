import { createClient } from "npm:@supabase/supabase-js@2";

const DEFAULT_CIS_BASE_URL = "https://hanoi.vietmycollege.com/api/integrations/student-profile";
const DOMAIN = "@caodangvietmyhanoi.edu.vn";
const DEFAULT_PASSWORD = "123@123a";

const slug = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/[^a-z0-9]/g, "");

function buildStudentEmail(fullName: string, code: string, suffix = ""): string {
  const parts = fullName.trim().split(/\s+/);
  const given = slug(parts[parts.length - 1] ?? "");
  const cleanCode = slug(code);
  if (given && cleanCode.length >= 6) {
    return `${given}${cleanCode.slice(-8)}${suffix}${DOMAIN}`;
  }
  return `sv${cleanCode || "user"}${suffix}${DOMAIN}`;
}

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

const fail = (message: string, status = 400, code?: string) =>
  json({ error: message, ...(code ? { code } : {}) }, status);

const classKey = (s: string) => s.normalize("NFC").trim().replace(/\s+/g, " ").toLowerCase();

const PLACEHOLDER_CLASSES = new Set(["chưa phân lớp", "chờ", "---", ""]);
function normalizeClassName(raw: string | null | undefined): string | null {
  const cleaned = (raw ?? "").trim().replace(/\s+/g, " ");
  if (!cleaned || PLACEHOLDER_CLASSES.has(cleaned.toLowerCase())) return null;
  return cleaned;
}

function cleanOptionalText(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  return trimmed ? trimmed : null;
}

function normalizeDob(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return null;
  const d = new Date(`${trimmed}T00:00:00Z`);
  if (isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== trimmed) return null;
  return trimmed;
}

function normalizeIsoTimestamp(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const ms = Date.parse(trimmed);
  return Number.isNaN(ms) ? null : new Date(ms).toISOString();
}

interface CisStudentRecord {
  hoTen?: string;
  maSinhVien?: string;
  sdt?: string;
  cccd?: string;
  ngayCapCccd?: string;
  ngaySinh?: string;
  noiSinh?: string;
  khoaHoc?: string;
  lop?: string;
  khoa?: string;
  nganh?: string;
  updatedAt?: string;
}

function mapCisError(status: number, bodyError?: string): { message: string; code: string } {
  const code = bodyError || `HTTP_${status}`;
  if (status === 401 || code === "UNAUTHORIZED") {
    return {
      code: "CIS_UNAUTHORIZED",
      message: "Khóa CIS_API_TOKEN chưa đúng hoặc thiếu dạng Bearer. Vui lòng kiểm tra Supabase Secrets.",
    };
  }
  if (status === 403 || code === "FORBIDDEN_IP") {
    return {
      code: "FORBIDDEN_IP",
      message: "API CIS đang chặn địa chỉ IP của máy chủ gọi (FORBIDDEN_IP). Cần gửi IP cho quản trị CIS mở quyền.",
    };
  }
  if (status === 404 || code === "NOT_FOUND") {
    return {
      code: "NOT_FOUND",
      message: "Không tìm thấy hồ sơ sinh viên này trên hệ thống CIS.",
    };
  }
  if (status === 503 || code === "SERVICE_UNAVAILABLE") {
    return {
      code: "SERVICE_UNAVAILABLE",
      message: "Máy chủ CIS chưa bật khóa tích hợp (503 SERVICE_UNAVAILABLE).",
    };
  }
  return {
    code,
    message: `Lỗi kết nối hệ thống CIS (${status}${bodyError ? ` · ${bodyError}` : ""}).`,
  };
}

function buildProfilePatch(rec: CisStudentRecord): Record<string, string | null> {
  const patch: Record<string, string | null> = {};

  const fullName = cleanOptionalText(rec.hoTen);
  if (fullName) patch.full_name = fullName;

  const dob = normalizeDob(rec.ngaySinh);
  if (dob) patch.date_of_birth = dob;

  const phone = cleanOptionalText(rec.sdt);
  if (phone !== null) patch.phone = phone;

  const cccd = cleanOptionalText(rec.cccd);
  if (cccd !== null) patch.cccd = cccd;

  const cccdIssuedDate = cleanOptionalText(rec.ngayCapCccd);
  if (cccdIssuedDate !== null) patch.cccd_issued_date = cccdIssuedDate;

  const placeOfBirth = cleanOptionalText(rec.noiSinh);
  if (placeOfBirth !== null) patch.place_of_birth = placeOfBirth;

  const cohort = cleanOptionalText(rec.khoaHoc);
  if (cohort !== null) patch.cohort = cohort;

  const faculty = cleanOptionalText(rec.khoa);
  if (faculty !== null) patch.faculty = faculty;

  const major = cleanOptionalText(rec.nganh);
  if (major !== null) patch.major = major;

  const clsName = normalizeClassName(rec.lop);
  if (clsName) {
    patch.class_name = clsName;
    patch.class_key = classKey(clsName);
  }

  const updatedAt = normalizeIsoTimestamp(rec.updatedAt);
  if (updatedAt) patch.cis_updated_at = updatedAt;

  return patch;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return fail("Phương thức không được hỗ trợ", 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const rawCisToken = (Deno.env.get("CIS_API_TOKEN") ?? "").trim().replace(/^["']|["']$/g, "");
  const cisToken = rawCisToken.replace(/^bearer\s+/i, "").trim();
  const cisBaseUrl = (Deno.env.get("CIS_API_BASE_URL") ?? DEFAULT_CIS_BASE_URL).replace(/\/+$/, "");

  const authHeader = req.headers.get("Authorization") ?? "";
  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const {
    data: { user },
  } = await userClient.auth.getUser();
  if (!user) return fail("Bạn cần đăng nhập", 401);

  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
  const { data: me } = await admin
    .from("profiles")
    .select("role, is_active")
    .eq("id", user.id)
    .single();

  if (!me || me.role !== "admin" || !me.is_active) {
    return fail("Chỉ hiệu trưởng mới có quyền đồng bộ dữ liệu CIS", 403);
  }

  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    return fail("Dữ liệu gửi lên không hợp lệ");
  }

  const action = String(body.action ?? "");

  if (action === "status") {
    const { data: state } = await admin
      .from("cis_sync_state")
      .select("last_synced_at, last_updated_since, last_status, last_summary")
      .eq("id", 1)
      .maybeSingle();

    return json({
      hasLocalToken: Boolean(cisToken),
      baseUrl: cisBaseUrl,
      state: state ?? null,
    });
  }

  if (!cisToken) {
    return fail(
      "Chưa cấu hình biến môi trường CIS_API_TOKEN trong Supabase Edge Function Secrets.",
      503,
      "MISSING_LOCAL_TOKEN"
    );
  }

  async function callCis(path: string) {
    const res = await fetch(`${cisBaseUrl}${path}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${cisToken}`,
        Accept: "application/json",
      },
    });
    const parsed = await res.json().catch(() => ({}));
    if (!res.ok) {
      const mapped = mapCisError(res.status, typeof parsed?.error === "string" ? parsed.error : undefined);
      const clientStatus = res.status === 401 ? 502 : res.status;
      return {
        ok: false as const,
        status: clientStatus,
        code: mapped.code,
        message: mapped.message,
      };
    }
    return { ok: true as const, status: res.status, payload: parsed };
  }

  // 1. Kiểm tra sống (/health)
  if (action === "health") {
    const res = await callCis("/health");
    if (!res.ok) return fail(res.message, res.status, res.code);
    return json({
      ok: true,
      hasLocalToken: true,
      apiKeyConfigured: Boolean(res.payload?.data?.apiKeyConfigured),
      writeEnabled: Boolean(res.payload?.data?.features?.write),
      serverTime: res.payload?.meta?.server_time ?? null,
      sourceSystem: res.payload?.meta?.source_system ?? "CIS",
    });
  }

  // Tạo tài khoản Auth + hồ sơ profiles cho sinh viên có trên CIS nhưng chưa có trên web
  async function createStudentFromCis(rec: CisStudentRecord) {
    const studentCode = String(rec.maSinhVien ?? "").trim();
    const fullName = cleanOptionalText(rec.hoTen) ?? studentCode;
    const patch = buildProfilePatch(rec);

    const candidates = [
      buildStudentEmail(fullName, studentCode),
      buildStudentEmail(fullName, studentCode, `_${slug(studentCode).slice(-4) || "1"}`),
      `sv${slug(studentCode)}${DOMAIN}`,
    ];

    let createdUserId: string | null = null;
    let finalEmail = candidates[0];
    let lastError = "Không tạo được tài khoản";

    for (const candidate of candidates) {
      const { data: created, error } = await admin.auth.admin.createUser({
        email: candidate,
        password: DEFAULT_PASSWORD,
        email_confirm: true,
        app_metadata: { role: "student" },
        ban_duration: "none",
      });
      if (!error && created?.user) {
        createdUserId = created.user.id;
        finalEmail = candidate;
        break;
      }
      lastError = error?.message ?? lastError;
      if (!lastError.toLowerCase().includes("already")) {
        break;
      }
    }

    if (!createdUserId) {
      return { ok: false as const, error: lastError };
    }

    const profileRow = {
      id: createdUserId,
      email: finalEmail,
      full_name: patch.full_name ?? fullName,
      role: "student",
      is_active: true,
      student_code: studentCode,
      date_of_birth: patch.date_of_birth ?? null,
      phone: patch.phone ?? null,
      cccd: patch.cccd ?? null,
      cccd_issued_date: patch.cccd_issued_date ?? null,
      place_of_birth: patch.place_of_birth ?? null,
      cohort: patch.cohort ?? null,
      faculty: patch.faculty ?? null,
      major: patch.major ?? null,
      class_name: patch.class_name ?? null,
      class_key: patch.class_key ?? null,
      cis_updated_at: patch.cis_updated_at ?? null,
    };

    const { error: pErr } = await admin.from("profiles").insert(profileRow);
    if (pErr) {
      await admin.auth.admin.deleteUser(createdUserId);
      return { ok: false as const, error: pErr.message };
    }

    return {
      ok: true as const,
      id: createdUserId,
      email: finalEmail,
      student: {
        studentCode,
        fullName: profileRow.full_name,
        email: finalEmail,
        className: profileRow.class_name,
        cohort: profileRow.cohort,
        major: profileRow.major,
      },
    };
  }

  // 2. Tra cứu & cập nhật (hoặc tự tạo mới) 1 sinh viên theo mã sinh viên
  if (action === "lookup_one") {
    const studentCode = String(body.student_code ?? "").trim();
    if (!studentCode) return fail("Vui lòng nhập mã sinh viên cần đồng bộ");

    const res = await callCis(`/students/${encodeURIComponent(studentCode)}`);
    if (!res.ok) return fail(res.message, res.status, res.code);

    const record = res.payload?.data as CisStudentRecord | undefined;
    if (!record || !record.maSinhVien) {
      return fail("API CIS không trả về dữ liệu hợp lệ cho mã sinh viên này", 404, "NOT_FOUND");
    }

    const { data: existing } = await admin
      .from("profiles")
      .select("id, student_code, full_name, email")
      .eq("role", "student")
      .ilike("student_code", studentCode)
      .maybeSingle();

    if (!existing) {
      const created = await createStudentFromCis(record);
      if (!created.ok) {
        return fail(`Tìm thấy trên CIS nhưng không tạo được tài khoản: ${created.error}`, 500);
      }
      const { data: classesCreated } = await userClient.rpc("sync_system_classes");
      return json({
        ok: true,
        foundOnCis: true,
        matchedOnWeb: true,
        createdOnWeb: true,
        email: created.email,
        studentCode: created.student.studentCode,
        fullName: created.student.fullName,
        className: created.student.className,
        classesCreated: Number(classesCreated ?? 0),
      });
    }

    const patch = buildProfilePatch(record);
    if (Object.keys(patch).length > 0) {
      const { error: updErr } = await admin
        .from("profiles")
        .update(patch)
        .eq("id", existing.id);
      if (updErr) return fail(`Lỗi cập nhật hồ sơ: ${updErr.message}`, 500);
    }

    const { data: classesCreated } = await userClient.rpc("sync_system_classes");

    return json({
      ok: true,
      foundOnCis: true,
      matchedOnWeb: true,
      createdOnWeb: false,
      email: existing.email,
      studentCode: record.maSinhVien,
      fullName: patch.full_name ?? existing.full_name,
      className: patch.class_name ?? null,
      classesCreated: Number(classesCreated ?? 0),
    });
  }

  // 3. Đồng bộ từng trang CIS (500 SV/lượt) + cập nhật/tạo mới song song -> không bị timeout 546
  if (action === "sync_page") {
    const mode = body.mode === "full" ? "full" : "incremental";
    const cursor = typeof body.cursor === "string" && body.cursor.trim() ? body.cursor.trim() : null;
    let updatedSince =
      typeof body.updated_since === "string" && body.updated_since.trim()
        ? body.updated_since.trim()
        : null;

    if (mode === "incremental" && !cursor && !updatedSince) {
      const { data: state } = await admin
        .from("cis_sync_state")
        .select("last_updated_since")
        .eq("id", 1)
        .maybeSingle();
      updatedSince = state?.last_updated_since ?? null;
    }

    const qs = new URLSearchParams({ limit: "500" });
    if (cursor) qs.set("cursor", cursor);
    if (updatedSince) qs.set("updated_since", updatedSince);

    const res = await callCis(`/students?${qs.toString()}`);
    if (!res.ok) return fail(res.message, res.status, res.code);

    const records = (Array.isArray(res.payload?.data) ? res.payload.data : []) as CisStudentRecord[];
    const serverTime = typeof res.payload?.meta?.server_time === "string" ? res.payload.meta.server_time : null;
    const totalRecords =
      typeof res.payload?.pagination?.total_records === "number"
        ? res.payload.pagination.total_records
        : null;
    const nextCursor =
      typeof res.payload?.pagination?.next_cursor === "string" && res.payload.pagination.next_cursor
        ? res.payload.pagination.next_cursor
        : null;

    // Chỉ query những mã sinh viên xuất hiện trong trang 500 bản ghi hiện tại
    const rawCodes = Array.from(
      new Set(
        records
          .map((r) => String(r.maSinhVien ?? "").trim())
          .filter(Boolean)
      )
    );

    const studentIdByCode = new Map<string, string>();
    const CODE_CHUNK = 150;
    for (let i = 0; i < rawCodes.length; i += CODE_CHUNK) {
      const slice = rawCodes.slice(i, i + CODE_CHUNK);
      const { data: matchedRows, error: qErr } = await admin
        .from("profiles")
        .select("id, student_code")
        .eq("role", "student")
        .in("student_code", slice);
      if (qErr) return fail(`Lỗi tra cứu sinh viên: ${qErr.message}`, 500);
      for (const row of matchedRows ?? []) {
        const key = String(row.student_code ?? "").trim().toLowerCase();
        if (key) studentIdByCode.set(key, row.id);
      }
    }

    let matchedCount = 0;
    let updatedCount = 0;
    let createdCount = 0;
    let skippedNotOnWeb = 0;
    let errorCount = 0;
    let newestUpdatedAt: string | null = updatedSince;
    const createdStudents: Array<{
      studentCode: string;
      fullName: string;
      email?: string;
      className: string | null;
      cohort: string | null;
      major: string | null;
    }> = [];
    const skippedStudents: Array<{
      studentCode: string;
      fullName: string;
      className: string | null;
      cohort: string | null;
      major: string | null;
    }> = [];

    const updates: Array<{ id: string; patch: Record<string, string | null> }> = [];
    const toCreate: CisStudentRecord[] = [];
    const seenCreateCodes = new Set<string>();

    for (const rec of records) {
      const codeKey = String(rec.maSinhVien ?? "").trim().toLowerCase();
      const recUpdatedAt = normalizeIsoTimestamp(rec.updatedAt);
      if (recUpdatedAt && (!newestUpdatedAt || recUpdatedAt > newestUpdatedAt)) {
        newestUpdatedAt = recUpdatedAt;
      }
      if (!codeKey) continue;
      const profileId = studentIdByCode.get(codeKey);
      if (!profileId) {
        if (!seenCreateCodes.has(codeKey)) {
          seenCreateCodes.add(codeKey);
          toCreate.push(rec);
        }
        continue;
      }
      matchedCount += 1;
      const patch = buildProfilePatch(rec);
      if (Object.keys(patch).length > 0) {
        updates.push({ id: profileId, patch });
      }
    }

    // 3a. Cập nhật song song từng nhóm 25 bản ghi cho SV đã có tài khoản
    const CONCURRENCY = 25;
    for (let i = 0; i < updates.length; i += CONCURRENCY) {
      const batch = updates.slice(i, i + CONCURRENCY);
      const results = await Promise.all(
        batch.map(({ id, patch }) => admin.from("profiles").update(patch).eq("id", id))
      );
      for (const r of results) {
        if (r.error) errorCount += 1;
        else updatedCount += 1;
      }
    }

    // 3b. Tự động tạo tài khoản cho SV có trên CIS nhưng chưa có trên web
    const CREATE_CONCURRENCY = 5;
    for (let i = 0; i < toCreate.length; i += CREATE_CONCURRENCY) {
      const batch = toCreate.slice(i, i + CREATE_CONCURRENCY);
      const results = await Promise.all(
        batch.map(async (rec) => ({ rec, res: await createStudentFromCis(rec) }))
      );
      for (const { rec, res: created } of results) {
        if (created.ok) {
          createdCount += 1;
          if (createdStudents.length < 200) {
            createdStudents.push(created.student);
          }
        } else {
          errorCount += 1;
          skippedNotOnWeb += 1;
          if (skippedStudents.length < 200) {
            skippedStudents.push({
              studentCode: String(rec.maSinhVien ?? "").trim(),
              fullName: cleanOptionalText(rec.hoTen) ?? "—",
              className: normalizeClassName(rec.lop),
              cohort: cleanOptionalText(rec.khoaHoc),
              major: cleanOptionalText(rec.nganh),
            });
          }
        }
      }
    }

    return json({
      ok: true,
      page: {
        fetchedCount: records.length,
        matchedCount,
        updatedCount,
        createdCount,
        createdStudents,
        skippedNotOnWeb,
        skippedStudents,
        errorCount,
        totalRecords,
        nextCursor,
        serverTime,
        newestUpdatedAt,
        usedUpdatedSince: updatedSince,
      },
    });
  }

  // 4. Chốt đồng bộ: xếp lớp & lưu trạng thái vào cis_sync_state
  if (action === "finalize_sync") {
    const summary = (body.summary ?? {}) as Record<string, unknown>;
    const nextSyncMarker =
      typeof body.last_updated_since === "string" && body.last_updated_since.trim()
        ? body.last_updated_since.trim()
        : new Date().toISOString();

    const { data: classesCreated, error: rpcErr } = await userClient.rpc("sync_system_classes");
    if (rpcErr) return fail(`Lỗi xếp lớp tự động: ${rpcErr.message}`, 500);

    const finalSummary = {
      ...summary,
      classesCreated: Number(classesCreated ?? 0),
    };

    await admin.from("cis_sync_state").upsert({
      id: 1,
      last_synced_at: new Date().toISOString(),
      last_updated_since: nextSyncMarker,
      last_status: "OK",
      last_summary: finalSummary,
      updated_by: user.id,
    });

    return json({
      ok: true,
      classesCreated: Number(classesCreated ?? 0),
      summary: finalSummary,
      lastUpdatedSince: nextSyncMarker,
    });
  }

  return fail("Hành động không hợp lệ");
});
