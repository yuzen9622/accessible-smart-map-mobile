import { Stack, useLocalSearchParams, useNavigation } from 'expo-router';
import { useEffect } from 'react';

import { useCloseScreen } from '@/shared/navigation';

import RouteLocationSearchPanel from '../components/RouteLocationSearchPanel';
import { useRouteLocationSearchViewModel } from '../hooks/useRouteLocationSearchViewModel';
import type { RouteSearchTarget } from '../hooks/useRoutePlanViewModel';

function parseTarget(field: string | undefined, stopIndex: string | undefined): RouteSearchTarget {
  if (field === 'stop') {
    const index = Number(stopIndex);
    return { field: 'stop', stopIndex: stopIndex !== undefined && Number.isInteger(index) && index >= 0 ? index : null };
  }
  return { field: field === 'origin' ? 'origin' : 'destination' };
}

export default function RouteLocationSearchScreen() {
  const { field, stopIndex } = useLocalSearchParams<{ field?: string; stopIndex?: string }>();
  const closeScreen = useCloseScreen();
  const model = useRouteLocationSearchViewModel(parseTarget(field, stopIndex), closeScreen);
  const navigation = useNavigation();
  useEffect(() => navigation.addListener('beforeRemove', model.onDismiss), [navigation, model.onDismiss]);
  return (
    <>
      <Stack.Screen options={{ title: model.labels.title }} />
      <RouteLocationSearchPanel model={model} />
    </>
  );
}
