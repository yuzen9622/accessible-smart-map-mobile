import * as Clipboard from 'expo-clipboard';
import { useEffect, useState } from 'react';
import { AccessibilityInfo, Alert, Linking } from 'react-native';

import { useAppTranslation } from '@/shared/i18n';
import { logger } from '@/shared/logger';

import {
  addContact,
  dismissJustCreated,
  loadContacts,
  removeContact,
  stopContactsPolling,
  syncContactsPolling,
  useContactsUiStore,
} from '../controller/contactsController';
import { MAX_EMERGENCY_CONTACTS } from '../domain/types';
import { useSosStore } from '../store/sosStore';

export function useEmergencyContacts() {
  const { t } = useAppTranslation();
  const contacts = useSosStore((s) => s.contacts);
  const ui = useContactsUiStore();
  const [name, setName] = useState('');

  useEffect(() => {
    const run = async () => {
      await loadContacts();
      syncContactsPolling();
    };
    void run();
    return () => stopContactsPolling();
  }, []);

  useEffect(() => {
    syncContactsPolling();
  }, [contacts]);

  const atLimit = contacts.length >= MAX_EMERGENCY_CONTACTS;

  const copy = async (value: string) => {
    try {
      await Clipboard.setStringAsync(value);
      AccessibilityInfo.announceForAccessibility(t('nativeCopied'));
    } catch {
      Alert.alert(t('copyFailed'));
    }
  };

  return {
    title: t('sosContactsManageTitle'),
    description: t('sosContactsManageDesc'),
    loading: ui.loading,
    submitting: ui.submitting,
    error: ui.error,
    atLimit,
    limitText: t('sosContactsLimitReached'),
    name,
    setName,
    contacts: contacts.map((c) => ({
      id: c._id,
      name: c.name,
      statusText: c.bindStatus === 'bound' ? t('sosContactsBound') : t('sosContactsPending'),
      bound: c.bindStatus === 'bound',
      onDelete: () =>
        Alert.alert(t('sosContactsDelete'), t('sosContactsDeleteConfirm'), [
          { text: t('cancel'), style: 'cancel' },
          {
            text: t('sosContactsDelete'),
            style: 'destructive',
            onPress: () => {
              const run = async () => {
                if (!(await removeContact(c._id))) Alert.alert(t('nativeContactDeleteFailed'));
              };
              void run();
            },
          },
        ]),
    })),
    bindResult: ui.justCreated
      ? {
          url: ui.justCreated.bindUrl,
          code: ui.justCreated.bindCode.toUpperCase(),
          openUrl: () => {
            const url = ui.justCreated?.bindUrl;
            if (!url) return;
            const open = async () => {
              try {
                await Linking.openURL(url);
              } catch (error) {
                logger.warn('[sos] open bind url failed', error);
              }
            };
            void open();
          },
          copyUrl: () => void copy(ui.justCreated?.bindUrl ?? ''),
          copyCode: () => void copy(ui.justCreated?.bindCode.toUpperCase() ?? ''),
          dismiss: dismissJustCreated,
        }
      : null,
    add: () => {
      const run = async () => {
        const result = await addContact(name);
        if (result.ok) {
          setName('');
          AccessibilityInfo.announceForAccessibility(t('sosContactsBindResultTitle'));
        } else if (result.reason === 'limit') {
          Alert.alert(t('sosContactsLimitReached'));
        } else if (result.reason === 'failed') {
          Alert.alert(result.message || t('nativeContactAddFailed'));
        }
      };
      void run();
    },
    retry: () => void loadContacts(),
  };
}

export type EmergencyContactsModel = ReturnType<typeof useEmergencyContacts>;
