import { createClient } from "npm:@supabase/supabase-js@2";

const TOKEN_MAX_AGE_MS = 20_000; // Thời hạn chuẩn hiển thị trên bảng (xoay mỗi 15 giây)
const NETWORK_LAG_GRACE_MS = 10_000; // Ân hạn thêm 10s cho mạng 3G/4G giảng đường lag + thời gian mở trình duyệt từ Camera gốc (tổng cửa sổ chấp nhận 30s: nhận cả mã hiện tại lẫn mã vừa nhảy xong)
const CLOCK_DRIFT_TOLERANCE_MS = 3_000;
const DEFAULT_SESSION_DURATION_MINUTES = 90;

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

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function randomHex(byteLength: number): string {
  const buf = new Uint8Array(byteLength);
  crypto.getRandomValues(buf);
  return bytesToHex(buf);
}

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return bytesToHex(new Uint8Array(digest));
}

async function hmacSha256Hex(secret: string, message: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(message));
  return bytesToHex(new Uint8Array(sig));
}

function timingSafeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

function fromBase64Url(b64url: string): string {
  const padded = b64url.replace(/-/g, "+").replace(/_/g, "/");
  const padLen = (4 - (padded.length % 4)) % 4;
  return atob(padded + "=".repeat(padLen));
}

interface QrTokenPayload {
  sid: string;
  ts: number;
  nonce: string;
  sig: string;
}

function compactUuidToHex(uuid: string): string {
  return uuid.replace(/-/g, "").toLowerCase();
}

function expandHexToUuid(hex: string): string {
  const clean = hex.replace(/-/g, "").toLowerCase();
  if (!/^[0-9a-f]{32}$/.test(clean)) return hex;
  return `${clean.slice(0, 8)}-${clean.slice(8, 12)}-${clean.slice(12, 16)}-${clean.slice(16, 20)}-${clean.slice(20, 32)}`;
}

// Tạo token siêu gọn (<sid32>.<ts36>.<nonce6>.<sig24>) giúp giảm 60% mật độ điểm trên mã QR
// để camera điện thoại bắt nét cực nhanh từ khoảng cách xa 5-8m trong lớp học
async function mintRotatingToken(sessionId: string, secretKey: string): Promise<{
  token: string;
  payload: QrTokenPayload;
}> {
  const sidFull = expandHexToUuid(sessionId);
  const sidHex = compactUuidToHex(sidFull);
  const ts = Date.now();
  const ts36 = ts.toString(36);
  const nonce = randomHex(3); // 6 ký tự hex
  const msg = `${sidFull}.${ts}.${nonce}`;
  const fullSig = await hmacSha256Hex(secretKey, msg);
  const sig = fullSig.slice(0, 24); // 96-bit HMAC-SHA256 (chuẩn NIST SP 800-107 cho token 20s)
  const payload: QrTokenPayload = { sid: sidFull, ts, nonce, sig };
  const token = `${sidHex}.${ts36}.${nonce}.${sig}`;
  return { token, payload };
}

function extractTokenString(raw: string): string {
  const trimmed = raw.trim().replace(/^avc:/i, "");
  if (!trimmed) return "";
  try {
    if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
      const u = new URL(trimmed);
      const p = u.searchParams.get("p") || u.searchParams.get("token");
      if (p) return p.trim();
    }
  } catch {
    // Không phải URL, xử lý như chuỗi token trực tiếp
  }
  return trimmed;
}

