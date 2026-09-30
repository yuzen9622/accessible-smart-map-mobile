import { useNavigation } from 'expo-router';

/**
 * 關掉「呼叫者所在的這一頁」。全域 `router.back()` 退的是當下最上層的畫面：送出完成時使用者可能已先關掉
 * modal，或關閉鈕被連點兩下，就會退到底下的 sheet 面板。只在這頁仍在最上層時才返回。
 */
export function useCloseScreen(): () => void {
  const navigation = useNavigation();
  return () => {
    if (navigation.isFocused()) navigation.goBack();
  };
}
