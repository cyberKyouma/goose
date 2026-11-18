// 记一笔底部:左右联动的分类滚轮。左为一级,右为二级。
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, FlatList, Pressable, Platform, ListRenderItem } from 'react-native';
import { Category, SubCategory, Transaction } from '../models';
import { theme } from '../theme';
import { visualForName } from '../utils';
import { CategoryGlyph } from './CategoryGlyph';

const RECENT_ID = '__recent__';
const RECENT_LIMIT = 12;
const ITEM_H = 46;
const VISIBLE = 5;
const PAD = (ITEM_H * VISIBLE - ITEM_H) / 2;

interface CategoryWheelProps {
  type: 'income' | 'expense';
  categories: Category[];
  subCategories: SubCategory[];
  transactions?: Transaction[];
  selectedSubId?: string;
  query?: string;
  onChange: (value: { categoryId: string; subCategoryId: string; fromRecent?: boolean }) => void;
}

interface WheelRow {
  id: string;
  label: string;
  iconName?: string;
  iconColor?: string;
}

const SnapColumn: React.FC<{
  rows: WheelRow[];
  selectedIndex: number;
  onSelect: (index: number) => void;
  showIcon?: boolean;
}> = ({ rows, selectedIndex, onSelect, showIcon }) => {
  const listRef = useRef<FlatList<WheelRow>>(null);
  const lastIdx = useRef(selectedIndex);
  const skipScroll = useRef(0);
  const fromPress = useRef(false);

  useEffect(() => {
    if (lastIdx.current !== selectedIndex) {
      lastIdx.current = selectedIndex;
      // 点选会先改选中项再滚到中间。Web 上这次滚动还会再抛出旧偏移,把选中项弹回去。
      if (fromPress.current) skipScroll.current = 3;
      fromPress.current = false;
    }
    listRef.current?.scrollToOffset({ offset: Math.max(0, selectedIndex) * ITEM_H, animated: false });
  }, [selectedIndex, rows]);

  const onScroll = (y: number): void => {
    if (skipScroll.current > 0) {
      skipScroll.current -= 1;
      return;
    }
    const idx = Math.max(0, Math.min(rows.length - 1, Math.round(y / ITEM_H)));
    if (idx !== lastIdx.current) {
      lastIdx.current = idx;
      onSelect(idx);
    }
  };

  const choose = (index: number): void => {
    fromPress.current = true;
    onSelect(index);
  };

  const renderItem: ListRenderItem<WheelRow> = ({ item, index }) => {
    const distance = Math.abs(index - selectedIndex);
    const selected = distance === 0;
    return (
      <Pressable style={styles.item} onPress={() => choose(index)}>
        {showIcon && item.iconColor ? (
          <View style={{ opacity: selected ? 1 : 0.45, marginRight: 8 }}>
            <CategoryGlyph name={item.iconName || item.label} color={item.iconColor} size={26} />
          </View>
        ) : null}
        <Text
          style={[
            styles.itemText,
            selected && styles.itemTextOn,
            !selected && distance === 1 && styles.itemTextNear,
            !selected && distance > 1 && styles.itemTextFar,
          ]}
          numberOfLines={1}
        >
          {item.label}
        </Text>
      </Pressable>
    );
  };

  if (rows.length === 0) {
    return (
      <View style={styles.emptyCol}>
        <Text style={styles.emptyText}>没有匹配的分类</Text>
      </View>
    );
  }

  return (
    <FlatList
      ref={listRef}
      data={rows}
      keyExtractor={(row) => row.id}
      renderItem={renderItem}
      getItemLayout={(_, index) => ({ length: ITEM_H, offset: ITEM_H * index, index })}
      initialScrollIndex={Math.max(0, Math.min(selectedIndex, rows.length - 1))}
      showsVerticalScrollIndicator={false}
      snapToInterval={ITEM_H}
      decelerationRate={Platform.OS === 'web' ? 'normal' : 'fast'}
      contentContainerStyle={{ paddingVertical: PAD }}
      onScroll={(e) => onScroll(e.nativeEvent.contentOffset.y)}
      scrollEventThrottle={32}
      style={{ height: ITEM_H * VISIBLE }}
    />
  );
};

