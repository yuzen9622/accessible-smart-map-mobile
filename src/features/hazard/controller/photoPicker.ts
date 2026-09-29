import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';

import { needsTranscode, photoFileName, validateHazardPhoto, type PhotoValidation } from '../domain/hazardPhoto';

/**
 * 拍照／從相簿選照片（SDD §6.9：`expo-image-picker`；超過上限才以 `expo-image-manipulator` 壓縮）。
 * `quality: 1` 讓 iOS 回傳原檔（預設 HEIC、保留 EXIF 拍攝時間），見 `needsTranscode`。
 */

export interface HazardPhoto {
  uri: string;
  type: string;
  name: string;
  size: number | null;
}

export type PickPhotoResult =
  | { kind: 'ok'; photo: HazardPhoto }
  | { kind: 'cancelled' }
  | { kind: 'denied' }
  | { kind: 'invalid'; error: Exclude<PhotoValidation, { valid: true }>['error'] };

const MAX_EDGE = 2048;

async function transcode(asset: ImagePicker.ImagePickerAsset): Promise<HazardPhoto> {
  const context = ImageManipulator.manipulate(asset.uri);
  if (asset.width > MAX_EDGE || asset.height > MAX_EDGE) {
    context.resize(asset.width >= asset.height ? { width: MAX_EDGE } : { height: MAX_EDGE });
  }
  const image = await context.renderAsync();
  const saved = await image.saveAsync({ compress: 0.8, format: SaveFormat.JPEG });
  return { uri: saved.uri, type: 'image/jpeg', name: photoFileName('image/jpeg'), size: null };
}

export async function pickHazardPhoto(source: 'camera' | 'library'): Promise<PickPhotoResult> {
  // 相簿用系統 picker（iOS PHPicker／Android Photo Picker），不需要照片庫權限；只有相機要。
  if (source === 'camera') {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) return { kind: 'denied' };
  }
  const options: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 1, allowsEditing: false, exif: false };
  const result = source === 'camera' ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options);
  if (result.canceled || !result.assets[0]) return { kind: 'cancelled' };
  const asset = result.assets[0];
  const type = asset.mimeType ?? null;
  const size = asset.fileSize ?? null;
  if (!needsTranscode({ size, type }) && type) {
    const validation = validateHazardPhoto({ size: size ?? 0, type });
    if (!validation.valid) return { kind: 'invalid', error: validation.error };
    return { kind: 'ok', photo: { uri: asset.uri, type, name: photoFileName(type), size } };
  }
  return { kind: 'ok', photo: await transcode(asset) };
}
