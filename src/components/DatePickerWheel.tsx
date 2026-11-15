// 五列 wheel picker:年/月/日/时/分
// 关键:getItemLayout 让 FlatList 跳过测量,scrollToOffset 像素精确
import React, { useMemo, useRef, useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ListRenderItem,
  Pressable,
  Platform,
} from 'react-native';
import { theme } from '../theme';
import { WEEKDAYS } from '../utils';

interface DatePickerWheelProps {
  value: Date;
  onChange: (date: Date) => void;
  minYear?: number;
  maxYear?: number;
}

const ITEM_HEIGHT = 44;
const VISIBLE_ITEMS = 5; // 中间项 + 上下各 2
const CONTAINER_HEIGHT = ITEM_HEIGHT * VISIBLE_ITEMS;
const TOP_PADDING = (CONTAINER_HEIGHT - ITEM_HEIGHT) / 2; // 80

const pad2 = (n: number) => String(n).padStart(2, '0');
const daysInMonth = (year: number, month1to12: number) =>
  new Date(year, month1to12, 0).getDate();

interface WheelProps {
  values: string[];
  selectedIndex: number;
  onChange: (index: number) => void;
  width: number;
}

const Wheel: React.FC<WheelProps> = ({ values, selectedIndex, onChange, width }) => {
  const listRef = useRef<FlatList<string>>(null);
  const lastNotifiedIdx = useRef<number>(selectedIndex);
  // 当 selectedIndex 由 effect 编程更新(scrollToOffset)时,跳过一次 onScroll 回调,
  // 否则 round offset 重新得到同一个 index 也会触发 onChange 形成循环
  const skipNextScroll = useRef(false);

  const getItemLayout = useCallback(
    (_: ArrayLike<string> | null | undefined, index: number) => ({
      length: ITEM_HEIGHT,
      offset: ITEM_HEIGHT * index,
      index,
    }),
    []
  );

  useEffect(() => {
    // 编程滚动时,跳过下一次 onScroll
    if (lastNotifiedIdx.current !== selectedIndex) {
      lastNotifiedIdx.current = selectedIndex;
      skipNextScroll.current = true;
    }
    listRef.current?.scrollToOffset({
      offset: selectedIndex * ITEM_HEIGHT,
      animated: false,
    });
  }, [selectedIndex]);

  const handleScroll = (e: { nativeEvent: { contentOffset: { y: number } } }) => {
    if (skipNextScroll.current) {
      skipNextScroll.current = false;
      return;
    }
    const offsetY = e.nativeEvent.contentOffset.y;
    const idx = Math.max(
      0,
      Math.min(values.length - 1, Math.round(offsetY / ITEM_HEIGHT))
    );
    if (idx !== lastNotifiedIdx.current) {
      lastNotifiedIdx.current = idx;
      onChange(idx);
    }
  };

  const renderItem: ListRenderItem<string> = ({ item, index }) => {
    const isSelected = index === selectedIndex;
    return (
      <Pressable
        style={[styles.wheelItem, { width, height: ITEM_HEIGHT }]}
        onPress={() => onChange(index)}
      >
        <View style={styles.wheelLabel}>
          <Text style={[styles.wheelItemText, isSelected && styles.wheelItemTextActive]}>
            {item.split('|')[0]}
          </Text>
          {item.includes('|') ? (
            <Text style={[styles.wheelSub, isSelected && styles.wheelSubActive]}>{item.split('|')[1]}</Text>
          ) : null}
        </View>
      </Pressable>
    );
  };

  return (
    <FlatList
      ref={listRef}
      data={values}
      keyExtractor={(_, idx) => String(idx)}
      renderItem={renderItem}
      getItemLayout={getItemLayout}
      initialScrollIndex={selectedIndex}
      initialNumToRender={Math.min(values.length, 30)}
      showsVerticalScrollIndicator={false}
      snapToInterval={ITEM_HEIGHT}
      decelerationRate={Platform.OS === 'web' ? 'normal' : 'fast'}
      contentContainerStyle={{ paddingVertical: TOP_PADDING }}
      onScroll={handleScroll}
      scrollEventThrottle={32}
      style={{ height: CONTAINER_HEIGHT }}
    />
  );
};

