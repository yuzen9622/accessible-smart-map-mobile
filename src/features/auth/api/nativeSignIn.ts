import * as AppleAuthentication from 'expo-apple-authentication';
import * as Crypto from 'expo-crypto';
import { GoogleSignin, isCancelledResponse, isErrorWithCode, isSuccessResponse, statusCodes } from '@react-native-google-signin/google-signin';
import { Platform } from 'react-native';

import { getAppConfig } from '@/shared/config';
import { logger } from '@/shared/logger';

import type { AppleLoginInput } from './authApi';

/**
 * 原生登入 SDK 包裝（ADR-09）：只負責向 Google／Apple 取得 token，送後端的部分在 `authApi`。
 * 回傳 `null` 代表使用者自己取消，UI 不顯示錯誤。
 */

let googleConfigured = false;

/** Google 需要 web client ID（idToken audience）；iOS 另需 iOS client ID（也決定 URL scheme）。 */
export function isGoogleSignInConfigured(): boolean {
  const config = getAppConfig();
  if (!config.googleWebClientId) return false;
  return Platform.OS !== 'ios' || Boolean(config.googleIosClientId);
}

export async function getGoogleIdToken(): Promise<string | null> {
  const config = getAppConfig();
  if (!googleConfigured) {
    GoogleSignin.configure({
      webClientId: config.googleWebClientId ?? undefined,
      iosClientId: config.googleIosClientId ?? undefined,
    });
    googleConfigured = true;
  }
  try {
    if (Platform.OS === 'android') await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    const response = await GoogleSignin.signIn();
    if (isCancelledResponse(response)) return null;
    if (!isSuccessResponse(response) || !response.data.idToken) {
      throw new Error('Google sign-in returned no idToken');
    }
    return response.data.idToken;
  } catch (error) {
    if (isErrorWithCode(error) && (error.code === statusCodes.SIGN_IN_CANCELLED || error.code === statusCodes.IN_PROGRESS)) {
      return null;
    }
    throw error;
  }
}

/** 登出時一併清掉 Google SDK 的本機帳號，下次登入才會讓使用者重新選帳號。 */
export async function signOutGoogle(): Promise<void> {
  if (!googleConfigured) return;
  try {
    await GoogleSignin.signOut();
  } catch (error) {
    logger.warn('[auth] Google signOut failed', error);
  }
}

export async function isAppleSignInAvailable(): Promise<boolean> {
  if (Platform.OS !== 'ios') return false;
  try {
    return await AppleAuthentication.isAvailableAsync();
  } catch {
    return false;
  }
}

function isAppleCancel(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    (error as Record<string, unknown>).code === 'ERR_REQUEST_CANCELED'
  );
}

/**
 * Sign in with Apple。Apple 會把 request 的 nonce 原樣放進 identityToken 的 `nonce` claim，所以
 * request 帶 SHA-256(raw)、後端收 raw 再雜湊比對，可防止 token 被重放。
 */
export async function getAppleCredential(): Promise<AppleLoginInput | null> {
  const rawNonce = Crypto.randomUUID();
  const hashedNonce = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, rawNonce);
  try {
    const credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
      nonce: hashedNonce,
    });
    if (!credential.identityToken) throw new Error('Apple sign-in returned no identityToken');
    const name = credential.fullName ? AppleAuthentication.formatFullName(credential.fullName).trim() : '';
    return {
      identityToken: credential.identityToken,
      nonce: rawNonce,
      name: name || null,
      authorizationCode: credential.authorizationCode,
    };
  } catch (error) {
    if (isAppleCancel(error)) return null;
    throw error;
  }
}
