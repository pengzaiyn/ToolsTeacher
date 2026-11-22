export interface KeyboardShortcutLike {
  key: string;
  code?: string;
  keyCode?: number;
  ctrlKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
  metaKey: boolean;
}

/**
 * Kiểm tra xem tổ hợp phím có thuộc nhóm mở DevTools / xem mã nguồn hay không.
 */
export function isBlockedDevToolsShortcut(event: KeyboardShortcutLike): boolean {
  const key = (event.key || '').toLowerCase();
  const code = (event.code || '').toLowerCase();

  // F12
  if (key === 'f12' || code === 'f12' || event.keyCode === 123) {
    return true;
  }

  // Windows / Linux: Ctrl+Shift+I / J / C / K
  if (event.ctrlKey && event.shiftKey && ['i', 'j', 'c', 'k'].includes(key)) {
    return true;
  }

  // macOS: Cmd+Option+I / J / C / U
  if (event.metaKey && event.altKey && ['i', 'j', 'c', 'u'].includes(key)) {
    return true;
  }

  // Xem mã nguồn trang: Ctrl+U (Windows/Linux) hoặc Cmd+U (macOS)
  if ((event.ctrlKey || event.metaKey) && !event.shiftKey && !event.altKey && key === 'u') {
    return true;
  }

  return false;
}

let installed = false;

/**
 * Chặn menu chuột phải và các phím tắt mở công cụ lập trình (F12, Ctrl+Shift+I/J/C, Ctrl+U...).
 */
export function installClientProtection(): () => void {
  if (typeof window === 'undefined' || installed) {
    return () => undefined;
  }

  const onContextMenu = (event: MouseEvent) => {
    event.preventDefault();
  };

  const onKeyDown = (event: KeyboardEvent) => {
    if (isBlockedDevToolsShortcut(event)) {
      event.preventDefault();
      event.stopPropagation();
    }
  };

  window.addEventListener('contextmenu', onContextMenu, { capture: true });
  window.addEventListener('keydown', onKeyDown, { capture: true });
  installed = true;

  return () => {
    window.removeEventListener('contextmenu', onContextMenu, { capture: true });
    window.removeEventListener('keydown', onKeyDown, { capture: true });
    installed = false;
  };
}
