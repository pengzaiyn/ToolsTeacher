import { describe, expect, it } from 'vitest';
import {
  buildAnnouncementInsertPayload,
  canUserReceiveAnnouncement,
  getAnnouncementAudienceMeta,
  resolveAnnouncementTargetType,
} from '@/lib/announcements';

describe('announcements helpers', () => {
  it('resolveAnnouncementTargetType chuẩn hóa dữ liệu cũ và mới', () => {
    expect(resolveAnnouncementTargetType({ class_id: null })).toBe('all');
    expect(resolveAnnouncementTargetType({ class_id: 'cls-1' })).toBe('class');
    expect(resolveAnnouncementTargetType({ class_id: null, target_user_id: 'u-1' })).toBe('teacher');
    expect(
      resolveAnnouncementTargetType({ class_id: null, target_type: 'all_teachers' })
    ).toBe('all_teachers');
  });

  it('canUserReceiveAnnouncement lọc đúng quyền theo vai trò', () => {
    expect(canUserReceiveAnnouncement({ class_id: null, target_type: 'all' }, 's1', 'student')).toBe(
      true
    );
    expect(
      canUserReceiveAnnouncement({ class_id: null, target_type: 'all_teachers' }, 's1', 'student')
    ).toBe(false);
    expect(
      canUserReceiveAnnouncement({ class_id: null, target_type: 'all_teachers' }, 't1', 'teacher')
    ).toBe(true);
    expect(
      canUserReceiveAnnouncement(
        { class_id: null, target_type: 'teacher', target_user_id: 't1' },
        't2',
        'teacher'
      )
    ).toBe(false);
    expect(
      canUserReceiveAnnouncement(
        { class_id: null, target_type: 'teacher', target_user_id: 't1' },
        't1',
        'teacher'
      )
    ).toBe(true);
    expect(
      canUserReceiveAnnouncement(
        { class_id: null, target_type: 'teacher', target_user_id: 't1' },
        'a1',
        'admin'
      )
    ).toBe(true);
  });

  it('buildAnnouncementInsertPayload kiểm tra đủ ràng buộc cho 4 phạm vi', () => {
    const missingTitle = buildAnnouncementInsertPayload({
      targetType: 'all',
      title: '   ',
      content: 'abc',
      createdBy: 'admin-1',
    });
    expect(missingTitle.ok).toBe(false);

    const missingClass = buildAnnouncementInsertPayload({
      targetType: 'class',
      classId: '',
      title: 'TB lớp',
      content: '',
      createdBy: 'admin-1',
    });
    expect(missingClass.ok).toBe(false);

    const missingTeacher = buildAnnouncementInsertPayload({
      targetType: 'teacher',
      targetUserId: '',
      title: 'TB GV',
      content: '',
      createdBy: 'admin-1',
    });
    expect(missingTeacher.ok).toBe(false);

    const validSchool = buildAnnouncementInsertPayload({
      targetType: 'all',
      classId: 'should-be-ignored',
      targetUserId: 'should-be-ignored',
      title: '  Lịch nghỉ lễ  ',
      content: '  Nghỉ thứ Hai  ',
      createdBy: 'admin-1',
    });
    expect(validSchool).toEqual({
      ok: true,
      payload: {
        target_type: 'all',
        class_id: null,
        target_user_id: null,
        title: 'Lịch nghỉ lễ',
        content: 'Nghỉ thứ Hai',
        created_by: 'admin-1',
      },
    });

    const validTeacher = buildAnnouncementInsertPayload({
      targetType: 'teacher',
      targetUserId: 'teacher-9',
      title: 'Họp chuyên môn',
      content: '',
      createdBy: 'admin-1',
    });
    expect(validTeacher).toEqual({
      ok: true,
      payload: {
        target_type: 'teacher',
        class_id: null,
        target_user_id: 'teacher-9',
        title: 'Họp chuyên môn',
        content: null,
        created_by: 'admin-1',
      },
    });
  });

  it('getAnnouncementAudienceMeta hiển thị nhãn phù hợp', () => {
    expect(
      getAnnouncementAudienceMeta(
        { class_id: 'c1', target_type: 'class' },
        { className: 'UDPM24-01' }
      ).label
    ).toBe('Lớp UDPM24-01');
    expect(
      getAnnouncementAudienceMeta(
        { class_id: null, target_type: 'teacher', target_user_id: 't1' },
        { currentUserId: 't1', teacherName: 'Nguyễn Văn A' }
      ).label
    ).toBe('Gửi riêng bạn');
    expect(
      getAnnouncementAudienceMeta(
        { class_id: null, target_type: 'teacher', target_user_id: 't1' },
        { currentUserId: 'admin-1', teacherName: 'Nguyễn Văn A' }
      ).label
    ).toBe('GV: Nguyễn Văn A');
  });
});

