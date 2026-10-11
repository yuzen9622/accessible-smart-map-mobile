/** 自訂收藏分類沒有預先指定的顏色；用名字算一個固定色票索引，同一個分類名字在任何裝置上
 * 永遠是同一個顏色（不依賴建立順序，重灌或換裝置後顏色不會跳）。 */
const CUSTOM_CATEGORY_PALETTE = ['#7048E8', '#0F9960', '#C2255C', '#946200', '#1864AB', '#087F5B'] as const;

export function customCategoryColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) | 0;
  }
  const index = Math.abs(hash) % CUSTOM_CATEGORY_PALETTE.length;
  return CUSTOM_CATEGORY_PALETTE[index];
}
