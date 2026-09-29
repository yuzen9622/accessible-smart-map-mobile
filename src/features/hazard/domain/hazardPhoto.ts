/**
 * 通報照片規則，逐字移植自 Web `HazardReportPanel.tsx` 的 `validateHazardPhoto`（commit f82cda8）：
 * 先檢查類型、再檢查大小；前端上限 5MB（後端預設 10MB）。
 */
export const MAX_REPORT_PHOTO_SIZE_BYTES = 5 * 1024 * 1024;
export const ALLOWED_REPORT_PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];

export type PhotoValidation = { valid: true } | { valid: false; error: 'IMAGE_TOO_LARGE' | 'INVALID_IMAGE_TYPE' };

export function validateHazardPhoto(file: { size: number; type: string }): PhotoValidation {
  if (!ALLOWED_REPORT_PHOTO_TYPES.includes(file.type)) {
    return { valid: false, error: 'INVALID_IMAGE_TYPE' };
  }
  if (file.size > MAX_REPORT_PHOTO_SIZE_BYTES) {
    return { valid: false, error: 'IMAGE_TOO_LARGE' };
  }
  return { valid: true };
}

/**
 * 原生新增：選好的照片要不要先轉成 JPEG 壓縮。原圖（iPhone 預設 HEIC）通常 < 5MB 且帶 EXIF 拍攝時間，
 * 後端用它擋掉舊照片（EXIF_TOO_OLD，10 分鐘）——所以能原樣上傳就原樣上傳；只有超過 5MB、或類型不在
 * 白名單（例如 GIF）時才轉檔（轉檔會失去 EXIF，後端對沒有 EXIF 的照片放行，仍有 AI 影像驗證）。
 */
export function needsTranscode(file: { size: number | null; type: string | null }): boolean {
  if (!file.type || !ALLOWED_REPORT_PHOTO_TYPES.includes(file.type)) return true;
  return file.size === null || file.size > MAX_REPORT_PHOTO_SIZE_BYTES;
}

/** 由 MIME 決定上傳檔名的副檔名（後端依 MIME 驗證，檔名只是提示）。 */
export function photoFileName(type: string): string {
  const ext = type === 'image/png' ? 'png' : type === 'image/webp' ? 'webp' : type === 'image/heic' ? 'heic' : type === 'image/heif' ? 'heif' : 'jpg';
  return `hazard.${ext}`;
}
