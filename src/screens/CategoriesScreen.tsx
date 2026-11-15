// 分类管理: 收入/支出的一级分类与二级分类增删
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Alert,
  Modal,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Feather } from '@expo/vector-icons';
import { useStore } from '../stores/appStore';
import { theme } from '../theme';
import { Category, SubCategory } from '../models';
import { CategoryGlyph } from '../components';
import { visualForName } from '../utils';

const ICONS = ['🍜', '🚗', '🛍️', '🏠', '🎬', '💊', '📚', '👜', '🎁', '📈', '🧋', '🍓', '💧', '📦'];

type Draft = null | { kind: 'category' } | { kind: 'sub'; categoryId: string };

export const CategoriesScreen: React.FC = () => {
  const navigation = useNavigation();
  const categories = useStore((s) => s.categories);
  const subCategories = useStore((s) => s.subCategories);
  const transactions = useStore((s) => s.transactions);
  const addCategory = useStore((s) => s.addCategory);
  const removeCategory = useStore((s) => s.removeCategory);
  const addSubCategory = useStore((s) => s.addSubCategory);
  const removeSubCategory = useStore((s) => s.removeSubCategory);
  const confirmMigrate = useStore((s) => s.confirmMigrateDeleteSubCategory);

  const [flow, setFlow] = useState<'expense' | 'income'>('expense');
  const [draft, setDraft] = useState<Draft>(null);
  const [name, setName] = useState('');
  const [icon, setIcon] = useState(ICONS[0]);

  const visible = categories.filter((c) => c.type === flow);

  const txCountForCategory = (cat: Category): number => {
    const ids = new Set(subCategories.filter((s) => s.categoryId === cat.id).map((s) => s.id));
    return transactions.filter((t) => ids.has(t.subCategoryId) || t.subCategoryId === cat.id).length;
  };

  const openCategory = (): void => {
    setName('');
    setIcon(ICONS[0]);
    setDraft({ kind: 'category' });
  };

  const openSub = (categoryId: string): void => {
    setName('');
    setIcon(ICONS[0]);
    setDraft({ kind: 'sub', categoryId });
  };

  const submitDraft = async (): Promise<void> => {
    const trimmed = name.trim();
    if (!trimmed) {
      Alert.alert('提示', '请输入名称');
      return;
    }
    if (draft?.kind === 'category') {
      const color = theme.colors.categoryColors[visible.length % theme.colors.categoryColors.length];
      await addCategory({ name: trimmed, icon, color, type: flow });
    } else if (draft?.kind === 'sub') {
      await addSubCategory({ name: trimmed, categoryId: draft.categoryId, icon });
    }
    setDraft(null);
  };

  const onDeleteCategory = (cat: Category): void => {
    const count = txCountForCategory(cat);
    if (count > 0) {
      Alert.alert('无法删除', `「${cat.name}」下还有 ${count} 笔账目,请先修改这些账目的分类。`);
      return;
    }
    Alert.alert('删除分类', `确定删除「${cat.name}」及其小类?`, [
      { text: '取消', style: 'cancel' },
      {
        text: '删除',
        style: 'destructive',
        onPress: () => {
          removeCategory(cat.id).catch((e) => Alert.alert('删除失败', String((e as Error)?.message ?? e)));
        },
      },
    ]);
  };

  const onDeleteSub = (sub: SubCategory): void => {
    if (sub.isDefault) {
      Alert.alert('无法删除', '默认「其他」不可删除');
      return;
    }
    Alert.alert('删除小类', `确定删除「${sub.name}」?`, [
      { text: '取消', style: 'cancel' },
      {
        text: '删除',
        style: 'destructive',
        onPress: () => {
          removeSubCategory(sub.id)
            .then(async (result) => {
              if (result.isDefault) {
                Alert.alert('无法删除', '默认「其他」不可删除');
                return;
              }
              if (!result.needsMigration) return;
              const target = result.defaultSub ?? result.alternatives[0];
              if (!target) {
                Alert.alert('无法删除', '没有可迁移的目标小类');
                return;
              }
              Alert.alert(
                '迁移账目',
                `「${sub.name}」下有 ${result.affectedTxCount} 笔账目,将迁移到「${target.name}」后删除。`,
                [
                  { text: '取消', style: 'cancel' },
                  {
                    text: '迁移并删除',
                    style: 'destructive',
                    onPress: () => {
                      confirmMigrate(sub.id, target.id).catch((e) =>
                        Alert.alert('迁移失败', String((e as Error)?.message ?? e))
                      );
                    },
                  },
                ]
              );
            })
            .catch((e) => Alert.alert('删除失败', String((e as Error)?.message ?? e)));
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.headerBtn} accessibilityLabel="返回">
          <Feather name="chevron-left" size={26} color={theme.colors.text} />
        </Pressable>
        <Text style={styles.title}>分类</Text>
        <View style={styles.headerBtn} />
      </View>

      <View style={styles.switchRow}>
        <Pressable
          style={[styles.switchBtn, flow === 'expense' && styles.switchExpense]}
          onPress={() => setFlow('expense')}
        >
          <Text style={[styles.switchText, flow === 'expense' && styles.switchTextOn]}>支出</Text>
        </Pressable>
        <Pressable
          style={[styles.switchBtn, flow === 'income' && styles.switchIncome]}
          onPress={() => setFlow('income')}
        >
          <Text style={[styles.switchText, flow === 'income' && styles.switchTextIncome]}>收入</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
        {visible.map((cat) => {
          const subs = subCategories.filter((s) => s.categoryId === cat.id);
          return (
            <View key={cat.id} style={styles.card}>
              <View style={styles.cardHead}>
                <CategoryGlyph
                  name={cat.name}
                  color={visualForName(cat.name, cat.icon, cat.color).color}
                  size={theme.layout.listIconSize}
                />
                <Text style={styles.catName}>{cat.name}</Text>
                <Pressable onPress={() => onDeleteCategory(cat)} hitSlop={6}>
                  <Text style={styles.deleteText}>删除</Text>
                </Pressable>
              </View>
              {subs.map((sub) => (
                <View key={sub.id} style={styles.subRow}>
                  <View style={styles.subMain}>
                    <CategoryGlyph
                      name={sub.name}
                      color={visualForName(sub.name, sub.icon || cat.icon, cat.color).color}
                      size={28}
                    />
                    <Text style={styles.subName}>
                      {sub.name}
                      {sub.isDefault ? '  · 默认' : ''}
                    </Text>
                  </View>
                  {sub.isDefault ? null : (
                    <Pressable onPress={() => onDeleteSub(sub)} hitSlop={8} accessibilityLabel={`删除${sub.name}`}>
                      <Feather name="x" size={16} color={theme.colors.textPlaceholder} />
                    </Pressable>
                  )}
                </View>
              ))}
              <Pressable style={styles.addSub} onPress={() => openSub(cat.id)}>
                <Text style={styles.addSubText}>+ 添加小类</Text>
              </Pressable>
            </View>
          );
        })}

        <Pressable style={styles.addCat} onPress={openCategory}>
          <Text style={styles.addCatText}>+ 添加一级分类</Text>
        </Pressable>
      </ScrollView>

      <Modal visible={draft !== null} transparent animationType="fade" onRequestClose={() => setDraft(null)}>
        <View style={styles.overlay}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>{draft?.kind === 'sub' ? '新建小类' : '新建分类'}</Text>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="名称"
              placeholderTextColor="#C0C0C0"
              maxLength={12}
              autoFocus
            />
            <View style={styles.iconGrid}>
              {ICONS.map((emoji) => (
                <Pressable
                  key={emoji}
                  style={[styles.iconChip, icon === emoji && styles.iconChipOn]}
                  onPress={() => setIcon(emoji)}
                >
                  <Text style={styles.iconChipText}>{emoji}</Text>
                </Pressable>
              ))}
            </View>
            <View style={styles.modalBtns}>
              <Pressable style={styles.modalCancel} onPress={() => setDraft(null)}>
                <Text style={styles.modalCancelText}>取消</Text>
              </Pressable>
              <Pressable style={styles.modalOk} onPress={() => void submitDraft()}>
                <Text style={styles.modalOkText}>创建</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.pageAlt },
  header: {
    height: theme.layout.topBarHeight,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.xs,
    backgroundColor: theme.colors.page,
  },
  headerBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  title: { ...theme.typography.title, fontWeight: '700', color: theme.colors.text },
  switchRow: {
    flexDirection: 'row',
    margin: theme.layout.pagePadding,
    backgroundColor: theme.colors.page,
    borderRadius: 10,
    padding: theme.spacing.xs,
  },
  switchBtn: { flex: 1, height: 36, borderRadius: theme.borderRadius.md, alignItems: 'center', justifyContent: 'center' },
  switchExpense: { backgroundColor: '#E9F9F0' },
  switchIncome: { backgroundColor: '#FDECEE' },
  switchText: { ...theme.typography.body, color: theme.colors.textSecondary, fontWeight: '600' },
  switchTextOn: { color: theme.colors.expense },
  switchTextIncome: { color: theme.colors.income },
  list: { paddingHorizontal: theme.layout.pagePadding, paddingBottom: theme.spacing.xl },
  card: {
    backgroundColor: theme.colors.page,
    borderRadius: 12,
    marginBottom: 12,
    overflow: 'hidden',
  },
  cardHead: { flexDirection: 'row', alignItems: 'center', padding: 12, gap: 10 },
  catName: { flex: 1, ...theme.typography.listTitle, fontWeight: '700', color: theme.colors.text },
  deleteText: { color: theme.colors.income, ...theme.typography.label, fontWeight: '400' },
  subRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: theme.layout.pagePadding,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.colors.divider,
  },
  subMain: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm, flex: 1 },
  subName: { ...theme.typography.body, color: theme.colors.text },
  addSub: {
    paddingVertical: 12,
    paddingHorizontal: theme.layout.pagePadding,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.colors.divider,
  },
  addSubText: { color: theme.colors.accent, ...theme.typography.label, fontWeight: '600' },
  addCat: {
    borderWidth: 1,
    borderColor: theme.colors.accent,
    borderStyle: 'dashed',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    backgroundColor: theme.colors.page,
  },
  addCatText: { color: theme.colors.accent, ...theme.typography.body, fontWeight: '700' },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.spacing.lg,
  },
  modal: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: theme.colors.page,
    borderRadius: 12,
    padding: 18,
  },
  modalTitle: { ...theme.typography.listTitle, fontWeight: '700', color: theme.colors.text, marginBottom: 12 },
  input: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.borderRadius.md,
    paddingHorizontal: 12,
    height: 42,
    ...theme.typography.body,
    color: theme.colors.text,
    marginBottom: 12,
  },
  iconGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm, marginBottom: theme.spacing.md },
  iconChip: {
    width: 40,
    height: 40,
    borderRadius: theme.borderRadius.md,
    backgroundColor: theme.colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconChipOn: { backgroundColor: '#FFF3E8', borderWidth: 1.5, borderColor: theme.colors.accent },
  iconChipText: { fontSize: 20 },
  modalBtns: { flexDirection: 'row', gap: 10 },
  modalCancel: {
    flex: 1,
    height: 40,
    borderRadius: theme.borderRadius.md,
    backgroundColor: theme.colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalOk: {
    flex: 1,
    height: 40,
    borderRadius: theme.borderRadius.md,
    backgroundColor: theme.colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCancelText: { color: theme.colors.textSecondary, fontWeight: '600' },
  modalOkText: { color: theme.colors.white, fontWeight: '700' },
});
