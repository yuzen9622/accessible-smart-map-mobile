import { Marker } from '@maplibre/maplibre-react-native';
import { router } from 'expo-router';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { useThemeColors } from '@/shared/theme';

import { FACILITY_COLORS } from '../domain/facilityStyle';
import { formatDistance } from '../domain/parking';
import { useFacilityPills } from '../hooks/useFacilityPills';

const FACILITY_ICON = {
  elevator: require('../../../../assets/map-icons/elevator.png'),
  ramp: require('../../../../assets/map-icons/ramp.png'),
  toilet: require('../../../../assets/map-icons/toilet.png'),
};

/** 圓心對準座標：pill 左內距 3 + 圓半徑 12 */
const CIRCLE_CENTER_OFFSET: [number, number] = [-15, 0];

/**
 * 首頁附近設施的距離 pill（設計 1b「地圖標記帶距離」）：白底膠囊＋類別色圓＋距離。
 * 以 MapLibre `Marker`（原生 view annotation）承載 RN view；數量限制在最近幾個（見 `useFacilityPills`）。
 * iOS／Android 共用。
 */
export default function FacilityPills() {
  const pills = useFacilityPills();
  const colors = useThemeColors();
  return pills.map((pill) => {
    const distanceText = formatDistance(pill.distance);
    return (
      <Marker
        key={pill.id}
        id={`facility-pill-${pill.id}`}
        lngLat={[pill.position.lng, pill.position.lat]}
        anchor="left"
        offset={CIRCLE_CENTER_OFFSET}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${pill.facility.name}，${distanceText}`}
          onPress={() => router.push({ pathname: '/facility/[id]', params: { id: pill.id } })}
          style={[styles.pill, { backgroundColor: colors.background }]}>
          <View style={[styles.circle, { backgroundColor: FACILITY_COLORS[pill.facility.category] }]}>
            <Image source={FACILITY_ICON[pill.facility.category]} style={styles.icon} />
          </View>
          <Text style={[styles.distance, { color: colors.text }]}>{distanceText}</Text>
        </Pressable>
      </Marker>
    );
  });
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 3,
    paddingLeft: 3,
    paddingRight: 10,
    borderRadius: 15,
    shadowColor: '#000000',
    shadowOpacity: 0.22,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  circle: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  icon: { width: 14, height: 14 },
  distance: { fontSize: 13, fontWeight: '600' },
});
