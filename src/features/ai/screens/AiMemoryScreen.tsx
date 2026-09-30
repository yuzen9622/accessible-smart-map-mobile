import { useAppTranslation } from '@/shared/i18n';
import { FormButton, FormInput, FormRow, FormScreen, FormSection, FormSegmented, FormSwitch, FormText } from '@/shared/ui';

import { useAiMemory } from '../hooks/useAiMemory';

/** AI 記憶管理（設定 → AI 記憶）。用共用 Form 元件，iOS／Android 皆可。 */
export default function AiMemoryScreen() {
  const { t } = useAppTranslation();
  const m = useAiMemory();

  if (!m.loggedIn) {
    return (
      <FormScreen>
        <FormSection title={t('aiMemoryTitle')} footer={t('aiMemoryDesc')}>
          <FormText tone="secondary">{t('aiMemoryLoginHint')}</FormText>
          <FormButton label={t('loginRegisterCta')} onPress={m.openLogin} />
        </FormSection>
      </FormScreen>
    );
  }

  return (
    <FormScreen>
      <FormSection title={t('aiMemoryTitle')} footer={t('aiMemoryDesc')}>
        <FormSwitch
          label={t('aiMemoryTitle')}
          description={m.enabled ? t('aiMemoryEnabled') : t('aiMemoryDisabled')}
          value={m.enabled}
          onValueChange={m.toggle}
          disabled={m.loading || m.error}
        />
      </FormSection>

      <FormSection title={m.editing ? t('aiMemoryEditTitle') : t('aiMemoryCreateTitle')} footer={t('aiMemoryFormHint')}>
        <FormInput label={t('aiMemoryPlaceholder')} value={m.content} onChangeText={m.setContent} maxLength={240} multiline />
        <FormText tone="secondary">{t('aiMemoryCategory')}</FormText>
        <FormSegmented label={t('aiMemoryCategory')} value={m.category} choices={m.categoryChoices} onChange={m.setCategory} />
        <FormText tone="secondary">{t('aiMemorySensitivity')}</FormText>
        <FormSegmented label={t('aiMemorySensitivity')} value={m.sensitivity} choices={m.sensitivityChoices} onChange={m.setSensitivity} />
        <FormButton
          label={m.editing ? t('saveChanges') : t('aiMemoryCreateAction')}
          loading={m.saving}
          disabled={!m.content.trim()}
          onPress={m.submit}
        />
        {m.editing ? <FormButton label={t('nativeAiMemoryCancelEdit')} variant="secondary" onPress={m.cancelEdit} /> : null}
      </FormSection>

      <FormSection title={t('aiMemoryListTitle')} footer={m.memories.length > 0 ? t('aiMemoryListDesc', { count: m.memories.length }) : undefined}>
        {m.error ? (
          <>
            <FormText tone="error">{t('nativeAiMemoryLoadFailed')}</FormText>
            <FormButton label={t('retry')} variant="secondary" onPress={m.retry} />
          </>
        ) : null}
        {!m.loading && !m.error && m.memories.length === 0 ? <FormText tone="secondary">{t('aiMemoryEmpty')}</FormText> : null}
        {m.memories.map((memory) => (
          <FormRow key={memory.id} label={memory.content} value={memory.meta} onPress={memory.onPress} />
        ))}
      </FormSection>

      {m.memories.length > 0 ? (
        <FormSection>
          <FormRow label={t('nativeAiMemoryClearAll')} destructive onPress={m.clearAll} />
        </FormSection>
      ) : null}
    </FormScreen>
  );
}
