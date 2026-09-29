import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { AccessibilityInfo, Alert, Linking } from 'react-native';

import { useAppTranslation } from '@/shared/i18n';

import {
  forgotPassword,
  loginWithApple,
  loginWithEmail,
  loginWithGoogle,
  registerWithEmail,
  resendVerificationEmail,
  type LoginResult,
} from '../api/authApi';
import { getAppleCredential, getGoogleIdToken, isAppleSignInAvailable, isGoogleSignInConfigured } from '../api/nativeSignIn';
import { isPlausibleEmail, validatePassword } from '../domain/passwordValidation';
import { useAuthStore } from '../store/authStore';

/**
 * 登入／註冊／忘記密碼面板的 view-model。行為對齊 Web `AuthDialog.tsx`（commit f82cda8）：
 * - 登入 401 → 帳密錯誤；403 EMAIL_NOT_VERIFIED → 顯示重寄驗證信；429 → 過於頻繁。
 * - 註冊成功不自動登入（要先點信件連結驗證，落地頁在 Web）。
 * - 忘記密碼除了 503 以外一律顯示「已寄出」（防帳號列舉）。
 * 差異：Web 的 toast 改為面板內文字與 `announceForAccessibility`；登入後不自動彈 LINE 綁定（改放設定頁）。
 */

export type AuthMode = 'login' | 'register' | 'forgot';

/** 對齊 Web 的 webmail 對照：註冊完成時提供「打開信箱」。 */
const WEBMAIL: Record<string, string> = {
  'gmail.com': 'https://mail.google.com',
  'googlemail.com': 'https://mail.google.com',
  'outlook.com': 'https://outlook.live.com/mail/',
  'hotmail.com': 'https://outlook.live.com/mail/',
  'live.com': 'https://outlook.live.com/mail/',
  'yahoo.com': 'https://mail.yahoo.com',
  'yahoo.com.tw': 'https://tw.mail.yahoo.com',
  'icloud.com': 'https://www.icloud.com/mail',
};

export function webmailUrl(email: string): string | null {
  const domain = email.trim().split('@')[1]?.toLowerCase();
  return domain ? (WEBMAIL[domain] ?? null) : null;
}

export interface AuthFlowModel {
  mode: AuthMode;
  name: string;
  email: string;
  password: string;
  loading: boolean;
  error: string | null;
  /** 登入被擋在未驗證信箱：顯示重寄按鈕。 */
  needsVerification: boolean;
  registered: { emailSent: boolean; inboxUrl: string | null } | null;
  forgotSent: boolean;
  /** 註冊時的即時密碼提示。 */
  passwordHint: string | null;
  showGoogle: boolean;
  showApple: boolean;
  setName: (v: string) => void;
  setEmail: (v: string) => void;
  setPassword: (v: string) => void;
  setMode: (mode: AuthMode) => void;
  submit: () => void;
  signInWithGoogle: () => void;
  signInWithApple: () => void;
  resendVerification: () => void;
  openInbox: () => void;
  close: () => void;
}

