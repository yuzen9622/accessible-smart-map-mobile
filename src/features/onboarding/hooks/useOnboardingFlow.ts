import { router } from 'expo-router';
import { useState } from 'react';
import { AccessibilityInfo } from 'react-native';

import { applyDefaultFacilityCategories, useUserLocationStore } from '@/features/map';
import { useAppTranslation } from '@/shared/i18n';
import { getLocationPort } from '@/shared/location';
import { logger } from '@/shared/logger';
import { useCloseScreen } from '@/shared/navigation';

import {
  A11Y_SITUATIONS,
  ROUTE_MODE_LABEL_KEY,
  defaultFacilityCategories,
  type A11ySituation,
} from '../domain/a11yProfile';
import { useOnboardingStore } from '../store/onboardingStore';

export const ONBOARDING_STEP_IDS = ['intro', 'needs', 'location', 'done'] as const;
export type OnboardingStepId = (typeof ONBOARDING_STEP_IDS)[number];

export type LocationRequestState = 'idle' | 'requesting' | 'granted' | 'denied' | 'unsupported';

export interface SituationOption {
  id: A11ySituation;
  label: string;
  description: string;
  selected: boolean;
}

/**
 * Onboarding lite 的畫面邏輯：4 步驟的 step 狀態、輪廓輸入、定位權限請求與完成／略過
 * 的收尾動作。對齊 `features/map/hooks/useNearbyViewModel.ts` 的「view-model hook ＋
 * 純呈現用 4 檔元件」分工——這個 hook 不畫任何東西，只回傳畫面需要的資料與 callback。
 *
 * 移植來源：taipei-accessible-map `src/components/Onboarding/OnboardingFlow.tsx`（commit
 * 5eadc71）。與 Web 的差異：
 * - Done 步驟拿掉「找廁所／規劃路線／問 AI」三個快捷卡片——那三個分別要跳進路線規劃、
 *   AI 聊天功能，這兩個 feature 在本 App 都還沒實作（Phase 1.4 只做 onboarding lite），
 *   硬接會導到不存在的路由。Done 步驟只保留「完成」這個唯一動作。
 * - 沒有 `dismissWelcomeCard`／`coachMarks`：Web 版首頁還有歡迎卡與三步驟聚光燈導覽，
 *   本 App 首頁（`app/index.tsx`）目前只有地圖本體，沒有對應的 UI 可以聯動。
 * - 定位狀態少了 Web 版靠 `navigator.geolocation` 存在與否判斷的 `unsupported`
 *   分支；原生透過 `LocationPort` 呼叫失敗（例如裝置沒有定位硬體）才會落到這個狀態。
 */
