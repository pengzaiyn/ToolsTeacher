const DB_NAME = 'avc_custom_theme_db';
const DB_VERSION = 1;
const STORE_NAME = 'wallpapers';
const UPLOADED_WALLPAPER_KEY = 'user_uploaded_wallpaper';

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !('indexedDB' in window)) {
      reject(new Error('Trình duyệt không hỗ trợ IndexedDB'));
      return;
    }
    const request = window.indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Không mở được kho ảnh nền'));
  });
}

/**
 * Nén và thu gọn kích thước ảnh tải lên (trừ GIF động nhỏ hơn 4MB) để hiển thị mượt và tiết kiệm bộ nhớ.
 */
export async function prepareUploadedWallpaperDataUrl(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) {
    throw new Error('Vui lòng chọn tệp hình ảnh (PNG, JPG, WebP hoặc GIF).');
  }
  if (file.size > 15 * 1024 * 1024) {
    throw new Error('Ảnh quá lớn (tối đa 15MB). Vui lòng chọn ảnh nhẹ hơn.');
  }

  const rawDataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('Không thể đọc dữ liệu ảnh.'));
      }
    };
    reader.onerror = () => reject(new Error('Không thể đọc tệp ảnh.'));
    reader.readAsDataURL(file);
  });

  // Giữ nguyên GIF động nếu dung lượng hợp lý
  if (file.type === 'image/gif' && file.size <= 4 * 1024 * 1024) {
    return rawDataUrl;
  }

  return new Promise<string>((resolve) => {
    const img = new Image();
    img.onload = () => {
      const maxW = 1920;
      const maxH = 1080;
      let { width, height } = img;
      if (width <= maxW && height <= maxH && file.size <= 1.2 * 1024 * 1024) {
        resolve(rawDataUrl);
        return;
      }

      const ratio = Math.min(maxW / width, maxH / height, 1);
      width = Math.max(1, Math.round(width * ratio));
      height = Math.max(1, Math.round(height * ratio));

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(rawDataUrl);
        return;
      }
      ctx.drawImage(img, 0, 0, width, height);
      try {
        const compressed = canvas.toDataURL('image/webp', 0.86);
        resolve(compressed.startsWith('data:image/webp') ? compressed : canvas.toDataURL('image/jpeg', 0.86));
      } catch {
        resolve(rawDataUrl);
      }
    };
    img.onerror = () => resolve(rawDataUrl);
    img.src = rawDataUrl;
  });
}

export async function saveUploadedWallpaper(dataUrl: string): Promise<void> {
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).put(dataUrl, UPLOADED_WALLPAPER_KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error('Không lưu được ảnh nền'));
    });
    db.close();
  } catch {
    // Fallback an toàn vào sessionStorage nếu IndexedDB bị khóa trong chế độ riêng tư
    try {
      window.sessionStorage.setItem(UPLOADED_WALLPAPER_KEY, dataUrl);
    } catch {
      throw new Error('Trình duyệt đang chặn lưu ảnh cục bộ.');
    }
  }
}

export async function loadUploadedWallpaper(): Promise<string | null> {
  try {
    const db = await openDb();
    const result = await new Promise<string | null>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const req = tx.objectStore(STORE_NAME).get(UPLOADED_WALLPAPER_KEY);
      req.onsuccess = () => resolve(typeof req.result === 'string' ? req.result : null);
      req.onerror = () => reject(req.error);
    });
    db.close();
    if (result) return result;
  } catch {
    // Thử fallback sessionStorage bên dưới
  }
  try {
    return window.sessionStorage.getItem(UPLOADED_WALLPAPER_KEY);
  } catch {
    return null;
  }
}

export async function clearUploadedWallpaper(): Promise<void> {
  try {
    const db = await openDb();
    await new Promise<void>((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).delete(UPLOADED_WALLPAPER_KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
    db.close();
  } catch {
    // Bỏ qua nếu không mở được IndexedDB
  }
  try {
    window.sessionStorage.removeItem(UPLOADED_WALLPAPER_KEY);
  } catch {
    // Bỏ qua
  }
}