export const DatePickerWheel: React.FC<DatePickerWheelProps> = ({
  value,
  onChange,
  minYear,
  maxYear,
}) => {
  const currentYear = value.getFullYear();
  const yearMin = minYear ?? currentYear - 10;
  const yearMax = maxYear ?? currentYear + 10;
  const [precision, setPrecision] = useState<'time' | 'date'>('time');
  const years = useMemo(
    () => Array.from({ length: yearMax - yearMin + 1 }, (_, i) => `${yearMin + i}年`),
    [yearMin, yearMax]
  );
  const months = useMemo(() => Array.from({ length: 12 }, (_, i) => `${i + 1}月`), []);
  const yearIdx = currentYear - yearMin;
  const monthIdx = value.getMonth();
  const dayIdx = value.getDate() - 1;
  const hourIdx = value.getHours();
  const minuteIdx = value.getMinutes();

  const days = useMemo(() => {
    const count = daysInMonth(currentYear, monthIdx + 1);
    return Array.from({ length: count }, (_, i) => {
      const weekday = WEEKDAYS[new Date(currentYear, monthIdx, i + 1).getDay()];
      return `${i + 1}日|${weekday}`;
    });
  }, [currentYear, monthIdx]);

  const hours = useMemo(() => Array.from({ length: 24 }, (_, i) => pad2(i)), []);
  const minutes = useMemo(() => Array.from({ length: 60 }, (_, i) => pad2(i)), []);

  const setYear = useCallback(
    (idx: number) => {
      const next = new Date(value);
      next.setFullYear(yearMin + idx);
      const clampedDay = Math.min(
        next.getDate(),
        daysInMonth(next.getFullYear(), next.getMonth() + 1)
      );
      next.setDate(clampedDay);
      onChange(next);
    },
    [value, yearMin, onChange]
  );
  const setMonth = useCallback(
    (idx: number) => {
      const next = new Date(value);
      next.setMonth(idx);
      const clampedDay = Math.min(
        next.getDate(),
        daysInMonth(next.getFullYear(), idx + 1)
      );
      next.setDate(clampedDay);
      onChange(next);
    },
    [value, onChange]
  );
  const setDay = useCallback(
    (idx: number) => {
      const next = new Date(value);
      next.setDate(idx + 1);
      onChange(next);
    },
    [value, onChange]
  );
  const setHour = useCallback(
    (idx: number) => {
      const next = new Date(value);
      next.setHours(idx);
      onChange(next);
    },
    [value, onChange]
  );
  const setMinute = useCallback(
    (idx: number) => {
      const next = new Date(value);
      next.setMinutes(idx);
      onChange(next);
    },
    [value, onChange]
  );

  const showTime = precision === 'time';

  return (
    <View style={styles.wrap}>
      <View style={styles.head}>
        {(['time', 'date'] as const).map((key) => {
          const active = precision === key;
          return (
            <Pressable key={key} onPress={() => setPrecision(key)} style={styles.headTab}>
              <Text style={[styles.headText, active && styles.headTextOn]}>{key === 'time' ? '时刻' : '日期'}</Text>
              <View style={[styles.headBar, active && styles.headBarOn]} />
            </Pressable>
          );
        })}
      </View>
      <View style={styles.container}>
        <View style={styles.highlight} pointerEvents="none" />
        <View style={styles.row}>
          <Wheel values={years} selectedIndex={yearIdx} onChange={setYear} width={showTime ? 88 : 110} />
          <Wheel values={months} selectedIndex={monthIdx} onChange={setMonth} width={showTime ? 58 : 80} />
          <Wheel values={days} selectedIndex={dayIdx} onChange={setDay} width={showTime ? 78 : 110} />
          {showTime ? (
            <>
              <Wheel values={hours} selectedIndex={hourIdx} onChange={setHour} width={50} />
              <Wheel values={minutes} selectedIndex={minuteIdx} onChange={setMinute} width={50} />
            </>
          ) : null}
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: '#F7F7F8',
  },
  head: {
    height: 40,
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 18,
    gap: 28,
    backgroundColor: '#FFFFFF',
  },
  headTab: { alignItems: 'center' },
  headText: { ...theme.typography.body, color: theme.colors.textMuted },
  headTextOn: { color: theme.colors.text, fontWeight: '600' },
  headBar: { marginTop: 6, width: 28, height: 2, borderRadius: 1, backgroundColor: 'transparent' },
  headBarOn: { backgroundColor: theme.colors.accent },
  container: {
    height: CONTAINER_HEIGHT,
    backgroundColor: theme.colors.pageAlt,
    overflow: 'hidden',
  },
  row: { flexDirection: 'row', flex: 1, justifyContent: 'center' },
  highlight: {
    position: 'absolute',
    left: 8,
    right: 8,
    top: TOP_PADDING,
    height: ITEM_HEIGHT,
    backgroundColor: theme.colors.page,
    borderRadius: theme.borderRadius.md,
  },
  wheelItem: { justifyContent: 'center', alignItems: 'center' },
  wheelLabel: { alignItems: 'center', justifyContent: 'center' },
  wheelItemText: { ...theme.typography.listTitle, color: theme.colors.textPlaceholder },
  wheelItemTextActive: { ...theme.typography.title, color: theme.colors.text },
  wheelSub: { ...theme.typography.micro, color: theme.colors.textPlaceholder, marginTop: -1 },
  wheelSubActive: { color: theme.colors.textSecondary },
});