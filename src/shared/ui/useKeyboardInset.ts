import { useEffect, useState } from 'react';
import { Dimensions, Keyboard, Platform, type KeyboardEvent } from 'react-native';

/**
 * iOS 鍵盤蓋住螢幕底部的高度（收起時為 0），讓貼底的輸入列墊高。
 *
 * 不用 `KeyboardAvoidingView`：它以 onLayout 的相對座標推算重疊，放在 modal sheet 裡要手填
 * `keyboardVerticalOffset`（sheet 上緣＋導覽列高，會隨機型與字級變）；填錯輸入列就被鍵盤蓋住。
 * modal sheet 的底緣就是螢幕底緣，所以「螢幕高 − 鍵盤上緣」就是要墊的量，不必知道畫面在哪。
 * Android 由系統 `adjustResize` 縮小視窗，回傳 0 避免重複墊高。
 */
export function useKeyboardInset(): number {
  const [inset, setInset] = useState(0);
  useEffect(() => {
    if (Platform.OS !== 'ios') return undefined;
    const update = (event: KeyboardEvent) => {
      // 與鍵盤同一條動畫曲線（KeyboardAvoidingView 也是這樣做）
      Keyboard.scheduleLayoutAnimation(event);
      setInset(Math.max(0, Dimensions.get('window').height - event.endCoordinates.screenY));
    };
    const subscription = Keyboard.addListener('keyboardWillChangeFrame', update);
    return () => subscription.remove();
  }, []);
  return inset;
}
