import { describe, expect, it } from 'vitest';
import { isBlockedDevToolsShortcut } from '@/lib/clientProtection';

const baseEvent = {
  key: '',
  code: '',
  keyCode: 0,
  ctrlKey: false,
  shiftKey: false,
  altKey: false,
  metaKey: false,
};

describe('isBlockedDevToolsShortcut', () => {
  it('chặn F12 và các phím tắt mở DevTools / xem mã nguồn', () => {
    expect(isBlockedDevToolsShortcut({ ...baseEvent, key: 'F12', keyCode: 123 })).toBe(true);
    expect(
      isBlockedDevToolsShortcut({ ...baseEvent, key: 'I', ctrlKey: true, shiftKey: true })
    ).toBe(true);
    expect(
      isBlockedDevToolsShortcut({ ...baseEvent, key: 'j', ctrlKey: true, shiftKey: true })
    ).toBe(true);
    expect(
      isBlockedDevToolsShortcut({ ...baseEvent, key: 'C', ctrlKey: true, shiftKey: true })
    ).toBe(true);
    expect(isBlockedDevToolsShortcut({ ...baseEvent, key: 'u', ctrlKey: true })).toBe(true);
    expect(
      isBlockedDevToolsShortcut({ ...baseEvent, key: 'i', metaKey: true, altKey: true })
    ).toBe(true);
  });

  it('không chặn các phím tắt soạn thảo thông thường', () => {
    expect(isBlockedDevToolsShortcut({ ...baseEvent, key: 'c', ctrlKey: true })).toBe(false);
    expect(isBlockedDevToolsShortcut({ ...baseEvent, key: 'v', ctrlKey: true })).toBe(false);
    expect(isBlockedDevToolsShortcut({ ...baseEvent, key: 'a', ctrlKey: true })).toBe(false);
    expect(isBlockedDevToolsShortcut({ ...baseEvent, key: 'i' })).toBe(false);
  });
});
