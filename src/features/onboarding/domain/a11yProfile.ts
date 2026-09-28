/**
 * 使用者的無障礙需求輪廓，在 onboarding 第一次跑時建立，之後可在設定中編輯。
 *
 * 故意分兩層：
 *
 * - `situations` 是實際問使用者的（六個複選項）。只影響前端行為：預設顯示哪些
 *   設施類別、地點詳情欄位怎麼排序、首頁提示什麼、AI 助理拿到什麼脈絡。
 * - `routeMode` 是後端路線 API（`POST /api/v1/a11y/accessible-route`）唯一接受
 *   的四值 enum，從 `situations` *推導* 出來——後端沒有「使用助行器」或「推嬰兒車」
 *   的概念——而且保留可覆寫，讓推導結果不會悄悄把人導錯路。
 *
 * 移植來源：taipei-accessible-map（Web）`src/types/a11yProfile.ts`（commit 5eadc71）。
 * 差異：拿掉 Web 專用的 `FACILITY_CATEGORY_TO_A11Y_ENUM`／`A11yEnum` 轉換、
 * `profileSummaryKeys`、`describeProfileForAssistant`、`checklistPriorityOrder`——
 * 這些屬於路線結果頁／AI 助理／地點詳情等尚未移植的 feature，onboarding lite 不需要。
 * `defaultFacilityCategories` 回傳的 `'elevator'|'ramp'|'toilet'` 字面剛好等於本
 * repo `features/map` 的 `PinnedFacilityCategory`，不需要額外的 enum 對照層。
 */

/** 對齊後端 accessible-route 請求的 `mode` 欄位。 */
export type A11yRouteMode = 'normal' | 'wheelchair' | 'elderly' | 'visual_impaired';

/** onboarding 第 2 步提供的六個選項。 */
export type A11ySituation = 'wheelchair' | 'walker' | 'vision' | 'slow' | 'stroller' | 'companion';

export const A11Y_SITUATIONS: A11ySituation[] = [
  'wheelchair',
  'walker',
  'vision',
  'slow',
  'stroller',
  'companion',
];

export interface A11yProfile {
  situations: A11ySituation[];
  /** 送給後端的 `mode`。 */
  routeMode: A11yRouteMode;
  /**
   * 為 true 時，`routeMode` 透過 `deriveRouteMode` 跟隨 `situations`。使用者手動
   * 選過模式後設為 false，讓他的選擇不會被之後對 `situations` 的編輯蓋掉。
   */
  routeModeAuto: boolean;
  /** 純前端的路線偏好；後端目前沒有對應欄位。 */
  avoidStairs: boolean;
  requireElevator: boolean;
  /**
   * 與 `routeModeAuto` 同樣的契約，只是對象是這兩個無障礙旗標：為 true 時跟隨
   * `situations`，所以取消勾選「輪椅」會正確放寬它們；手動開關其中一個旗標會
   * 把兩者都固定住。
   */
  stepFreeFlagsAuto: boolean;
}

export const DEFAULT_A11Y_PROFILE: A11yProfile = {
  situations: [],
  routeMode: 'normal',
  routeModeAuto: true,
  avoidStairs: false,
  requireElevator: false,
  stepFreeFlagsAuto: true,
};

/**
 * 把多選的 situations 收斂成後端唯一接受的一個 mode。
 *
 * 優先順序：先看無階梯需求，再看視覺，最後看步行速度。一個同時是輪椅使用者又
 * 視障的人會得到 `wheelchair`——有樓梯的路線對他完全走不了，而少了語音導引只是
 * 比較難走，物理限制必須優先。不同意推導結果的人可以覆寫，這就是 `routeModeAuto`
 * 存在的理由。
 */
export function deriveRouteMode(situations: A11ySituation[]): A11yRouteMode {
  if (
    situations.includes('wheelchair') ||
    situations.includes('walker') ||
    situations.includes('stroller')
  ) {
    return 'wheelchair';
  }
  if (situations.includes('vision')) return 'visual_impaired';
  if (situations.includes('slow')) return 'elderly';
  return 'normal';
}

/** 代表使用者完全無法走樓梯的 situations。 */
export function impliesStepFree(situations: A11ySituation[]): boolean {
  return (
    situations.includes('wheelchair') || situations.includes('walker') || situations.includes('stroller')
  );
}

/**
 * 依輪廓在地圖上預先勾選的設施類別。鍵值對齊 `features/map` 的
 * `PinnedFacilityCategory`（`elevator`／`ramp`／`toilet`）。
 */
export function defaultFacilityCategories(situations: A11ySituation[]): ('elevator' | 'ramp' | 'toilet')[] {
  if (situations.length === 0) return ['elevator', 'ramp', 'toilet'];
  const categories = new Set<'elevator' | 'ramp' | 'toilet'>();
  if (impliesStepFree(situations)) {
    categories.add('elevator');
    categories.add('ramp');
  }
  if (situations.includes('wheelchair') || situations.includes('slow')) {
    categories.add('toilet');
  }
  if (situations.includes('vision') || situations.includes('companion')) {
    categories.add('elevator');
    categories.add('toilet');
  }
  return categories.size > 0 ? [...categories] : ['elevator', 'ramp', 'toilet'];
}

/** 對應既有翻譯檔頂層 key（`normalMode`／`wheelchairMode`／`elderlyMode`／`visualImpairedMode`），供 needs 步驟顯示推導出的模式。 */
export const ROUTE_MODE_LABEL_KEY: Record<A11yRouteMode, string> = {
  normal: 'normalMode',
  wheelchair: 'wheelchairMode',
  elderly: 'elderlyMode',
  visual_impaired: 'visualImpairedMode',
};

const ALLOWED_SITUATIONS: readonly A11ySituation[] = A11Y_SITUATIONS;
const ALLOWED_MODES: readonly A11yRouteMode[] = ['normal', 'wheelchair', 'elderly', 'visual_impaired'];

/**
 * 只接受已知的 situation id，避免壞掉或降版後的資料把未知字串塞進輪廓、一路送到
 * 路線請求裡。後端 Zod schema 是 `.strict()`，壞資料會直接被拒絕，所以這裡要在
 * 讀出儲存資料時就先擋掉。
 */
export function sanitizeProfile(raw: unknown): A11yProfile {
  if (!raw || typeof raw !== 'object') return DEFAULT_A11Y_PROFILE;
  const value = raw as Partial<A11yProfile>;

  const situations = Array.isArray(value.situations)
    ? value.situations.filter((s): s is A11ySituation => ALLOWED_SITUATIONS.includes(s as A11ySituation))
    : [];

  const routeModeAuto = value.routeModeAuto !== false;
  const storedMode = ALLOWED_MODES.includes(value.routeMode as A11yRouteMode)
    ? (value.routeMode as A11yRouteMode)
    : null;
  const stepFreeFlagsAuto = value.stepFreeFlagsAuto !== false;
  const stepFree = impliesStepFree(situations);

  return {
    situations,
    // auto 輪廓永遠重新計算，舊版推導規則留下的過期 mode 不可能比現在的
    // `deriveRouteMode` 活得久。
    routeMode: routeModeAuto ? deriveRouteMode(situations) : (storedMode ?? deriveRouteMode(situations)),
    routeModeAuto,
    avoidStairs: stepFreeFlagsAuto ? stepFree : value.avoidStairs === true,
    requireElevator: stepFreeFlagsAuto ? stepFree : value.requireElevator === true,
    stepFreeFlagsAuto,
  };
}
