import { Marker } from '@maplibre/maplibre-react-native';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

import { usePlaceUiStore } from '../store/placeUiStore';

// Google Maps 風格的圖釘：紅色水滴＋深紅圓心，尖端（底部中央）對準座標。
const PIN_WIDTH = 30;
const PIN_HEIGHT = 48;
const PIN_BODY = '#EA4335';
const PIN_BORDER = '#C5221F';
const PIN_CORE = '#B31412';
const PIN_PATH = 'M13.5 0C6.04 0 0 6.04 0 13.5 0 23.6 13.5 43 13.5 43S27 23.6 27 13.5C27 6.04 20.96 0 13.5 0Z';

/**
 * 選定地點／搜尋結果的地圖 pin（SDD §4.4 `SearchPinLayer`）：`Marker` 內放自繪 SVG 圖釘，
 * 形狀與配色參考 Google 地圖，比小圓點或線條圖示醒目。
 */
export default function PlacePinLayer() {
  const selectedPlace = usePlaceUiStore((state) => state.selectedPlace);
  if (!selectedPlace) return null;

  const { lat, lng } = selectedPlace.position;
  return (
    <Marker id="place-pin" lngLat={[lng, lat]} anchor="bottom">
      <View style={styles.pin} pointerEvents="none">
        <Svg width={PIN_WIDTH} height={PIN_HEIGHT} viewBox="-1.5 -1.5 30 46.5">
          <Path d={PIN_PATH} fill={PIN_BODY} stroke={PIN_BORDER} strokeWidth={1} />
          <Circle cx={13.5} cy={13.5} r={5.5} fill={PIN_CORE} />
        </Svg>
      </View>
    </Marker>
  );
}

const styles = StyleSheet.create({
  pin: {
    width: PIN_WIDTH,
    height: PIN_HEIGHT,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 2 },
  },
});
