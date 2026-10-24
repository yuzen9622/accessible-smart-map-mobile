import { Stack, useLocalSearchParams, useNavigation } from 'expo-router';
import { useEffect } from 'react';

import { useCloseScreen } from '@/shared/navigation';

import RouteLocationSearchPanel from '../components/RouteLocationSearchPanel';
import { useRouteLocationSearchViewModel } from '../hooks/useRouteLocationSearchViewModel';

export default function RouteLocationSearchScreen() {
  const { field } = useLocalSearchParams<{ field?: string }>();
  const closeScreen = useCloseScreen();
  const model = useRouteLocationSearchViewModel(field === 'origin' ? 'origin' : 'destination', closeScreen);
  const navigation = useNavigation();
  useEffect(() => navigation.addListener('beforeRemove', model.onDismiss), [navigation, model.onDismiss]);
  return (
    <>
      <Stack.Screen options={{ title: model.labels.title }} />
      <RouteLocationSearchPanel model={model} />
    </>
  );
}
