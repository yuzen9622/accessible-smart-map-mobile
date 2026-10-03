// Run through `eas env:exec`; intentionally do not load local .env files.
import { parseAppConfig } from '../src/shared/config/appConfig.ts';

const result = parseAppConfig(process.env);
if (!result.ok) {
  console.error('EAS Update environment is invalid:');
  for (const error of result.errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log('EAS Update environment passed App configuration validation.');
for (const name of [
  'EXPO_PUBLIC_END_POINT',
  'EXPO_PUBLIC_SHARE_BASE_URL',
  'EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID',
  'EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID',
  'EXPO_PUBLIC_PRIVACY_POLICY_URL',
  'EXPO_PUBLIC_TERMS_URL',
]) {
  console.log(`${name}: ${process.env[name]?.trim() ? 'set' : 'unset (optional)'}`);
}
