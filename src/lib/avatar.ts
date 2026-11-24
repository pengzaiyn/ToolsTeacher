const MAX_RAW_AVATAR_BYTES = 10 * 1024 * 1024; // 10 MB
const MAX_AVATAR_SIZE_PX = 640;

export function isValidAvatarUrl(url: string | null | undefined): url is string {
  if (!url) return false;
  const trimmed = url.trim();
  return trimmed.startsWith('data:image/') || trimmed.startsWith('https://');
}

export async function resizeAvatarFileToDataUrl(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) {
    throw new Error('Vui lòng chọn tệp hình ảnh (JPG, PNG, WebP...).');
  }
  if (file.size > MAX_RAW_AVATAR_BYTES) {
    throw new Error('Ảnh quá lớn (tối đa 10 MB). Vui lòng chọn ảnh nhỏ hơn.');
  }

  const objectUrl = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('Không đọc được tệp ảnh này.'));
      el.src = objectUrl;
    });

    const natW = img.naturalWidth || img.width;
    const natH = img.naturalHeight || img.height;
    const side = Math.min(natW, natH);
    const sx = Math.max(0, (natW - side) / 2);
    const sy = Math.max(0, (natH - side) / 2);

    // Không phóng to ảnh gốc nhỏ hơn 640px để tránh bị vỡ/mờ
    const targetSize = Math.min(side, MAX_AVATAR_SIZE_PX);

    // Cắt vuông giữ nguyên độ nét gốc trước
    let currentCanvas = document.createElement('canvas');
    currentCanvas.width = side;
    currentCanvas.height = side;
    const initialCtx = currentCanvas.getContext('2d');
    if (!initialCtx) {
      throw new Error('Trình duyệt không hỗ trợ xử lý ảnh.');
    }
    initialCtx.imageSmoothingEnabled = true;
    initialCtx.imageSmoothingQuality = 'high';
    initialCtx.drawImage(img, sx, sy, side, side, 0, 0, side, side);

    // Hạ kích thước theo từng bước chia đôi (step-down) giúp giữ chi tiết sắc nét tối đa
    let currentSize = side;
    while (currentSize * 0.5 > targetSize) {
      const nextSize = Math.round(currentSize * 0.5);
      const stepCanvas = document.createElement('canvas');
      stepCanvas.width = nextSize;
      stepCanvas.height = nextSize;
      const stepCtx = stepCanvas.getContext('2d');
      if (!stepCtx) break;
      stepCtx.imageSmoothingEnabled = true;
      stepCtx.imageSmoothingQuality = 'high';
      stepCtx.drawImage(currentCanvas, 0, 0, currentSize, currentSize, 0, 0, nextSize, nextSize);
      currentCanvas = stepCanvas;
      currentSize = nextSize;
    }

    if (currentSize !== targetSize) {
      const finalCanvas = document.createElement('canvas');
      finalCanvas.width = targetSize;
      finalCanvas.height = targetSize;
      const finalCtx = finalCanvas.getContext('2d');
      if (finalCtx) {
        finalCtx.imageSmoothingEnabled = true;
        finalCtx.imageSmoothingQuality = 'high';
        finalCtx.drawImage(
          currentCanvas,
          0,
          0,
          currentSize,
          currentSize,
          0,
          0,
          targetSize,
          targetSize
        );
        currentCanvas = finalCanvas;
      }
    }

    let dataUrl = currentCanvas.toDataURL('image/webp', 0.95);
    if (!dataUrl.startsWith('data:image/webp')) {
      dataUrl = currentCanvas.toDataURL('image/jpeg', 0.95);
    }
    return dataUrl;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}