export const CategoryWheel: React.FC<CategoryWheelProps> = ({
  type,
  categories,
  subCategories,
  transactions = [],
  selectedSubId,
  query = '',
  onChange,
}) => {
  const q = query.trim();
  const parents = useMemo(() => categories.filter((c) => c.type === type), [categories, type]);

  const recentSubs = useMemo<SubCategory[]>(() => {
    const seen = new Set<string>();
    const result: SubCategory[] = [];
    for (const tx of transactions) {
      if ((tx.status ?? 'active') === 'revoked') continue;
      if (seen.has(tx.subCategoryId)) continue;
      const sub = subCategories.find((s) => s.id === tx.subCategoryId);
      if (!sub) continue;
      const parent = categories.find((c) => c.id === sub.categoryId);
      if (!parent || parent.type !== type) continue;
      if (q && !sub.name.includes(q) && !parent.name.includes(q)) continue;
      seen.add(sub.id);
      result.push(sub);
      if (result.length >= RECENT_LIMIT) break;
    }
    return result;
  }, [categories, q, subCategories, transactions, type]);

  const parentRows = useMemo<WheelRow[]>(() => {
    const rows: WheelRow[] = [];
    if (recentSubs.length > 0) rows.push({ id: RECENT_ID, label: '最近使用' });
    for (const cat of parents) {
      const subs = subCategories.filter((s) => s.categoryId === cat.id);
      const hit =
        !q ||
        cat.name.includes(q) ||
        subs.some((s) => s.name.includes(q));
      if (!hit) continue;
      rows.push({ id: cat.id, label: cat.name });
    }
    return rows;
  }, [parents, q, recentSubs.length, subCategories]);

  const initialParent = (): string => {
    if (selectedSubId && recentSubs.some((s) => s.id === selectedSubId) && !q) return RECENT_ID;
    const sub = subCategories.find((s) => s.id === selectedSubId);
    if (sub && parentRows.some((r) => r.id === sub.categoryId)) return sub.categoryId;
    return parentRows[0]?.id ?? '';
  };

  const [activeParentId, setActiveParentId] = useState(initialParent);

  useEffect(() => {
    if (!parentRows.some((r) => r.id === activeParentId)) {
      setActiveParentId(parentRows[0]?.id ?? '');
    }
  }, [activeParentId, parentRows]);

  const childRows = useMemo<WheelRow[]>(() => {
    const list =
      activeParentId === RECENT_ID
        ? recentSubs
        : subCategories.filter((s) => s.categoryId === activeParentId);
    return list
      .filter((s) => !q || s.name.includes(q) || (activeParentId !== RECENT_ID && parents.find((c) => c.id === s.categoryId)?.name.includes(q)))
      .map((sub) => {
        const parent = categories.find((c) => c.id === sub.categoryId);
        const visual = visualForName(sub.name, sub.icon || parent?.icon || '📦', parent?.color || theme.colors.accent);
        return { id: sub.id, label: sub.name, iconName: sub.name, iconColor: visual.color };
      });
  }, [activeParentId, categories, parents, q, recentSubs, subCategories]);

  const parentIndex = Math.max(0, parentRows.findIndex((r) => r.id === activeParentId));
  const foundChild = childRows.findIndex((r) => r.id === selectedSubId);
  const childIndex = foundChild >= 0 ? foundChild : 0;

  useEffect(() => {
    if (foundChild >= 0 || childRows.length === 0) return;
    const row = childRows[0];
    const sub = subCategories.find((s) => s.id === row.id);
    if (!sub) return;
    onChange({
      categoryId: sub.categoryId,
      subCategoryId: sub.id,
      fromRecent: activeParentId === RECENT_ID,
    });
  }, [activeParentId, childRows, foundChild, onChange, subCategories]);

  const emitSub = (subId: string): void => {
    const sub = subCategories.find((s) => s.id === subId);
    if (!sub) return;
    onChange({
      categoryId: sub.categoryId,
      subCategoryId: sub.id,
      fromRecent: activeParentId === RECENT_ID,
    });
  };

  const onParent = (index: number): void => {
    const row = parentRows[index];
    if (!row || row.id === activeParentId) return;
    setActiveParentId(row.id);
    const list =
      row.id === RECENT_ID
        ? recentSubs
        : subCategories.filter((s) => s.categoryId === row.id && (!q || s.name.includes(q) || row.label.includes(q)));
    if (list.some((s) => s.id === selectedSubId)) return;
    const first = list[0];
    if (!first) return;
    onChange({
      categoryId: first.categoryId,
      subCategoryId: first.id,
      fromRecent: row.id === RECENT_ID,
    });
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.highlight} pointerEvents="none" />
      <View style={styles.columns}>
        <View style={styles.left}>
          <SnapColumn
            key={`p-${parentRows.map((r) => r.id).join(',')}`}
            rows={parentRows}
            selectedIndex={parentIndex}
            onSelect={onParent}
          />
        </View>
        <View style={styles.right}>
          <SnapColumn
            key={`c-${activeParentId}-${childRows.map((r) => r.id).join(',')}`}
            rows={childRows}
            selectedIndex={childRows.length ? childIndex : 0}
            onSelect={(index) => {
              const row = childRows[index];
              if (row) emitSub(row.id);
            }}
            showIcon
          />
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: {
    height: ITEM_H * VISIBLE,
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
  },
  highlight: {
    position: 'absolute',
    left: 12,
    right: 12,
    top: PAD,
    height: ITEM_H,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: '#F0F0F0',
  },
  columns: { flexDirection: 'row', flex: 1 },
  left: { flex: 0.9 },
  right: { flex: 1.2 },
  item: {
    height: ITEM_H,
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
  },
  itemText: { fontSize: 15, color: '#D0D0D0' },
  itemTextNear: { color: '#C4C4C4' },
  itemTextFar: { color: '#E0E0E0' },
  itemTextOn: { color: '#222222', fontWeight: '600', fontSize: 16 },
  emptyCol: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyText: { color: theme.colors.textMuted, fontSize: 13 },
});
