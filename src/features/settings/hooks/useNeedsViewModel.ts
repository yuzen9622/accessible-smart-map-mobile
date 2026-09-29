import { A11Y_SITUATIONS, ROUTE_MODE_LABEL_KEY, useOnboardingStore } from '@/features/onboarding';
import { useAppTranslation } from '@/shared/i18n';

/** 設定 → 無障礙需求：編輯 onboarding 建立的需求輪廓（同一個 store；登入時由 `useSettingsSync` 上傳）。 */
export function useNeedsViewModel() {
  const { t } = useAppTranslation();
  const profile = useOnboardingStore((s) => s.profile);
  const toggle = useOnboardingStore((s) => s.toggleSituation);
  return {
    title: t('onboarding.needs.title'),
    hint: t('onboarding.needs.hint'),
    options: A11Y_SITUATIONS.map((id) => ({
      id,
      label: t(`onboarding.situation.${id}`),
      description: t(`onboarding.situation.${id}Desc`),
      selected: profile.situations.includes(id),
      onToggle: () => toggle(id),
    })),
    derivedModeText: t('onboarding.needs.derivedMode', { mode: t(ROUTE_MODE_LABEL_KEY[profile.routeMode]) }),
  };
}

export type NeedsViewModel = ReturnType<typeof useNeedsViewModel>;
