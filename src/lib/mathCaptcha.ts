export interface MathCaptchaChallenge {
  /** Chuỗi biểu thức hiển thị trên ảnh Canvas, ví dụ: "24 + 13 = ?" */
  expression: string;
  /** Đáp án số nguyên đúng */
  answer: number;
}

const CANVAS_WIDTH = 168;
const CANVAS_HEIGHT = 40;

function secureRandomInt(min: number, max: number): number {
  const span = max - min + 1;
  if (span <= 1) return min;

  if (typeof window !== 'undefined' && window.crypto?.getRandomValues) {
    const limit = Math.floor(0x100000000 / span) * span;
    const buffer = new Uint32Array(1);
    let value = 0;
    do {
      window.crypto.getRandomValues(buffer);
      value = buffer[0];
    } while (value >= limit);
    return min + (value % span);
  }

  return min + Math.floor(Math.random() * span);
}

function readCssColor(
  styles: CSSStyleDeclaration,
  varName: string,
  fallbackChannels: string,
  alpha?: number
): string {
  const raw = styles.getPropertyValue(varName).trim();
  const channels = raw || fallbackChannels;
  if (typeof alpha === 'number') {
    return `rgb(${channels} / ${alpha})`;
  }
  return `rgb(${channels})`;
}

/** Tạo một thử thách phép tính cộng/trừ đơn giản luôn cho kết quả nguyên dương */
export function createMathCaptcha(): MathCaptchaChallenge {
  const isAddition = secureRandomInt(0, 1) === 1;

  if (isAddition) {
    const a = secureRandomInt(10, 49);
    const b = secureRandomInt(10, 49);
    return {
      expression: `${a} + ${b} = ?`,
      answer: a + b,
    };
  }

  const a = secureRandomInt(20, 59);
  const b = secureRandomInt(10, a - 1);
  return {
    expression: `${a} - ${b} = ?`,
    answer: a - b,
  };
}

/** Kiểm tra chuỗi đáp án người dùng nhập có khớp giá trị đúng hay không */
export function verifyMathCaptcha(input: string, challenge: MathCaptchaChallenge): boolean {
  const normalized = input.trim();
  if (!/^-?\d+$/.test(normalized)) {
    return false;
  }
  return Number(normalized) === challenge.answer;
}

/** Vẽ phép tính CAPTCHA lên thẻ Canvas theo bảng màu biến CSS hiện tại */
export function drawMathCaptchaCanvas(
  canvas: HTMLCanvasElement,
  expression: string
): void {
  const ctx = canvas.getContext('2d');
  if (!ctx || typeof window === 'undefined') return;

  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const targetW = CANVAS_WIDTH * dpr;
  const targetH = CANVAS_HEIGHT * dpr;
  if (canvas.width !== targetW || canvas.height !== targetH) {
    canvas.width = targetW;
    canvas.height = targetH;
  }

  ctx.save();
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

  const styles = window.getComputedStyle(document.documentElement);
  const bgColor = readCssColor(styles, '--color-surface-subtle', '241 245 249');
  const inkPrimary = readCssColor(styles, '--color-ink-primary', '15 23 42');
  const brandNavy = readCssColor(styles, '--color-brand-navy-accent', '26 54 93');
  const brandRed = readCssColor(styles, '--color-brand-red-accent', '200 16 46');
  const lineSoft = readCssColor(styles, '--color-line-strong', '203 213 225', 0.85);
  const curveNavy = readCssColor(styles, '--color-brand-navy-accent', '26 54 93', 0.25);
  const dotRed = readCssColor(styles, '--color-brand-red-accent', '200 16 46', 0.28);
  const dotInk = readCssColor(styles, '--color-ink-muted', '100 116 139', 0.35);

  // Nền
  ctx.fillStyle = bgColor;
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

  // Các đường cong nhiễu nhẹ
  for (let i = 0; i < 3; i += 1) {
    ctx.beginPath();
    ctx.strokeStyle = i % 2 === 0 ? lineSoft : curveNavy;
    ctx.lineWidth = 1.25;
    const startY = secureRandomInt(6, CANVAS_HEIGHT - 6);
    const cp1X = secureRandomInt(28, 70);
    const cp1Y = secureRandomInt(2, CANVAS_HEIGHT - 2);
    const cp2X = secureRandomInt(90, 140);
    const cp2Y = secureRandomInt(2, CANVAS_HEIGHT - 2);
    const endY = secureRandomInt(6, CANVAS_HEIGHT - 6);
    ctx.moveTo(0, startY);
    ctx.bezierCurveTo(cp1X, cp1Y, cp2X, cp2Y, CANVAS_WIDTH, endY);
    ctx.stroke();
  }

  // Các hạt chấm nhiễu nền
  for (let i = 0; i < 22; i += 1) {
    ctx.fillStyle = i % 3 === 0 ? dotRed : dotInk;
    ctx.beginPath();
    ctx.arc(
      secureRandomInt(4, CANVAS_WIDTH - 4),
      secureRandomInt(4, CANVAS_HEIGHT - 4),
      1.1,
      0,
      Math.PI * 2
    );
    ctx.fill();
  }

  // Vẽ từng ký tự theo bảng trọng số chỉ dùng 600 / 700
  const tokens = Array.from(expression);
  const palette = [inkPrimary, brandNavy, brandRed];
  const paddingX = 12;
  const usableWidth = CANVAS_WIDTH - paddingX * 2;
  const totalWeight = tokens.reduce((sum, ch) => sum + (ch === ' ' ? 0.5 : 1), 0);
  const unitWidth = usableWidth / Math.max(totalWeight, 1);

  ctx.textBaseline = 'middle';
  ctx.textAlign = 'center';

  let cursorX = paddingX;
  tokens.forEach((ch, idx) => {
    const slot = (ch === ' ' ? 0.5 : 1) * unitWidth;
    const centerX = cursorX + slot / 2;
    cursorX += slot;

    if (ch === ' ') return;

    const isOperatorOrSign = ch === '+' || ch === '-' || ch === '=' || ch === '?';
    const fontWeight = isOperatorOrSign ? '600' : '700';
    const angle = (secureRandomInt(-13, 13) * Math.PI) / 180;
    const offsetY = secureRandomInt(-2, 2);

    ctx.save();
    ctx.translate(centerX, CANVAS_HEIGHT / 2 + offsetY);
    ctx.rotate(angle);
    ctx.font = `${fontWeight} 18px Inter, system-ui, -apple-system, sans-serif`;
    ctx.fillStyle = isOperatorOrSign
      ? brandRed
      : palette[idx % 2 === 0 ? 0 : 1];
    ctx.fillText(ch, 0, 0);
    ctx.restore();
  });

  ctx.restore();
}

