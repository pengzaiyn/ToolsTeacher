import { describe, expect, it } from 'vitest';
import {
  htmlToPlainText,
  isSafeImageDataUrl,
  plainTextToHtml,
  sanitizeExamHtml,
} from '@/lib/examRichText';

describe('examRichText sanitizer & converters', () => {
  it('preserves safe formatting tags and inline text styles', () => {
    const input =
      '<strong style="color:#C8102E;font-weight:bold">Câu hỏi</strong> <i>nghiêng</i> <u>gạch chân</u> H<sub>2</sub>O x<sup>2</sup> <span style="background-color:#FEF08A">nhấn</span>';
    const clean = sanitizeExamHtml(input);
    expect(clean).toContain('color:#C8102E');
    expect(clean).toContain('<i>nghiêng</i>');
    expect(clean).toContain('<u>gạch chân</u>');
    expect(clean).toContain('<sub>2</sub>');
    expect(clean).toContain('<sup>2</sup>');
    expect(clean).toContain('background-color:#FEF08A');
  });

  it('strips scripts, event handlers, and unsafe style values', () => {
    const dirty =
      '<div onclick="alert(1)" style="color:red;background-image:url(javascript:alert(2))">Nội dung<script>alert(3)</script><img src="x" onerror="alert(4)" /></div>';
    const clean = sanitizeExamHtml(dirty);
    expect(clean).not.toContain('<script');
    expect(clean).not.toContain('alert(');
    expect(clean).not.toContain('onclick');
    expect(clean).not.toContain('onerror');
    expect(clean).not.toContain('javascript:');
    expect(clean).toContain('Nội dung');
    expect(clean).toContain('color:red');
  });

  it('converts between plain text and safe HTML cleanly', () => {
    const html = plainTextToHtml('Dòng 1 <test>\nDòng 2');
    expect(html).toBe('Dòng 1 &lt;test&gt;<br/>Dòng 2');
    expect(htmlToPlainText(html)).toBe('Dòng 1 <test>\nDòng 2');
  });

  it('validates safe base64 image data URLs only', () => {
    expect(isSafeImageDataUrl('data:image/png;base64,iVBORw0KGgo=')).toBe(true);
    expect(isSafeImageDataUrl('data:image/jpeg;base64,/9j/4AAQ')).toBe(true);
    expect(isSafeImageDataUrl('data:image/svg+xml;base64,PHN2Zz4=')).toBe(false);
    expect(isSafeImageDataUrl('javascript:alert(1)')).toBe(false);
  });
});

