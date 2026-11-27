import { describe, expect, it } from 'vitest';
import { isImageFile, isImageStoragePath } from '@/lib/classStorage';
import { canStudentModifySubmission, isAssignmentPastDue } from '@/lib/submissionDeadline';

describe('submissionDeadline', () => {
  const fixedNow = Date.parse('2026-11-27T14:00:00.000Z');

  it('treats null or empty due_date as unlimited (never past due)', () => {
    expect(isAssignmentPastDue(null, fixedNow)).toBe(false);
    expect(isAssignmentPastDue(undefined, fixedNow)).toBe(false);
    expect(isAssignmentPastDue('', fixedNow)).toBe(false);
    expect(canStudentModifySubmission(null, fixedNow)).toBe(true);
  });

  it('allows modifying submission before or exactly at due_date', () => {
    expect(canStudentModifySubmission('2026-11-27T15:00:00.000Z', fixedNow)).toBe(true);
    expect(canStudentModifySubmission('2026-11-27T14:00:00.000Z', fixedNow)).toBe(true);
  });

  it('blocks modifying or canceling submission once due_date has passed', () => {
    expect(isAssignmentPastDue('2026-11-27T13:59:59.000Z', fixedNow)).toBe(true);
    expect(canStudentModifySubmission('2026-11-27T13:59:59.000Z', fixedNow)).toBe(false);
  });

  it('detects image storage paths and image files accurately', () => {
    expect(isImageStoragePath('class1/user1/1700_bai-lam.jpg')).toBe(true);
    expect(isImageStoragePath('class1/user1/1700_anh.PNG')).toBe(true);
    expect(isImageStoragePath('class1/user1/1700_bao-cao.pdf')).toBe(false);
    expect(isImageFile({ name: 'photo.heic', type: '' })).toBe(true);
    expect(isImageFile({ name: 'capture', type: 'image/webp' })).toBe(true);
    expect(isImageFile({ name: 'doc.docx', type: 'application/vnd.openxmlformats' })).toBe(false);
  });
});