export function useAuthFlow(initialMode: AuthMode = 'login'): AuthFlowModel {
  const { t } = useAppTranslation();
  const commitSession = useAuthStore((s) => s.commitSession);
  const [mode, setModeState] = useState<AuthMode>(initialMode);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [needsVerification, setNeedsVerification] = useState(false);
  const [registered, setRegistered] = useState<AuthFlowModel['registered']>(null);
  const [forgotSent, setForgotSent] = useState(false);
  const [appleAvailable, setAppleAvailable] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const check = async () => {
      const available = await isAppleSignInAvailable();
      if (!cancelled) setAppleAvailable(available);
    };
    void check();
    return () => {
      cancelled = true;
    };
  }, []);

  const passwordErrorText = (code: ReturnType<typeof validatePassword>): string | null =>
    code ? t(`nativeAuthPassword_${code}`) : null;

  const fail = (message: string) => {
    setError(message);
    AccessibilityInfo.announceForAccessibility(message);
  };

  const finishLogin = (result: LoginResult, fallbackKey: string) => {
    switch (result.kind) {
      case 'ok':
        commitSession(result.session);
        AccessibilityInfo.announceForAccessibility(t('welcome', { name: result.session.user.name }));
        router.back();
        return;
      case 'invalidCredentials':
        fail(t('auth.loginErrorCreds'));
        return;
      case 'emailNotVerified':
        setNeedsVerification(true);
        fail(t('auth.needsVerification'));
        return;
      case 'rateLimited':
        fail(t('auth.loginTooMany'));
        return;
      default:
        fail(result.message || t(fallbackKey));
    }
  };

  const run = async (task: () => Promise<void>) => {
    if (loading) return;
    setError(null);
    setLoading(true);
    try {
      await task();
    } catch (err) {
      console.warn('[auth] request failed', err);
      fail(t('nativeNetworkError'));
    } finally {
      setLoading(false);
    }
  };

  const submitLogin = () =>
    run(async () => {
      setNeedsVerification(false);
      if (!isPlausibleEmail(email) || !password) {
        fail(t('nativeAuthFillEmailPassword'));
        return;
      }
      finishLogin(await loginWithEmail(email, password), 'auth.loginFailed');
    });

  const submitRegister = () =>
    run(async () => {
      if (!name.trim()) {
        fail(t('nativeAuthNameRequired'));
        return;
      }
      if (!isPlausibleEmail(email)) {
        fail(t('nativeAuthEmailInvalid'));
        return;
      }
      const pwError = passwordErrorText(validatePassword(password));
      if (pwError) {
        fail(pwError);
        return;
      }
      const result = await registerWithEmail(name, email, password);
      if (result.kind === 'ok') {
        setRegistered({ emailSent: result.emailSent, inboxUrl: result.emailSent ? webmailUrl(email) : null });
        AccessibilityInfo.announceForAccessibility(t('auth.registerSuccessTitle'));
      } else if (result.kind === 'emailTaken') {
        fail(t('auth.emailTaken'));
      } else {
        fail(result.message || t('auth.registerFailed'));
      }
    });

  const submitForgot = () =>
    run(async () => {
      if (!isPlausibleEmail(email)) {
        fail(t('nativeAuthEmailInvalid'));
        return;
      }
      const result = await forgotPassword(email);
      if (result.kind === 'unavailable') {
        fail(t('auth.forgotSendFailed'));
        return;
      }
      setForgotSent(true);
      AccessibilityInfo.announceForAccessibility(t('auth.forgotSentBody'));
    });

  const resend = () =>
    run(async () => {
      await resendVerificationEmail(email);
      Alert.alert(t('auth.resendSuccess'));
    });

  const google = () =>
    run(async () => {
      const idToken = await getGoogleIdToken();
      if (!idToken) return; // 使用者取消
      finishLogin(await loginWithGoogle(idToken), 'auth.googleLoginFailed');
    });

  const apple = () =>
    run(async () => {
      const credential = await getAppleCredential();
      if (!credential) return;
      finishLogin(await loginWithApple(credential), 'nativeAuthAppleFailed');
    });

  return {
    mode,
    name,
    email,
    password,
    loading,
    error,
    needsVerification,
    registered,
    forgotSent,
    passwordHint: mode === 'register' && password ? passwordErrorText(validatePassword(password)) : null,
    showGoogle: isGoogleSignInConfigured(),
    showApple: appleAvailable,
    setName,
    setEmail,
    setPassword,
    setMode: (next) => {
      setModeState(next);
      setError(null);
      setNeedsVerification(false);
      setRegistered(null);
      setForgotSent(false);
    },
    submit: () => {
      if (mode === 'login') void submitLogin();
      else if (mode === 'register') void submitRegister();
      else void submitForgot();
    },
    signInWithGoogle: () => void google(),
    signInWithApple: () => void apple(),
    resendVerification: () => void resend(),
    openInbox: () => {
      const url = registered?.inboxUrl;
      if (!url) return;
      const open = async () => {
        try {
          await Linking.openURL(url);
        } catch (err) {
          console.warn('[auth] open inbox failed', err);
        }
      };
      void open();
    },
    close: () => router.back(),
  };
}
