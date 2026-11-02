import { useEffect, useState } from 'react';
import { Animated, PanResponder, StyleSheet, View } from 'react-native';

import { haptic } from '@/shared/haptics';
import { ICON_SIZE, SHAPE, useThemeColors } from '@/shared/theme';
import { Icon } from '@/shared/ui';

import { STOP_ROW_MIN_HEIGHT, StopRow } from './StopList.shared';
import type { StopListProps } from './StopList.types';

interface DragState {
  from: number;
  to: number;
}

interface DragHandleProps {
  color: string;
  index: number;
  count: number;
  rowHeight: number;
  translateY: Animated.Value;
  onDragChange: (drag: DragState | null) => void;
  onMove: (from: number, to: number) => void;
}

/**
 * ≡ 把手。PanResponder 只在 mount 時建一次（重建會把手勢中的 dy 歸零），所以它用到的 index／列數／列高
 * 都放進父層給的 key：任何一個變了就重新 mount，閉包永遠拿到正確的值。
 */
function DragHandle({ color, index, count, rowHeight, translateY, onDragChange, onMove }: DragHandleProps) {
  const [handle] = useState(() => {
    let active = false;
    const targetFor = (dy: number) => Math.max(0, Math.min(count - 1, index + Math.round(dy / rowHeight)));
    let target = index;
    const finish = (to: number) => {
      active = false;
      translateY.setValue(0);
      onDragChange(null);
      if (to !== index) onMove(index, to);
    };
    const responder = PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: () => {
        active = true;
        target = index;
        translateY.setValue(0);
        haptic.select();
        onDragChange({ from: index, to: index });
      },
      onPanResponderMove: (_, gesture) => {
        translateY.setValue(gesture.dy);
        const next = targetFor(gesture.dy);
        if (next === target) return;
        target = next;
        haptic.select();
        onDragChange({ from: index, to: next });
      },
      onPanResponderRelease: (_, gesture) => finish(targetFor(gesture.dy)),
      onPanResponderTerminate: () => finish(index),
    });
    return { responder, isActive: () => active };
  });
  // 拖到一半被重新 mount（例如外部新增／移除停靠點改了 key）時，舊 responder 收不到放開事件，要自己收尾。
  useEffect(() => () => {
    if (!handle.isActive()) return;
    translateY.setValue(0);
    onDragChange(null);
  }, [handle, translateY, onDragChange]);
  return (
    <View {...handle.responder.panHandlers} importantForAccessibility="no-hide-descendants" hitSlop={8} style={styles.handle}>
      <Icon name="reorder" size={ICON_SIZE.body} color={color} />
    </View>
  );
}

/**
 * Android：Compose 沒有現成的可排序清單，改用 ≡ 把手上的 JS responder 拖曳（Google 地圖的停靠點同樣是拖把手）。
 * responder 取得觸控後 RN 會對上層呼叫 requestDisallowInterceptTouchEvent，ScrollView 與 sheet 都不會搶走手勢。
 * 拖曳中被拖的列跟著手指走，其他列即時讓位；放開才寫回 store（只觸發一次重新規劃）。
 */
export default function StopList({ stops, labels, onMove }: StopListProps) {
  const colors = useThemeColors();
  const [drag, setDrag] = useState<DragState | null>(null);
  const [rowHeight, setRowHeight] = useState(STOP_ROW_MIN_HEIGHT);
  const [translateY] = useState(() => new Animated.Value(0));

  /** 其他列讓位：被拖的列往下越過的列上移一格，往上越過的列下移一格。 */
  const shiftFor = (index: number) => {
    if (!drag || index === drag.from) return 0;
    if (drag.from < drag.to && index > drag.from && index <= drag.to) return -rowHeight;
    if (drag.from > drag.to && index < drag.from && index >= drag.to) return rowHeight;
    return 0;
  };

  return (
    <View>
      {stops.map((stop, index) => {
        const dragging = drag?.from === index;
        return (
          <Animated.View
            key={stop.key}
            onLayout={({ nativeEvent }) => setRowHeight(nativeEvent.layout.height)}
            style={[
              dragging && [styles.dragging, { backgroundColor: colors.background }],
              { transform: [{ translateY: dragging ? translateY : shiftFor(index) }] },
            ]}>
            <StopRow
              stop={stop}
              labels={labels}
              handle={
                <DragHandle
                  key={`${index}-${stops.length}-${rowHeight}`}
                  color={colors.textSecondary}
                  index={index}
                  count={stops.length}
                  rowHeight={rowHeight}
                  translateY={translateY}
                  onDragChange={setDrag}
                  onMove={onMove}
                />
              }
            />
          </Animated.View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  dragging: { zIndex: 1, elevation: 4, borderRadius: SHAPE.control },
  handle: { minWidth: 32, minHeight: STOP_ROW_MIN_HEIGHT, alignItems: 'center', justifyContent: 'center' },
});