function parseTokenPayload(rawToken: string): QrTokenPayload | null {
  const clean = extractTokenString(rawToken);
  if (!clean) return null;

  // Định dạng siêu gọn mới: <sid32>.<ts36>.<nonce>.<sig>
  const parts = clean.split(".");
  if (parts.length === 4) {
    const [sidRaw, ts36, nonce, sig] = parts;
    const sid = expandHexToUuid(sidRaw);
    const ts = Number.parseInt(ts36, 36);
    if (
      /^[0-9a-f-]{36}$/i.test(sid) &&
      Number.isFinite(ts) &&
      ts > 1_700_000_000_000 &&
      nonce.length >= 4 &&
      /^[0-9a-f]{24,64}$/i.test(sig)
    ) {
      return { sid, ts, nonce, sig: sig.toLowerCase() };
    }
  }

  // Tương thích ngược với định dạng base64url JSON cũ
  try {
    const decoded = clean.startsWith("{") ? clean : fromBase64Url(clean);
    const parsed = JSON.parse(decoded) as Partial<QrTokenPayload>;
    if (
      typeof parsed.sid === "string" &&
      typeof parsed.ts === "number" &&
      Number.isFinite(parsed.ts) &&
      typeof parsed.nonce === "string" &&
      typeof parsed.sig === "string"
    ) {
      return {
        sid: expandHexToUuid(parsed.sid),
        ts: parsed.ts,
        nonce: parsed.nonce,
        sig: parsed.sig.toLowerCase(),
      };
    }
    return null;
  } catch {
    return null;
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return fail("Phương thức không được hỗ trợ", 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const authHeader = req.headers.get("Authorization") ?? "";
  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const {
    data: { user },
  } = await userClient.auth.getUser();
  if (!user) return fail("Bạn cần đăng nhập để thực hiện", 401, "UNAUTHORIZED");

  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
  const { data: me } = await admin
    .from("profiles")
    .select("id, full_name, student_code, role, is_active, academic_status")
    .eq("id", user.id)
    .maybeSingle();

  if (!me || !me.is_active) {
    return fail("Tài khoản không tồn tại hoặc đã bị khóa", 403, "ACCOUNT_INACTIVE");
  }

  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    return fail("Dữ liệu gửi lên không hợp lệ");
  }

  const action = String(body.action ?? "");

  // Helper kiểm tra quyền giảng viên / hiệu trưởng phụ trách buổi điểm danh
  async function verifySessionManager(sessionId: string) {
    const { data: attSession, error: sErr } = await admin
      .from("attendance_sessions")
      .select("id, class_id, title, session_date, subject")
      .eq("id", sessionId)
      .maybeSingle();

    if (sErr || !attSession) {
      return { ok: false as const, status: 404, message: "Không tìm thấy buổi điểm danh" };
    }

    const { data: cls } = await admin
      .from("classes")
      .select("id, name, teacher_id")
      .eq("id", attSession.class_id)
      .maybeSingle();

    if (!cls) {
      return { ok: false as const, status: 404, message: "Không tìm thấy lớp học" };
    }

    if (me!.role === "admin") {
      return { ok: true as const, attSession, cls };
    }

    if (me!.role !== "teacher") {
      return { ok: false as const, status: 403, message: "Chỉ giảng viên mới được điều khiển QR điểm danh" };
    }

    if (cls.teacher_id === user!.id) {
      return { ok: true as const, attSession, cls };
    }

    const { data: subTeacher } = await admin
      .from("class_teachers")
      .select("id")
      .eq("class_id", cls.id)
      .eq("teacher_id", user!.id)
      .limit(1)
      .maybeSingle();

    if (!subTeacher) {
      return {
        ok: false as const,
        status: 403,
        message: "Bạn không được phân công giảng dạy lớp này",
      };
    }

    return { ok: true as const, attSession, cls };
  }

  // 1. Giảng viên bắt đầu (hoặc mở lại) phiên chiếu QR động
  if (action === "start") {
    const sessionId = String(body.session_id ?? "").trim();
    if (!sessionId) return fail("Thiếu mã buổi điểm danh (session_id)");

    const authCheck = await verifySessionManager(sessionId);
    if (!authCheck.ok) return fail(authCheck.message, authCheck.status);

    const rawLateMinutes = Number(body.late_after_minutes ?? 15);
    const lateAfterMinutes = Number.isFinite(rawLateMinutes)
      ? Math.min(180, Math.max(1, Math.round(rawLateMinutes)))
      : 15;

    // Kiểm tra xem buổi này đã từng mở phiên QR hoặc đã có SV nào quét QR chưa
    const [{ data: existingQrSession }, { count: existingQrCheckinCount }] = await Promise.all([
      admin
        .from("attendance_qr_sessions")
        .select("session_id, secret_key, is_active, started_at, expires_at, late_after_minutes")
        .eq("session_id", sessionId)
        .maybeSingle(),
      admin
        .from("attendance_records")
        .select("id", { count: "exact", head: true })
        .eq("session_id", sessionId)
        .eq("checkin_method", "qr"),
    ]);

    const secretKey = existingQrSession?.secret_key || randomHex(32);
    const now = new Date();
    const startedAt =
      existingQrSession && (existingQrCheckinCount ?? 0) > 0
        ? existingQrSession.started_at
        : now.toISOString();
    const expiresAt = new Date(now.getTime() + DEFAULT_SESSION_DURATION_MINUTES * 60_000);

    const { error: upErr } = await admin.from("attendance_qr_sessions").upsert(
      {
        session_id: sessionId,
        class_id: authCheck.cls.id,
        teacher_id: user.id,
        secret_key: secretKey,
        is_active: true,
        late_after_minutes: lateAfterMinutes,
        started_at: startedAt,
        expires_at: expiresAt.toISOString(),
        closed_at: null,
        updated_at: now.toISOString(),
      },
      { onConflict: "session_id" }
    );

    if (upErr) return fail(`Không khởi tạo được phiên QR: ${upErr.message}`, 500);

    // Chỉ chuyển các bản ghi mặc định 'present' (manual, chưa có ghi chú) sang 'absent' ở lần mở QR đầu tiên
    // Giữ nguyên 100% kết quả của những sinh viên đã quét QR trước đó nếu thầy cô lỡ đóng cửa sổ rồi mở lại
    if ((existingQrCheckinCount ?? 0) === 0) {
      await admin
        .from("attendance_records")
        .update({
          status: "absent",
          updated_at: now.toISOString(),
        })
        .eq("session_id", sessionId)
        .eq("checkin_method", "manual")
        .eq("status", "present")
        .is("note", null);
    }

    const minted = await mintRotatingToken(sessionId, secretKey);

    return json({
      ok: true,
      sessionId,
      classId: authCheck.cls.id,
      className: authCheck.cls.name,
      sessionTitle: authCheck.attSession.title,
      qrToken: minted.token,
      issuedAt: minted.payload.ts,
      rotateIntervalMs: 15_000,
      tokenMaxAgeMs: TOKEN_MAX_AGE_MS,
      lateAfterMinutes,
      expiresAt: expiresAt.toISOString(),
    });
  }

  // 2. Giảng viên xin mã QR xoay mới mỗi 15 giây
  if (action === "rotate") {
    const sessionId = String(body.session_id ?? "").trim();
    if (!sessionId) return fail("Thiếu mã buổi điểm danh (session_id)");

    const authCheck = await verifySessionManager(sessionId);
    if (!authCheck.ok) return fail(authCheck.message, authCheck.status);

    const { data: qrSession } = await admin
      .from("attendance_qr_sessions")
      .select("session_id, secret_key, is_active, expires_at, late_after_minutes")
      .eq("session_id", sessionId)
      .maybeSingle();

    if (!qrSession || !qrSession.is_active) {
      return fail("Phiên điểm danh QR đã kết thúc", 410, "SESSION_CLOSED");
    }

    if (Date.parse(qrSession.expires_at) <= Date.now()) {
      await admin
        .from("attendance_qr_sessions")
        .update({ is_active: false, closed_at: new Date().toISOString() })
        .eq("session_id", sessionId);
      return fail("Phiên điểm danh QR đã hết thời gian mở", 410, "SESSION_EXPIRED");
    }

    const minted = await mintRotatingToken(sessionId, qrSession.secret_key);

    return json({
      ok: true,
      sessionId,
      qrToken: minted.token,
      issuedAt: minted.payload.ts,
      rotateIntervalMs: 15_000,
      tokenMaxAgeMs: TOKEN_MAX_AGE_MS,
    });
  }

  // 3. Giảng viên đóng vĩnh viễn phiên QR
  if (action === "stop") {
    const sessionId = String(body.session_id ?? "").trim();
    if (!sessionId) return fail("Thiếu mã buổi điểm danh (session_id)");

    const authCheck = await verifySessionManager(sessionId);
    if (!authCheck.ok) return fail(authCheck.message, authCheck.status);

    const nowIso = new Date().toISOString();
    await admin
      .from("attendance_qr_sessions")
      .update({
        is_active: false,
        closed_at: nowIso,
        updated_at: nowIso,
      })
      .eq("session_id", sessionId);

    return json({ ok: true, sessionId, closedAt: nowIso });
  }

  // 4. Sinh viên quét mã QR gửi lên để điểm danh
  if (action === "checkin") {
    if (me.role !== "student") {
      return fail("Chỉ tài khoản sinh viên mới thực hiện quét mã điểm danh", 403, "NOT_STUDENT");
    }

    const rawToken = String(body.token ?? "").trim();
    const deviceId = String(body.device_id ?? "").trim();
    const parsed = parseTokenPayload(rawToken);
    if (!parsed) {
      return fail(
        "Mã QR không hợp lệ hoặc không thuộc hệ thống điểm danh APC Connect.",
        400,
        "INVALID_QR"
      );
    }

    // Kiểm tra 1: Thời hạn của mã QR (chấp nhận cả mã đang hiện trên bảng 15s lẫn mã vừa xoay xong đang bay trên mạng 3G/4G)
    const nowMs = Date.now();
    const ageMs = nowMs - parsed.ts;
    if (ageMs < -CLOCK_DRIFT_TOLERANCE_MS || ageMs > TOKEN_MAX_AGE_MS + NETWORK_LAG_GRACE_MS) {
      return fail(
        "Mã QR đã hết hạn, vui lòng nhìn lên bảng quét mã mới!",
        410,
        "QR_EXPIRED"
      );
    }

    // Tra cứu phiên QR đang mở
    const { data: qrSession } = await admin
      .from("attendance_qr_sessions")
      .select(
        "session_id, class_id, teacher_id, secret_key, is_active, late_after_minutes, started_at, expires_at"
      )
      .eq("session_id", parsed.sid)
      .maybeSingle();

    if (!qrSession || !qrSession.is_active || Date.parse(qrSession.expires_at) <= nowMs) {
      return fail(
        "Phiên điểm danh QR đã đóng hoặc hết giờ. Vui lòng báo giảng viên!",
        410,
        "SESSION_CLOSED"
      );
    }

    // Kiểm tra 2: Chữ ký HMAC-SHA256 (hỗ trợ cả chữ ký rút gọn 24 hex và 64 hex đầy đủ)
    const fullExpectedSig = await hmacSha256Hex(
      qrSession.secret_key,
      `${parsed.sid}.${parsed.ts}.${parsed.nonce}`
    );
    const expectedSig =
      parsed.sig.length === 24 ? fullExpectedSig.slice(0, 24) : fullExpectedSig;
    if (!timingSafeEqualHex(expectedSig, parsed.sig)) {
      return fail(
        "Chữ ký bảo mật mã QR không hợp lệ, vui lòng nhìn lên bảng quét lại!",
        403,
        "INVALID_SIGNATURE"
      );
    }

    // Kiểm tra 3: Sinh viên có thuộc danh sách lớp của buổi học này không?
    const { data: enrollment } = await admin
      .from("enrollments")
      .select("id")
      .eq("class_id", qrSession.class_id)
      .eq("student_id", user.id)
      .maybeSingle();

    if (!enrollment) {
      return fail(
        "Tài khoản của bạn không nằm trong danh sách lớp của buổi học này.",
        403,
        "NOT_IN_CLASS"
      );
    }

    // Kiểm tra 4: Sinh viên đã điểm danh trong phiên này chưa?
    const { data: existingTokenRow } = await admin
      .from("attendance_qr_used_tokens")
      .select("id, created_at")
      .eq("session_id", qrSession.session_id)
      .eq("student_id", user.id)
      .maybeSingle();

    if (existingTokenRow) {
      return fail(
        "Bạn đã điểm danh thành công trong buổi học này rồi!",
        409,
        "ALREADY_CHECKED_IN"
      );
    }

    const { data: existingRecord } = await admin
      .from("attendance_records")
      .select("id, status, checkin_method, checkin_time")
      .eq("session_id", qrSession.session_id)
      .eq("student_id", user.id)
      .maybeSingle();

    if (
      existingRecord &&
      existingRecord.checkin_method === "qr" &&
      (existingRecord.status === "present" || existingRecord.status === "late")
    ) {
      return fail(
        "Bạn đã điểm danh thành công trong buổi học này rồi!",
        409,
        "ALREADY_CHECKED_IN"
      );
    }

    // Kiểm tra 5: Chống 1 thiết bị đăng nhập nhiều nick điểm danh hộ & chống replay
    // Lưu ý: Cả lớp dùng chung Wi-Fi trường sẽ có cùng clientIp (NAT), nên:
    // - Chỉ chặn cứng (Bài 2) khi trùng mã định danh thiết bị thực (deviceId lưu trên máy >= 16 ký tự).
    // - Nếu trình duyệt chặn localStorage (không có deviceId riêng) mà trùng IP + User-Agent cùng dòng máy,
    //   chỉ gắn cờ cảnh báo mềm (Bài 1 - Soft-flag) vào ghi chú để giảng viên kiểm tra, tuyệt đối không chặn nhầm Wi-Fi trường!
    const forwardedFor = req.headers.get("x-forwarded-for") ?? "";
    const clientIp = forwardedFor.split(",")[0]?.trim() || "unknown";
    const userAgent = (req.headers.get("user-agent") ?? "unknown").slice(0, 300);
    const hasUniqueDeviceToken = deviceId.length >= 16 && deviceId !== "web-client";
    const deviceHash = hasUniqueDeviceToken
      ? await sha256Hex(`dev::${deviceId}::${userAgent}`)
      : await sha256Hex(`ipua::${clientIp}::${userAgent}`);

    const { data: sameDeviceRow } = await admin
      .from("attendance_qr_used_tokens")
      .select("student_id")
      .eq("session_id", qrSession.session_id)
      .eq("device_hash", deviceHash)
      .neq("student_id", user.id)
      .limit(1)
      .maybeSingle();

    let softSuspiciousFlag = false;
    if (sameDeviceRow) {
      if (hasUniqueDeviceToken) {
        return fail(
          "Thiết bị này đã điểm danh cho một tài khoản khác trong buổi học này (chống điểm danh hộ)!",
          403,
          "DEVICE_ALREADY_USED"
        );
      }
      softSuspiciousFlag = true;
    }

    const tokenHash = await sha256Hex(`${parsed.sig}::${user.id}`);
    const nowIso = new Date(nowMs).toISOString();

    const { error: tokenInsErr } = await admin.from("attendance_qr_used_tokens").insert({
      session_id: qrSession.session_id,
      student_id: user.id,
      token_hash: tokenHash,
      device_hash: deviceHash,
      client_ip: clientIp,
      user_agent: userAgent,
      created_at: nowIso,
    });

    if (tokenInsErr) {
      return fail(
        "Mã điểm danh đã được sử dụng hoặc bạn đã điểm danh trước đó.",
        409,
        "REPLAY_BLOCKED"
      );
    }

    // Tính trạng thái Có mặt ('present') hoặc Đi muộn ('late')
    const startedMs = Date.parse(qrSession.started_at);
    const lateThresholdMs = qrSession.late_after_minutes * 60_000;
    const status: "present" | "late" =
      Number.isFinite(startedMs) && nowMs - startedMs > lateThresholdMs ? "late" : "present";

    const baseNote = status === "late" ? "Quét QR động (Đi muộn)" : "Quét QR động";
    const finalNote = softSuspiciousFlag
      ? `${baseNote} · [Cảnh báo: Trùng mạng & dòng máy, cần kiểm tra]`
      : baseNote;

    const { error: recErr } = await admin.from("attendance_records").upsert(
      {
        session_id: qrSession.session_id,
        student_id: user.id,
        status,
        note: finalNote,
        marked_by: qrSession.teacher_id,
        checkin_time: nowIso,
        checkin_method: "qr",
        client_ip: clientIp,
        user_agent: userAgent,
        device_hash: deviceHash,
        updated_at: nowIso,
      },
      { onConflict: "session_id,student_id" }
    );

    if (recErr) {
      return fail(`Không lưu được kết quả điểm danh: ${recErr.message}`, 500);
    }

    const [{ data: cls }, { data: attSession }] = await Promise.all([
      admin.from("classes").select("name").eq("id", qrSession.class_id).maybeSingle(),
      admin
        .from("attendance_sessions")
        .select("title, session_date, subject")
        .eq("id", qrSession.session_id)
        .maybeSingle(),
    ]);

    return json({
      ok: true,
      status,
      checkinTime: nowIso,
      studentName: me.full_name,
      studentCode: me.student_code,
      className: cls?.name ?? "",
      sessionTitle: attSession?.title ?? "",
      subject: attSession?.subject ?? null,
    });
  }

  return fail("Hành động không hợp lệ");
});

