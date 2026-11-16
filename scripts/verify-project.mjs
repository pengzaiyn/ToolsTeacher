import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const errors = [];

function walkFiles(dir, exts) {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...walkFiles(full, exts));
    } else if (exts.some((ext) => entry.name.endsWith(ext))) {
      out.push(full);
    }
  }
  return out;
}

// 1. Kiểm tra không lộ service role key hoặc mật khẩu mặc định vào frontend src/
const srcFiles = walkFiles(path.join(root, 'src'), ['.ts', '.tsx']);
const forbiddenFrontendPatterns = [
  { regex: /SUPABASE_SERVICE_ROLE_KEY/i, label: 'SUPABASE_SERVICE_ROLE_KEY trong src/' },
  { regex: /service_role/i, label: 'chuỗi service_role trong src/' },
  { regex: /123@123a/, label: 'mật khẩu mặc định trong src/' },
];

for (const file of srcFiles) {
  const content = fs.readFileSync(file, 'utf8');
  for (const check of forbiddenFrontendPatterns) {
    if (check.regex.test(content)) {
      errors.push(`[Bảo mật] Phát hiện ${check.label}: ${path.relative(root, file)}`);
    }
  }
}

// 2. Kiểm tra migration SQL thuần không chứa BEGIN/COMMIT/ROLLBACK riêng lẻ
const migrationFiles = walkFiles(path.join(root, 'supabase', 'migrations'), ['.sql']);
for (const file of migrationFiles) {
  const content = fs.readFileSync(file, 'utf8');
  if (/^\s*(BEGIN|COMMIT|ROLLBACK)\s*;/im.test(content)) {
    errors.push(
      `[Migration] Không dùng BEGIN/COMMIT/ROLLBACK trong file migration: ${path.relative(root, file)}`
    );
  }
}

if (errors.length > 0) {
  console.error('Kiểm tra dự án thất bại:');
  for (const err of errors) console.error(` - ${err}`);
  process.exit(1);
}

console.log(
  `[verify-project] Đạt: ${srcFiles.length} file frontend sạch secret, ${migrationFiles.length} file migration hợp lệ.`
);

