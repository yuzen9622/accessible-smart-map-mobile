import { changeAppLanguage } from '@/shared/i18n';
import { useRouteSessionStore } from '../../store/routeSessionStore';
import { act, renderHook } from '@testing-library/react-native';
import { routePlanFixture } from '@/features/ai/domain/testing/routePlanFixture';
import { getAccessibleRoute } from '../../api/route';
import { applyAiRoutePlan, endRouteSession } from '../../controller/routeSessionPort';
import { useRoutePlanViewModel } from '../useRoutePlanViewModel';

jest.mock('@/features/map', () => jest.requireActual('@/features/navigation/controller/testing/fakeMap').mapModule);
jest.mock('expo-router', () => ({ router: { navigate: jest.fn() } }));
jest.mock('@/features/place', () => ({ useAutocomplete: () => ({ suggestions: [], loading: false, resetSession: jest.fn() }) }));
jest.mock('@/features/onboarding', () => ({
  useOnboardingStore: (select: (state: unknown) => unknown) => select({ profile: { routeMode: 'normal', avoidStairs: false, requireElevator: false } }),
}));
jest.mock('@/shared/i18n', () => ({
  __esModule: true,
  ...jest.requireActual('@/shared/i18n'),
  useAppTranslation: () => ({ t: (key: string) => key }),
}));
jest.mock('../../api/route', () => ({ getAccessibleRoute: jest.fn() }));

beforeEach(async () => { await changeAppLanguage('zh-TW'); endRouteSession(); jest.clearAllMocks(); });

it('stores locale in the result key but retains the selected route without automatic translation replanning', async () => {
  const plan = routePlanFixture();
  useRouteSessionStore.getState().setOrigin(plan.origin, 'Origin');
  useRouteSessionStore.getState().setDestination(plan.destination, 'Destination');
  jest.mocked(getAccessibleRoute).mockResolvedValue({ ok: true, status: 'success', code: 200, message: '', data: plan });
  const { result, rerender } = await renderHook(() => useRoutePlanViewModel({}));
  expect(useRouteSessionStore.getState().computedFor).toContain('language:zh-TW');
  expect(result.current.results?.routes).toEqual(plan.routes);
  const selected = useRouteSessionStore.getState().selectRoute;
  await act(async () => { await changeAppLanguage('en'); });
  await rerender({});
  expect(getAccessibleRoute).toHaveBeenCalledTimes(1);
  expect(useRouteSessionStore.getState().selectRoute).toBe(selected);
  expect(result.current.results?.routes).toEqual(plan.routes);
  await act(() => result.current.onStart());
  expect(getAccessibleRoute).toHaveBeenCalledTimes(2);
  expect(jest.mocked(getAccessibleRoute).mock.calls[1][0].language).toBe('en');
  expect(useRouteSessionStore.getState().computedFor).toContain('language:en');
});

it('opening an AI plan preserves the selected candidate and conditions without planning again', async () => {
  const plan = routePlanFixture();
  applyAiRoutePlan(plan);
  const { result } = await renderHook(() => useRoutePlanViewModel({}));
  expect(result.current.results).toEqual({ routes: plan.routes, selectedIndex: 1 });
  expect(result.current.originLabel).toBe(plan.origin.name);
  expect(result.current.routeModes.find((mode) => mode.selected)?.value).toBe('wheelchair');
  expect(getAccessibleRoute).not.toHaveBeenCalled();
});

it('only the explicit replan action requests a new route', async () => {
  const plan = routePlanFixture();
  applyAiRoutePlan(plan);
  jest.mocked(getAccessibleRoute).mockResolvedValue({ ok: true, status: 'success', code: 200, message: '', data: plan });
  const { result } = await renderHook(() => useRoutePlanViewModel({}));
  await act(() => result.current.onStart());
  expect(getAccessibleRoute).toHaveBeenCalledTimes(1);
  expect(getAccessibleRoute).toHaveBeenCalledWith(expect.objectContaining({
    mode: 'wheelchair', travelMode: 'transit', avoidStairs: true,
    transitPreference: plan.effectivePreferences.transitPreference,
    departureTime: plan.effectivePreferences.departureTime,
    maxTransfers: plan.effectivePreferences.maxTransfers,
  }), expect.any(AbortSignal));
});
