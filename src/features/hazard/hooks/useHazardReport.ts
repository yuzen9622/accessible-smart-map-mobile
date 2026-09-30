import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Alert, Linking } from 'react-native';

import { selectIsLoggedIn, useAuthStore } from '@/features/auth';
import { useUserLocationStore } from '@/features/map';
import { reverseGeocodeLabel } from '@/features/place';
import { ApiError } from '@/shared/api';
import { haversineMeters, type LatLng } from '@/shared/geo';
import { useAppTranslation } from '@/shared/i18n';
import { useCloseScreen } from '@/shared/navigation';

import { createHazardReport } from '../api/hazardApi';
import { pickHazardPhoto, type HazardPhoto } from '../controller/photoPicker';
import { HAZARD_TYPE_LABEL_KEY, SEVERITY_LABEL_KEY, submitErrorKey } from '../domain/hazardErrors';
import { HAZARD_SEVERITIES, HAZARD_TYPES, type HazardSeverity, type HazardType } from '../domain/types';
import { refreshNearbyHazards } from '../controller/hazardLayerController';

export interface HazardReportParams {
  /** 從地點詳情「回報此處」帶入的地點（快照：之後的 GPS 更新不會蓋掉使用者選的地點，對齊 Web `pendingReportContext`）。 */
  lat?: number;
  lng?: number;
  description?: string;
}

const ADDRESS_REQUERY_METERS = 30;

/**
 * 危險通報表單，對齊 Web `HazardReportPanel.tsx`（commit f82cda8）：類型（預設障礙物；由地點帶入時預設資料錯誤）、
 * 嚴重度（預設通行困難）、必附照片、選填描述；未登入也能送（顯示登入提示但不擋）。
 */
export function useHazardReport(params: HazardReportParams) {
  const { t, i18n } = useAppTranslation();
  const closeScreen = useCloseScreen();
  const loggedIn = useAuthStore(selectIsLoggedIn);
  const gps = useUserLocationStore((s) => s.position);
  const handoff = params.lat !== undefined && params.lng !== undefined ? { lat: params.lat, lng: params.lng } : null;
  const location: LatLng | null = handoff ?? gps;

  const [hazardType, setHazardType] = useState<HazardType>(handoff ? 'data_error' : 'obstacle');
  const [severity, setSeverity] = useState<HazardSeverity>('difficult');
  const [description, setDescription] = useState(params.description ?? '');
  const [photo, setPhoto] = useState<HazardPhoto | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [address, setAddress] = useState<string | null>(null);
  const [addressFailed, setAddressFailed] = useState(false);
  const anchor = useRef<LatLng | null>(null);
  const requestId = useRef(0);

  // 只在移動 ≥ 30 m 後重查地址（Nominatim 約 1 req/s）
  useEffect(() => {
    if (!location) return;
    if (anchor.current && haversineMeters(anchor.current, location) < ADDRESS_REQUERY_METERS) return;
    anchor.current = location;
    const id = ++requestId.current;
    const run = async () => {
      const label = await reverseGeocodeLabel(location.lat, location.lng, i18n.language);
      if (id !== requestId.current) return;
      setAddress(label);
      setAddressFailed(label === null);
    };
    void run();
  }, [location, i18n.language]);

  const choosePhoto = (source: 'camera' | 'library') => {
    const run = async () => {
      try {
        const result = await pickHazardPhoto(source);
        if (result.kind === 'ok') {
          setPhoto(result.photo);
          AccessibilityInfo.announceForAccessibility(t('nativeHazardPhotoAdded'));
        } else if (result.kind === 'denied') {
          Alert.alert(t('nativeHazardPhotoDenied'), undefined, [
            { text: t('cancel'), style: 'cancel' },
            { text: t('nativeOpenSettings'), onPress: () => void Linking.openSettings() },
          ]);
        } else if (result.kind === 'invalid') {
          Alert.alert(t(result.error === 'IMAGE_TOO_LARGE' ? 'imageTooLarge' : 'invalidImageType'));
        }
      } catch (error) {
        console.warn('[hazard] pick photo failed', error);
        Alert.alert(t('reportFailed'));
      }
    };
    void run();
  };

  const submit = async () => {
    if (submitting) return;
    if (!location) {
      Alert.alert(t('noLocation'));
      return;
    }
    if (!photo) {
      Alert.alert(t('photoRequired'));
      return;
    }
    setSubmitting(true);
    try {
      const trimmed = description.trim();
      const result = await createHazardReport({
        hazardType,
        severity,
        latitude: location.lat,
        longitude: location.lng,
        ...(trimmed ? { description: trimmed.slice(0, 500) } : {}),
        photo: { uri: photo.uri, name: photo.name, type: photo.type },
      });
      AccessibilityInfo.announceForAccessibility(t('reportSuccess'));
      Alert.alert(t('reportSuccess'), result.merged ? t('nativeHazardMerged') : t('nativeHazardPendingReview'));
      void refreshNearbyHazards(true);
      closeScreen();
    } catch (error) {
      const key = error instanceof ApiError ? submitErrorKey(error.reason, error.code) : 'reportFailed';
      Alert.alert(t(key));
    } finally {
      setSubmitting(false);
    }
  };

  return {
    loggedIn,
    login: () => router.navigate('/auth'),
    hazardType,
    typeChoices: HAZARD_TYPES.map((value) => ({ value, label: t(HAZARD_TYPE_LABEL_KEY[value]) })),
    setHazardType,
    severity,
    severityChoices: HAZARD_SEVERITIES.map((value) => ({ value, label: t(SEVERITY_LABEL_KEY[value]) })),
    setSeverity,
    description,
    setDescription,
    photo,
    removePhoto: () => setPhoto(null),
    takePhoto: () => choosePhoto('camera'),
    chooseFromLibrary: () => choosePhoto('library'),
    locationPrimary: location ? (address ?? (addressFailed ? t('addressLookupFailed') : t('locating'))) : t('locating'),
    locationSecondary: location ? `${location.lat.toFixed(5)}, ${location.lng.toFixed(5)}` : null,
    submitting,
    canSubmit: Boolean(location && photo) && !submitting,
    submit: () => void submit(),
    cancel: closeScreen,
  };
}

export type HazardReportModel = ReturnType<typeof useHazardReport>;
