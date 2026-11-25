import { describe, expect, it } from 'vitest';
import { maskCccd, maskPhone } from '@/lib/privacy';

describe('privacy masking helpers', () => {
  it('masks standard 10-digit Vietnamese phone numbers', () => {
    expect(maskPhone('0987654321')).toBe('098****321');
    expect(maskPhone('091234567')).toBe('091***567');
  });

  it('handles empty or short phone values safely', () => {
    expect(maskPhone('')).toBe('—');
    expect(maskPhone(null)).toBe('—');
    expect(maskPhone('1234')).toBe('****');
  });

  it('masks 12-digit CCCD numbers', () => {
    expect(maskCccd('001204012345')).toBe('001******345');
    expect(maskCccd(null)).toBe('—');
  });
});

