import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { Platform } from 'react-native';

import { needsTranscode, photoFileName, validateHazardPhoto, type PhotoValidation } from '../domain/hazardPhoto';
import { getHazardPhotoCapturedAt, validateHazardPhotoAge, type PhotoAgeValidation } from '../domain/hazardPhotoAge';

/**
 * 拍照／從相簿選照片（SDD §6.9：`expo-image-picker`；超過上限才以 `expo-image-manipulator` 壓縮）。
 * `quality: 1` 讓 iOS 回傳原檔（預設 HEIC、保留 EXIF 拍攝時間），見 `needsTranscode`。
 */

export interface HazardPhoto {
  uri: string;
  type: string;
  name: string;
  size: number | null;
  capturedAt: number;
}

export type PickPhotoResult =
  | { kind: 'ok'; photo: HazardPhoto }
  | { kind: 'cancelled' }
  | { kind: 'denied' }
  | { kind: 'invalid'; error: Exclude<PhotoValidation | PhotoAgeValidation, { valid: true }>['error'] };

const MAX_EDGE = 2048;

async function transcode(asset: ImagePicker.ImagePickerAsset, capturedAt: number): Promise<HazardPhoto> {
  const context = ImageManipulator.manipulate(asset.uri);
  if (asset.width > MAX_EDGE || asset.height > MAX_EDGE) {
    context.resize(asset.width >= asset.height ? { width: MAX_EDGE } : { height: MAX_EDGE });
  }
  const image = await context.renderAsync();
  const saved = await image.saveAsync({ compress: 0.8, format: SaveFormat.JPEG });
  return { uri: saved.uri, type: 'image/jpeg', name: photoFileName('image/jpeg'), size: null, capturedAt };
}

export async function pickHazardPhoto(source: 'camera' | 'library'): Promise<PickPhotoResult> {
  // 相簿用系統 picker（iOS PHPicker／Android Photo Picker），不需要照片庫權限；只有相機要。
  if (source === 'camera') {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) return { kind: 'denied' };
  }
  const options: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 1, allowsEditing: false, exif: true };
  const cameraStartedAt = Date.now();
  const result = source === 'camera' ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options);
  if (result.canceled || !result.assets[0]) return { kind: 'cancelled' };
  const asset = result.assets[0];
  // 原生相機沒有 EXIF 時，以開啟時間保守計時，避免確認畫面停留太久仍被當成新照片。
  // Web 的 camera 仍可選檔，不能用這個替代時間放行。
  const capturedAt = getHazardPhotoCapturedAt(asset.exif)
    ?? (source === 'camera' && (Platform.OS === 'ios' || Platform.OS === 'android') ? cameraStartedAt : null);
  if (capturedAt === null) return { kind: 'invalid', error: 'PHOTO_TIME_UNAVAILABLE' };
  const ageValidation = validateHazardPhotoAge(capturedAt, Date.now());
  if (!ageValidation.valid) return { kind: 'invalid', error: ageValidation.error };
  const type = asset.mimeType ?? null;
  const size = asset.fileSize ?? null;
  if (!needsTranscode({ size, type }) && type) {
    const validation = validateHazardPhoto({ size: size ?? 0, type });
    if (!validation.valid) return { kind: 'invalid', error: validation.error };
    return { kind: 'ok', photo: { uri: asset.uri, type, name: photoFileName(type), size, capturedAt } };
  }
  const photo = await transcode(asset, capturedAt);
  const finalValidation = validateHazardPhotoAge(capturedAt, Date.now());
  return finalValidation.valid ? { kind: 'ok', photo } : { kind: 'invalid', error: finalValidation.error };
}
