import { useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, View, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';

import type { SwipePagerProps } from './SwipePager.types';

/**
 * 原生橫向分頁（UIScrollView／HorizontalScrollView 的 paging）：頁面 1:1 跟手、放開依原生物理吸附，
 * 與 SwiftUI `TabView(.page)` 同一套手感。上方的 SegmentedControl 仍是狀態來源與無障礙入口；
 * 點分段時這裡捲到對應頁；手指滑動則等頁面吸附停好才回報新頁（同 UIPageViewController）——
 * 滑到一半就切換的話，上方標題／追車卡、地圖會在手指還沒放開時換掉，版面會跳。
 *
 * 外層是直向 ScrollView，所以高度取「目前看得到的頁」中最高的那頁：短頁不會留一大片空白，
 * 滑動途中也不會把較高的鄰頁切掉。
 */
export default function SwipePagerBase({ index, pages, onIndexChange, style }: SwipePagerProps) {
  const scroller = useRef<ScrollView>(null);
  const [width, setWidth] = useState(0);
  const [heights, setHeights] = useState<readonly number[]>([]);
  const [visible, setVisible] = useState<readonly [number, number]>([index, index]);
  // 最後一次「由這裡回報」或「由外部指定」的頁：只有外部改 index（點分段）才需要程式捲動。
  const reported = useRef(index);
  // 初始頁只在掛上時套用一次：之後若跟著 index 變，Fabric 會在拖動中把 contentOffset 硬設回去，畫面跳一格。
  const [initialIndex] = useState(Math.max(0, index));

  useEffect(() => {
    if (width === 0 || index === reported.current) return;
    reported.current = index;
    scroller.current?.scrollTo({ x: index * width, animated: true });
  }, [index, width]);

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (width === 0) return;
    const position = e.nativeEvent.contentOffset.x / width;
    const range: [number, number] = [Math.max(0, Math.floor(position)), Math.min(pages.length - 1, Math.ceil(position))];
    if (range[0] !== visible[0] || range[1] !== visible[1]) setVisible(range);
  };

  const onSettle = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (width === 0) return;
    const position = e.nativeEvent.contentOffset.x / width;
    // 放開時剛好對齊頁面不會有 momentum，onScrollEndDrag 也走這裡；沒對齊就等 momentum 結束。
    if (Math.abs(position - Math.round(position)) > 0.01) return;
    const settled = Math.min(pages.length - 1, Math.max(0, Math.round(position)));
    if (settled === reported.current) return;
    reported.current = settled;
    onIndexChange(settled);
  };

  const tallest = Math.max(0, ...heights.slice(visible[0], visible[1] + 1));

  return (
    <View style={style} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      {width > 0 ? (
        <ScrollView
          ref={scroller}
          horizontal
          pagingEnabled
          nestedScrollEnabled
          showsHorizontalScrollIndicator={false}
          scrollEventThrottle={16}
          contentOffset={{ x: initialIndex * width, y: 0 }}
          onScroll={onScroll}
          onMomentumScrollEnd={onSettle}
          onScrollEndDrag={onSettle}
          style={[styles.scroller, tallest > 0 && { height: tallest }]}
          contentContainerStyle={styles.track}>
          {pages.map((page, i) => (
            <View
              key={i}
              style={{ width }}
              onLayout={(e) => {
                const h = e.nativeEvent.layout.height;
                setHeights((prev) => (prev[i] === h ? prev : Object.assign([...prev], { [i]: h })));
              }}>
              {page}
            </View>
          ))}
        </ScrollView>
      ) : (
        // 還沒量到寬度（第一個 frame）：先只放目前這頁，避免整塊空白。
        pages[index]
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  scroller: { flexGrow: 1 },
  track: { alignItems: 'flex-start' },
});
