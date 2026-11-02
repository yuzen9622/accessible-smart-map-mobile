import { HStack, Host, List, RNHostView } from '@expo/ui/swift-ui';
import { listRowBackground, listRowInsets, listRowSeparator, listStyle, scrollDisabled, useScrollGeometryChange } from '@expo/ui/swift-ui/modifiers';
import { useState } from 'react';

import { haptic } from '@/shared/haptics';

import { STOP_ROW_MIN_HEIGHT, StopRow } from './StopList.shared';
import type { StopListProps } from './StopList.types';

// 每列都不要 List 預設的白底、內距與分隔線，外觀跟卡片裡其他列一致。
const ROW_MODIFIERS = [listRowBackground('clear'), listRowInsets({ top: 0, bottom: 0, leading: 0, trailing: 0 }), listRowSeparator('hidden')];

/**
 * iOS：放進 SwiftUI `List` 用原生 `onMove`，長按整列就能拖曳排序（跟 Apple 地圖的停靠點一樣）。
 * 不用 RNGH／JS responder：formSheet 裡 RNGH 取消不了 Pressable，JS 拖曳也會跟 sheet 的下拉手勢搶。
 * List 本身不會依內容長高，Host 的高度要另外量。
 */
export default function StopList({ stops, labels, onMove }: StopListProps) {
  const [heights, setHeights] = useState<Record<string, number>>({});
  // iOS 18+ 直接讀 List 實際排出的內容高度（含 SwiftUI 自己加的列距）；更舊的系統退回加總各列高度。
  const [contentHeight, setContentHeight] = useState<number | null>(null);
  const contentHeightModifier = useScrollGeometryChange((geometry) => {
    const next = Math.ceil(geometry.contentHeight);
    setContentHeight((prev) => (prev === next ? prev : next));
  });
  const height = contentHeight ?? stops.reduce((sum, stop) => sum + (heights[stop.key] ?? STOP_ROW_MIN_HEIGHT), 0);
  if (!stops.length) return null;
  return (
    <Host style={{ height }}>
      <List modifiers={[listStyle('plain'), scrollDisabled(true), ...(contentHeightModifier ? [contentHeightModifier] : [])]}>
        <List.ForEach
          onMove={(sources, destination) => {
            const from = sources[0];
            if (from === undefined) return;
            // SwiftUI 的 destination 是移除前的插入位置；往下移時要扣掉被移走的那一列。
            const to = destination > from ? destination - 1 : destination;
            if (to === from) return;
            haptic.select();
            onMove(from, to);
          }}>
          {stops.map((stop) => (
            <HStack key={stop.key} modifiers={ROW_MODIFIERS}>
              <RNHostView
                matchContents={{ vertical: true }}
                onLayout={({ nativeEvent }) => {
                  const next = Math.ceil(nativeEvent.layout.height);
                  setHeights((prev) => (prev[stop.key] === next ? prev : { ...prev, [stop.key]: next }));
                }}>
                <StopRow stop={stop} labels={labels} />
              </RNHostView>
            </HStack>
          ))}
        </List.ForEach>
      </List>
    </Host>
  );
}
