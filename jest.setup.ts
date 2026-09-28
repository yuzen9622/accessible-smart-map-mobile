// react-native-nitro-modules 在 import 時就會找原生 TurboModule，Jest 沒有原生層。
// react-native-mmkv 偵測到 Jest（JEST_WORKER_ID）會自己改用 createMockMMKV，只需讓 import 不爆。
jest.mock('react-native-nitro-modules', () => ({ NitroModules: {} }));
