import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { AccessibilityInfo, Alert } from 'react-native';

import { selectIsLoggedIn, useAuthStore } from '@/features/auth';
import { useAppTranslation } from '@/shared/i18n';
import { usePreferencesStore } from '@/shared/preferences';

import {
  clearMemories,
  createMemory,
  deleteMemory,
  getMemorySettings,
  listMemories,
  updateMemory,
  updateMemorySettings,
} from '../api/memoryApi';
import type { MemoryCategory, MemorySensitivity, UserMemory } from '../domain/types';

export const MEMORY_CATEGORIES: readonly MemoryCategory[] = ['preference', 'place', 'habit', 'context'];
export const MEMORY_SENSITIVITIES: readonly MemorySensitivity[] = ['low', 'medium', 'high'];
export const MEMORY_MAX_LENGTH = 240;

/** AI 記憶管理頁 view-model。後端 `/api/v1/ai/memories*` 是唯一資料來源；開關同步回本機偏好。 */
export function useAiMemory() {
  const { t } = useAppTranslation();
  const loggedIn = useAuthStore(selectIsLoggedIn);
  const [enabled, setEnabled] = useState(false);
  const [memories, setMemories] = useState<UserMemory[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [content, setContent] = useState('');
  const [category, setCategory] = useState<MemoryCategory>('preference');
  const [sensitivity, setSensitivity] = useState<MemorySensitivity>('low');

  const load = async () => {
    setLoading(true);
    setError(false);
    try {
      const [isEnabled, list] = await Promise.all([getMemorySettings(), listMemories()]);
      setEnabled(isEnabled);
      setMemories(list);
    } catch (e) {
      console.warn('[ai-memory] load failed', e);
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!loggedIn) return;
    const run = async () => {
      await load();
    };
    void run();
  }, [loggedIn]);

  const resetForm = () => {
    setEditingId(null);
    setContent('');
    setCategory('preference');
    setSensitivity('low');
  };

  const toggle = (value: boolean) => {
    const run = async () => {
      const previous = enabled;
      setEnabled(value);
      try {
        const saved = await updateMemorySettings(value);
        setEnabled(saved);
        usePreferencesStore.getState().setPreferences({ memoryEnabled: saved });
        AccessibilityInfo.announceForAccessibility(t('aiMemorySettingSaved'));
      } catch (e) {
        console.warn('[ai-memory] settings failed', e);
        setEnabled(previous);
        Alert.alert(t('nativeAiMemorySettingFailed'));
      }
    };
    void run();
  };

  const submit = () => {
    const text = content.trim();
    if (!text || saving) return;
    const run = async () => {
      setSaving(true);
      try {
        if (editingId) {
          const saved = await updateMemory(editingId, { content: text, category, sensitivity });
          setMemories((list) => list.map((m) => (m.id === saved.id ? saved : m)));
          AccessibilityInfo.announceForAccessibility(t('aiMemoryUpdated'));
        } else {
          const saved = await createMemory({ content: text, category, sensitivity });
          setMemories((list) => [saved, ...list]);
          AccessibilityInfo.announceForAccessibility(t('aiMemoryCreated'));
        }
        resetForm();
      } catch (e) {
        console.warn('[ai-memory] save failed', e);
        Alert.alert(t('nativeAiMemorySaveFailed'));
      } finally {
        setSaving(false);
      }
    };
    void run();
  };

  const remove = (memory: UserMemory) => {
    const run = async () => {
      try {
        await deleteMemory(memory.id);
        setMemories((list) => list.filter((m) => m.id !== memory.id));
        if (editingId === memory.id) resetForm();
        AccessibilityInfo.announceForAccessibility(t('nativeAiMemoryDeleted'));
      } catch (e) {
        console.warn('[ai-memory] delete failed', e);
        Alert.alert(t('nativeAiMemoryDeleteFailed'));
      }
    };
    Alert.alert(t('nativeAiMemoryDeleteTitle'), memory.content, [
      { text: t('cancel'), style: 'cancel' },
      { text: t('nativeAiMemoryDelete'), style: 'destructive', onPress: () => void run() },
    ]);
  };

  const clearAll = () => {
    const run = async () => {
      try {
        await clearMemories();
        setMemories([]);
        resetForm();
        AccessibilityInfo.announceForAccessibility(t('nativeAiMemoryCleared'));
      } catch (e) {
        console.warn('[ai-memory] clear failed', e);
        Alert.alert(t('nativeAiMemoryClearFailed'));
      }
    };
    Alert.alert(t('nativeAiMemoryClearTitle'), t('nativeAiMemoryClearConfirm'), [
      { text: t('cancel'), style: 'cancel' },
      { text: t('nativeAiMemoryClearAll'), style: 'destructive', onPress: () => void run() },
    ]);
  };

  const startEdit = (memory: UserMemory) => {
    setEditingId(memory.id);
    setContent(memory.content);
    setCategory(memory.category);
    setSensitivity(memory.sensitivity);
  };

  const formatDate = (iso: string) => new Date(iso).toLocaleDateString();

  return {
    loggedIn,
    openLogin: () => router.push('/auth'),
    enabled,
    toggle,
    loading,
    error,
    retry: () => void load(),
    saving,
    editing: editingId !== null,
    content,
    setContent,
    category,
    setCategory,
    sensitivity,
    setSensitivity,
    submit,
    cancelEdit: resetForm,
    categoryChoices: MEMORY_CATEGORIES.map((value) => ({ value, label: t(`memoryCategory.${value}`) })),
    sensitivityChoices: MEMORY_SENSITIVITIES.map((value) => ({ value, label: t(`memorySensitivity.${value}`) })),
    memories: memories.map((m) => ({
      id: m.id,
      content: m.content,
      meta: [
        t(`memoryCategory.${m.category}`),
        t(`memorySensitivity.${m.sensitivity}`),
        t(`memorySource.${m.source}`),
        m.expiresAt ? t('nativeAiMemoryExpires', { date: formatDate(m.expiresAt) }) : t('aiMemoryNoExpiry'),
      ].join(' · '),
      onPress: () =>
        Alert.alert(m.content, undefined, [
          { text: t('nativeAiMemoryEdit'), onPress: () => startEdit(m) },
          { text: t('nativeAiMemoryDelete'), style: 'destructive', onPress: () => remove(m) },
          { text: t('cancel'), style: 'cancel' },
        ]),
    })),
    clearAll,
  };
}

export type AiMemoryModel = ReturnType<typeof useAiMemory>;
