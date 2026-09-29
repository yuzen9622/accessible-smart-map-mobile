// react-native-nitro-modules 在 import 時就會找原生 TurboModule，Jest 沒有原生層。
// react-native-mmkv 偵測到 Jest（JEST_WORKER_ID）會自己改用 createMockMMKV，只需讓 import 不爆。
jest.mock('react-native-nitro-modules', () => ({ NitroModules: {} }));

// maplibre 的元件在 import 時就向 TurboModuleRegistry 要原生模組。feature 公開出口會帶進地圖圖層元件，
// 測試只驗邏輯，不渲染地圖，所以換成不做事的元件。
jest.mock('@maplibre/maplibre-react-native', () => {
  const Noop = () => null;
  return { Map: Noop, Camera: Noop, GeoJSONSource: Noop, Layer: Noop, NativeUserLocation: Noop };
});

// expo-widgets（Live Activity）只有 iOS 原生層；測試環境給一個永遠沒有活動實例的工廠。
jest.mock('expo-widgets', () => ({
  createLiveActivity: () => ({ start: () => ({ update: async () => {}, end: async () => {} }), getInstances: () => [] }),
}));
