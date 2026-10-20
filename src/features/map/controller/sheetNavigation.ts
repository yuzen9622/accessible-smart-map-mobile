/**
 * 非同步完成後才切的 sheet 面板（AI／語音路線、語音導航開始與結束、SOS 追蹤規劃）。
 * sheet 被 root modal（設定、登入、SOS…）蓋住時直接 `router.navigate` 會在 modal 上再推一個 `(sheet)`，
 * 而 root 的 `beforeRemove` 不讓任何 sheet 被移除：新 sheet 與底下的 modal 都關不掉。
 * 被蓋住時只留最後一次導向，等使用者關掉 modal、sheet 重新 focus 才執行，也不搶走使用者正在用的畫面。
 */
let sheetVisible = false;
let pending: (() => void) | null = null;

export const sheetNavigation = {
  whenVisible(navigate: () => void): void {
    if (sheetVisible) navigate();
    else pending = navigate;
  },
  /** 有導向還在等 sheet 露出（被蓋住期間要求的面板都還沒顯示過）。 */
  hasPending(): boolean {
    return pending !== null;
  },
  /** root layout 的 `(sheet)` focus／blur listener 回報。 */
  setVisible(visible: boolean): void {
    sheetVisible = visible;
    if (!visible || !pending) return;
    const navigate = pending;
    pending = null;
    navigate();
  },
};
