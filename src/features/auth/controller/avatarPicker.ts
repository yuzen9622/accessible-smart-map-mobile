import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';

/** 頭像固定裁成正方形，邊長壓到這個上限（夠清楚、檔案小，不需要原圖畫質）。 */
const AVATAR_EDGE = 512;

export interface AvatarPhoto {
  uri: string;
  type: string;
  name: string;
}

export type PickAvatarResult = { kind: 'ok'; photo: AvatarPhoto } | { kind: 'cancelled' };

/**
 * 從相簿選一張照片當頭像：系統 picker 內建裁剪（`allowsEditing` + 1:1），選完後再用
 * `expo-image-manipulator` 統一壓到 `AVATAR_EDGE`、轉 JPEG，確保上傳檔案小、格式一致
 * （不像 `hazard/controller/photoPicker.ts` 需要保留 EXIF／原圖畫質）。
 */
export async function pickAvatarPhoto(): Promise<PickAvatarResult> {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    quality: 1,
    allowsEditing: true,
    aspect: [1, 1],
    exif: false,
  });
  if (result.canceled || !result.assets[0]) return { kind: 'cancelled' };
  const asset = result.assets[0];

  const context = ImageManipulator.manipulate(asset.uri);
  if (asset.width > AVATAR_EDGE || asset.height > AVATAR_EDGE) {
    context.resize(asset.width >= asset.height ? { width: AVATAR_EDGE } : { height: AVATAR_EDGE });
  }
  const image = await context.renderAsync();
  const saved = await image.saveAsync({ compress: 0.85, format: SaveFormat.JPEG });
  return { kind: 'ok', photo: { uri: saved.uri, type: 'image/jpeg', name: 'avatar.jpg' } };
}