export function useOnboardingFlow() {
  const { t } = useAppTranslation();
  const closeScreen = useCloseScreen();
  const [stepIndex, setStepIndex] = useState(0);
  const [locationState, setLocationState] = useState<LocationRequestState>('idle');

  const situations = useOnboardingStore((state) => state.profile.situations);
  const routeMode = useOnboardingStore((state) => state.profile.routeMode);
  const toggleSituation = useOnboardingStore((state) => state.toggleSituation);
  const completeOnboarding = useOnboardingStore((state) => state.completeOnboarding);
  const skipOnboarding = useOnboardingStore((state) => state.skipOnboarding);
  const setLocationPermission = useUserLocationStore((state) => state.setPermission);

  const lastStep = ONBOARDING_STEP_IDS.length - 1;

  const goBack = () => {
    setStepIndex((current) => Math.max(0, current - 1));
  };

  const goNext = () => {
    setStepIndex((current) => Math.min(lastStep, current + 1));
  };

  const handleSkip = () => {
    // 寫 skipped 記錄本身就是唯一該做的事：這個畫面是 modal，寫完自己 pop 掉即可，
    // 不需要另外有人監看 store 再幫忙關閉（對齊 Web 版 OnboardingHost 靠 record 觸發卸載
    // 的邏輯，只是本 App 用 router 取代條件渲染）。
    skipOnboarding();
    closeScreen();
  };

  /**
   * 只在使用者真的選了 situation、且地圖篩選還沒被動過時套用預設類別——略過導覽或
   * 什麼都沒答都不該在背後偷偷打開篩選。對齊 Web `applyDefaultFacilityFilter`。
   */
  const applyDefaultFilter = () => {
    if (situations.length === 0) return;
    applyDefaultFacilityCategories(defaultFacilityCategories(situations));
  };

  const finish = () => {
    applyDefaultFilter();
    completeOnboarding();
    closeScreen();
  };

  /** 完成引導並直接打開附近設施清單（Web DoneStep 的「找附近的無障礙廁所」；路線與 AI 建議待 Phase 2／4） */
  const finishToNearby = () => {
    finish();
    router.navigate('/nearby');
  };

  const requestLocation = () => {
    setLocationState('requesting');
    const run = async () => {
      try {
        const status = await getLocationPort().requestForegroundPermission();
        setLocationPermission(status);
        const nextState: LocationRequestState = status === 'granted' ? 'granted' : 'denied';
        setLocationState(nextState);
        // 結果用文字播報，不能只靠顏色變化——被拒絕的權限也要讓看不到畫面的人理解狀態。
        AccessibilityInfo.announceForAccessibility(
          nextState === 'granted' ? t('onboarding.location.granted') : t('onboarding.location.denied'),
        );
      } catch (error) {
        logger.warn('[onboarding] location permission request failed', error);
        setLocationState('unsupported');
        AccessibilityInfo.announceForAccessibility(t('onboarding.location.unsupported'));
      }
    };
    void run();
  };

  const modeLabel = t(ROUTE_MODE_LABEL_KEY[routeMode]);

  const options: SituationOption[] = A11Y_SITUATIONS.map((id) => ({
    id,
    label: t(`onboarding.situation.${id}`),
    description: t(`onboarding.situation.${id}Desc`),
    selected: situations.includes(id),
  }));

  return {
    stepIndex,
    stepId: ONBOARDING_STEP_IDS[stepIndex],
    totalSteps: ONBOARDING_STEP_IDS.length,
    progressText: t('onboarding.stepOf', { current: stepIndex + 1, total: ONBOARDING_STEP_IDS.length }),
    canGoBack: stepIndex > 0,
    onBack: goBack,
    onSkip: handleSkip,

    intro: {
      title: t('onboarding.intro.title'),
      body: t('onboarding.intro.body'),
      startLabel: t('onboarding.intro.start'),
      browseLabel: t('onboarding.intro.browse'),
      onStart: goNext,
      onBrowse: handleSkip,
    },

    needs: {
      title: t('onboarding.needs.title'),
      subtitle: t('onboarding.needs.subtitle'),
      hint: t('onboarding.needs.hint'),
      nextLabel: t('onboarding.next'),
      options,
      onToggle: toggleSituation,
      derivedModeText:
        situations.length > 0 ? t('onboarding.needs.derivedMode', { mode: modeLabel }) : null,
      onNext: goNext,
    },

    location: {
      title: t('onboarding.location.title'),
      benefits: [
        t('onboarding.location.benefit1'),
        t('onboarding.location.benefit2'),
        t('onboarding.location.benefit3'),
      ],
      privacy: t('onboarding.location.privacy'),
      allowLabel: t('onboarding.location.allow'),
      requestingLabel: t('onboarding.location.requesting'),
      manualLabel: t('onboarding.location.manual'),
      nextLabel: t('onboarding.next'),
      state: locationState,
      outcomeText:
        locationState === 'granted'
          ? t('onboarding.location.granted')
          : locationState === 'denied'
            ? t('onboarding.location.denied')
            : locationState === 'unsupported'
              ? t('onboarding.location.unsupported')
              : null,
      onRequest: requestLocation,
      onNext: goNext,
    },

    done: {
      title: t('onboarding.done.title'),
      tryToiletLabel: t('onboarding.done.tryToilet'),
      onTryToilet: finishToNearby,
      startLabel: t('onboarding.done.start'),
      onStart: finish,
    },
  };
}

export type OnboardingViewModel = ReturnType<typeof useOnboardingFlow>;
