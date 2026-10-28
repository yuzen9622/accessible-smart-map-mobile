import { createModifier } from '@expo/ui/swift-ui/modifiers';

/**
 * SwiftUI `.bold(isActive)`。跟 `bold()` 不同，關閉時 modifier 仍在陣列裡，切換不會讓
 * SwiftUI 重建子樹。尚未重建的 dev client 沒有註冊這個型別，@expo/ui 會直接略過（不加粗）。
 */
export const boldActive = (isActive: boolean) => createModifier('boldActive', { isActive });
