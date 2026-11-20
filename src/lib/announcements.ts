import type { BadgeTone } from '@/components/ui/Badge';
import type { Announcement, AnnouncementTargetType, UserRole } from '@/types/database';

export const ANNOUNCEMENT_TARGET_LABELS: Record<AnnouncementTargetType, string> = {
  all: 'Toàn trường',
  class: 'Riêng lớp',
  all_teachers: 'Toàn bộ giáo viên',
  teacher: 'Riêng giáo viên',
};

export function resolveAnnouncementTargetType(
  item: Pick<Announcement, 'target_type' | 'class_id' | 'target_user_id'>
): AnnouncementTargetType {
  if (
    item.target_type === 'all' ||
    item.target_type === 'class' ||
    item.target_type === 'all_teachers' ||
    item.target_type === 'teacher'
  ) {
    return item.target_type;
  }
  if (item.class_id) return 'class';
  if (item.target_user_id) return 'teacher';
  return 'all';
}

export function getAnnouncementAudienceMeta(
  item: Pick<Announcement, 'target_type' | 'class_id' | 'target_user_id'>,
  options?: {
    className?: string | null;
    teacherName?: string | null;
    currentUserId?: string | null;
  }
): { label: string; tone: BadgeTone; targetType: AnnouncementTargetType } {
  const targetType = resolveAnnouncementTargetType(item);

  if (targetType === 'class') {
    return {
      targetType,
      label: options?.className ? `Lớp ${options.className}` : 'Riêng lớp',
      tone: 'navy',
    };
  }

  if (targetType === 'all_teachers') {
    return {
      targetType,
      label: 'Toàn bộ giáo viên',
      tone: 'warning',
    };
  }

  if (targetType === 'teacher') {
    if (options?.currentUserId && item.target_user_id === options.currentUserId) {
      return {
        targetType,
        label: 'Gửi riêng bạn',
        tone: 'red',
      };
    }
    return {
      targetType,
      label: options?.teacherName ? `GV: ${options.teacherName}` : 'Riêng giáo viên',
      tone: 'red',
    };
  }

  return {
    targetType: 'all',
    label: 'Toàn trường',
    tone: 'success',
  };
}

export function canUserReceiveAnnouncement(
  item: Pick<Announcement, 'target_type' | 'class_id' | 'target_user_id'>,
  userId: string,
  role: UserRole
): boolean {
  if (role === 'admin') return true;
  const targetType = resolveAnnouncementTargetType(item);
  if (targetType === 'all') return true;
  if (targetType === 'all_teachers') return role === 'teacher';
  if (targetType === 'teacher') return item.target_user_id === userId;
  // targetType === 'class': RLS đã kiểm tra quyền truy cập lớp
  return true;
}

export interface BuildAnnouncementPayloadInput {
  targetType: AnnouncementTargetType;
  classId?: string | null;
  targetUserId?: string | null;
  title: string;
  content: string;
  createdBy: string;
}

export type BuildAnnouncementPayloadResult =
  | {
      ok: true;
      payload: {
        target_type: AnnouncementTargetType;
        class_id: string | null;
        target_user_id: string | null;
        title: string;
        content: string | null;
        created_by: string;
      };
    }
  | {
      ok: false;
      error: string;
    };

export function buildAnnouncementInsertPayload(
  input: BuildAnnouncementPayloadInput
): BuildAnnouncementPayloadResult {
  const cleanTitle = input.title.trim();
  if (!cleanTitle) {
    return { ok: false, error: 'Vui lòng nhập tiêu đề thông báo' };
  }

  const cleanContent = input.content.trim() || null;

  if (input.targetType === 'class') {
    const cid = input.classId?.trim() || null;
    if (!cid) {
      return { ok: false, error: 'Vui lòng chọn lớp học nhận thông báo' };
    }
    return {
      ok: true,
      payload: {
        target_type: 'class',
        class_id: cid,
        target_user_id: null,
        title: cleanTitle,
        content: cleanContent,
        created_by: input.createdBy,
      },
    };
  }

  if (input.targetType === 'teacher') {
    const uid = input.targetUserId?.trim() || null;
    if (!uid) {
      return { ok: false, error: 'Vui lòng chọn giáo viên nhận thông báo' };
    }
    return {
      ok: true,
      payload: {
        target_type: 'teacher',
        class_id: null,
        target_user_id: uid,
        title: cleanTitle,
        content: cleanContent,
        created_by: input.createdBy,
      },
    };
  }

  if (input.targetType === 'all_teachers') {
    return {
      ok: true,
      payload: {
        target_type: 'all_teachers',
        class_id: null,
        target_user_id: null,
        title: cleanTitle,
        content: cleanContent,
        created_by: input.createdBy,
      },
    };
  }

  return {
    ok: true,
    payload: {
      target_type: 'all',
      class_id: null,
      target_user_id: null,
      title: cleanTitle,
      content: cleanContent,
      created_by: input.createdBy,
    },
  };
}

