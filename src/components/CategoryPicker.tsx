// 分类选择器 - 左右各占一半,顶部"最近使用"虚拟大类,支持管理(增删)
import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Alert,
  TextInput,
  Modal,
} from 'react-native';
import { Category, SubCategory, Transaction } from '../models';
import type {
  CategoryDeleteResult,
  SubCategoryDeleteResult,
} from '../services/storage';
import { theme } from '../theme';
import { visualForName } from '../utils';
import { CategoryGlyph } from './CategoryGlyph';
import { Feather } from '@expo/vector-icons';

const RECENT_ID = '__recent__';
const RECENT_LIMIT = 8;

// 简易 emoji 选择(覆盖常用图标)
const ICON_PRESETS = ['🍔', '🚗', '🛍️', '🏠', '🎮', '💊', '📚', '📦',
  '💰', '🎁', '📈', '💵', '☕', '🍜', '✈️', '🎬', '🎵', '🛒', '🎓', '🐾', '💼', '🎨'];

interface CategoryPickerProps {
  type: 'income' | 'expense';
  categories: Category[];
  subCategories: SubCategory[];
  transactions?: Transaction[];
  selectedSubId?: string;
  onChange: (value: { categoryId: string; subCategoryId: string; fromRecent?: boolean }) => void;
  // 管理回调 - 由父组件实现真正的 store 调用
  onCreateCategory?: (data: Omit<Category, 'id'>) => Promise<void> | void;
  // 删大类的回调:store 会返回 CategoryDeleteResult 反映是否需要迁移账目
  onDeleteCategory?: (id: string) => Promise<CategoryDeleteResult>;
  onCreateSubCategory?: (data: Omit<SubCategory, 'id'>) => Promise<void> | void;
  // 删小类的回调:store 会返回 SubCategoryDeleteResult,告诉 UI 是否需要弹迁移对话框
  onDeleteSubCategory?: (id: string) => Promise<SubCategoryDeleteResult>;
  // 确认迁移并删除小类(用户在迁移弹窗中选定 toSubId 后调用)
  onConfirmMigrateDeleteSubCategory?: (fromSubId: string, toSubId: string) => Promise<void> | void;
}

export const CategoryPicker: React.FC<CategoryPickerProps> = ({
  type,
  categories,
  subCategories,
  transactions = [],
  selectedSubId,
  onChange,
  onCreateCategory,
  onDeleteCategory,
  onCreateSubCategory,
  onDeleteSubCategory,
  onConfirmMigrateDeleteSubCategory,
}) => {
  // 按当前 type 过滤的真实大类
  const filteredCategories = useMemo(
    () => categories.filter((c) => c.type === type),
    [categories, type]
  );

  // 提取最近使用的二级分类(去重,按最近一次使用时间倒序)
  // 限定在当前 type 下,只取前 N 个
  const recentSubs = useMemo<SubCategory[]>(() => {
    const seen = new Set<string>();
    const result: SubCategory[] = [];
    // transactions 已按 store 倒序(最新在前)
    for (const tx of transactions) {
      if (seen.has(tx.subCategoryId)) continue;
      const sub = subCategories.find((s) => s.id === tx.subCategoryId);
      if (!sub) continue;
      const parent = categories.find((c) => c.id === sub.categoryId);
      if (!parent || parent.type !== type) continue;
      seen.add(sub.id);
      result.push(sub);
      if (result.length >= RECENT_LIMIT) break;
    }
    return result;
  }, [transactions, subCategories, categories, type]);

  // 顶部"最近使用"虚拟大类 (有数据时才显示)
  const virtualCategories: Category[] = useMemo(
    () =>
      recentSubs.length > 0
        ? [
            {
              id: RECENT_ID,
              name: '最近使用',
              icon: '🕐',
              color: theme.colors.accent,
              type,
            },
          ]
        : [],
    [recentSubs, type]
  );

  const allCategories = [...virtualCategories, ...filteredCategories];

  // 初始 active:命中"最近使用"的二级? 或 selectedSubId 命中某大类?
  const initialCategoryId = useMemo(() => {
    if (selectedSubId) {
      const sub = subCategories.find((s) => s.id === selectedSubId);
      if (sub) {
        // 命中了二级 — 若在最近列表里,默认激活"最近使用"
        if (recentSubs.some((s) => s.id === sub.id)) return RECENT_ID;
        const parent = filteredCategories.find((c) => c.id === sub.categoryId);
        if (parent) return parent.id;
      }
    }
    return allCategories[0]?.id ?? '';
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [activeCategoryId, setActiveCategoryId] = useState(initialCategoryId);

  // type 切换或最近使用列表变化时,若当前 active 不在新列表里则重置
  useEffect(() => {
    if (!allCategories.some((c) => c.id === activeCategoryId)) {
      setActiveCategoryId(allCategories[0]?.id ?? '');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type, recentSubs.length]);

  // 当前激活大类对应的二级列表
  const subsForActive = useMemo<SubCategory[]>(() => {
    if (activeCategoryId === RECENT_ID) return recentSubs;
    return subCategories.filter((s) => s.categoryId === activeCategoryId);
  }, [activeCategoryId, subCategories, recentSubs]);

  const handleSelectCategory = (catId: string) => {
    setActiveCategoryId(catId);
  };

  const handleSelectSub = (sub: SubCategory) => {
    onChange({
      categoryId: sub.categoryId,
      subCategoryId: sub.id,
      fromRecent: activeCategoryId === RECENT_ID,
    });
  };

  // ---------- 管理模式 ----------
  const [manageMode, setManageMode] = useState(false);
  const [createModal, setCreateModal] = useState<
    null | { kind: 'category' } | { kind: 'sub'; parentId: string }
  >(null);
  const [draftName, setDraftName] = useState('');
  const [draftIcon, setDraftIcon] = useState(ICON_PRESETS[0]);

  const openCreateCategory = () => {
    setDraftName('');
    setDraftIcon(ICON_PRESETS[0]);
    setCreateModal({ kind: 'category' });
  };
  const openCreateSub = () => {
    if (activeCategoryId === RECENT_ID) return; // 不可在"最近使用"下添加
    setDraftName('');
    setDraftIcon(ICON_PRESETS[0]);
    setCreateModal({ kind: 'sub', parentId: activeCategoryId });
  };

  const submitCreate = async () => {
    const name = draftName.trim();
    if (!name) return;
    if (createModal?.kind === 'category' && onCreateCategory) {
      await onCreateCategory({
        name,
        icon: draftIcon,
        color: theme.colors.accent,
        type,
      });
    } else if (createModal?.kind === 'sub' && onCreateSubCategory) {
      await onCreateSubCategory({
        name,
        categoryId: createModal.parentId,
        icon: draftIcon,
      });
    }
    setCreateModal(null);
  };

  const handleDeleteCategory = (cat: Category) => {
    if (cat.id === RECENT_ID) return;
    const subIds = new Set(subCategories.filter((s) => s.categoryId === cat.id).map((s) => s.id));
    const affected = transactions.filter(
      (t) => subIds.has(t.subCategoryId) || t.subCategoryId === cat.id
    ).length;
    if (affected > 0) {
      Alert.alert('无法删除', `「${cat.name}」下还有 ${affected} 笔账目,请先修改这些账目的分类。`);
      return;
    }
    Alert.alert(
      '删除分类',
      `确定删除「${cat.name}」及其小类?`,
      [
        { text: '取消', style: 'cancel' },
        {
          text: '删除',
          style: 'destructive',
          onPress: () => onDeleteCategory?.(cat.id),
        },
      ]
    );
  };

  // 迁移弹窗状态
  const [migrateModal, setMigrateModal] = useState<
    | null
    | {
        fromSub: SubCategory;
        alternatives: SubCategory[];
        defaultSub?: SubCategory;
        affectedCount: number;
        selectedTarget: string;
      }
  >(null);

  const handleDeleteSub = async (sub: SubCategory) => {
    if (!onDeleteSubCategory) return;
    try {
      const result = await onDeleteSubCategory(sub.id);
      if (result.isDefault) {
        Alert.alert('无法删除', '默认「其他」分类不可删除。');
        return;
      }
      if (!result.needsMigration) {
        // 下方没账目,store 已直接删
        return;
      }
      // 需要迁移账目 → 弹迁移对话框
      const defaultId = result.defaultSub?.id ?? '';
      const target = result.alternatives[0]?.id ?? defaultId;
      if (!target) {
        Alert.alert(
          '无法删除',
          '该分类下有账目,但没有可迁移到的目标小类。请先创建其他小类。'
        );
        return;
      }
      setMigrateModal({
        fromSub: sub,
        alternatives: result.alternatives,
        defaultSub: result.defaultSub,
        affectedCount: result.affectedTxCount,
        selectedTarget: target,
      });
    } catch (e) {
      Alert.alert('删除失败', String((e as Error)?.message ?? e));
    }
  };

  const confirmMigrate = async () => {
    if (!migrateModal || !onConfirmMigrateDeleteSubCategory) return;
    try {
      await onConfirmMigrateDeleteSubCategory(
        migrateModal.fromSub.id,
        migrateModal.selectedTarget
      );
      setMigrateModal(null);
    } catch (e) {
      Alert.alert('迁移失败', String((e as Error)?.message ?? e));
    }
  };

  if (allCategories.length === 0) {
    return (
      <View style={styles.empty}>
        <ActivityIndicator size="small" color={theme.colors.gray} />
        <Text style={styles.emptyText}>暂无分类</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* 左:一级分类(占一半) */}
      <View style={styles.col}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.colContent}>
          {allCategories.map((cat) => {
            const isActive = cat.id === activeCategoryId;
            const isRecent = cat.id === RECENT_ID;
            return (
              <Pressable
                key={cat.id}
                onPress={() => handleSelectCategory(cat.id)}
                style={[styles.leftItem, isActive && styles.leftItemActive]}
              >
                {isRecent ? (
                  <View style={styles.recentIcon}>
                    <Feather name="clock" size={13} color="#fff" />
                  </View>
                ) : (
                  <CategoryGlyph
                    name={cat.name}
                    color={visualForName(cat.name, cat.icon, cat.color).color}
                    size={24}
                  />
                )}
                <Text
                  style={[styles.leftLabel, isActive && styles.leftLabelActive]}
                  numberOfLines={1}
                >
                  {cat.name}
                </Text>
                {isRecent && (
                  <Text style={styles.recentBadge}>{recentSubs.length}</Text>
                )}
                {manageMode && !isRecent && (
                  <Pressable
                    style={styles.delBtn}
                    onPress={(e) => {
                      e.stopPropagation?.();
                      handleDeleteCategory(cat);
                    }}
                    hitSlop={6}
                  >
                    <Text style={styles.delBtnText}>×</Text>
                  </Pressable>
                )}
              </Pressable>
            );
          })}
          {/* 左下角 + 新建一级分类 */}
          <Pressable style={styles.addBtn} onPress={openCreateCategory}>
            <Text style={styles.addBtnText}>+ 新建分类</Text>
          </Pressable>
        </ScrollView>
      </View>

      {/* 右:二级分类(占一半) */}
      <View style={[styles.col, styles.rightCol]}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.colContent}>
          {subsForActive.length === 0 ? (
            <Text style={styles.subEmpty}>该分类下暂无二级分类</Text>
          ) : (
            subsForActive.map((sub) => {
              const isSelected = sub.id === selectedSubId;
              const parent = categories.find((c) => c.id === sub.categoryId);
              return (
                <Pressable
                  key={sub.id}
                  onPress={() => handleSelectSub(sub)}
                  style={[styles.rightItem, isSelected && styles.rightItemSelected]}
                >
                  <CategoryGlyph
                    name={sub.name}
                    color={visualForName(sub.name, sub.icon || parent?.icon || '📦', parent?.color || theme.colors.accent).color}
                    size={22}
                  />
                  <View style={styles.rightTextWrap}>
                    <Text
                      style={[styles.rightLabel, isSelected && styles.rightLabelSelected]}
                      numberOfLines={1}
                    >
                      {sub.name}
                    </Text>
                    {activeCategoryId === RECENT_ID && parent && (
                      <Text style={styles.parentLabel} numberOfLines={1}>
                        {parent.name}
                      </Text>
                    )}
                  </View>
                  {manageMode ? (
                    <Pressable
                      style={styles.delBtn}
                      onPress={(e) => {
                        e.stopPropagation?.();
                        handleDeleteSub(sub);
                      }}
                      hitSlop={6}
                    >
                      <Text style={styles.delBtnText}>×</Text>
                    </Pressable>
                  ) : (
                    isSelected && <Text style={styles.checkMark}>✓</Text>
                  )}
                </Pressable>
              );
            })
          )}
          {/* 右下角 + 新建小类(最近使用下不可加) */}
          {activeCategoryId !== RECENT_ID && (
            <Pressable style={styles.addBtn} onPress={openCreateSub}>
              <Text style={styles.addBtnText}>+ 新建小类</Text>
            </Pressable>
          )}
        </ScrollView>
      </View>

      {/* 底部管理切换栏 */}
      <View style={styles.manageBar}>
        <Pressable
          style={styles.manageBarBtn}
          onPress={() => setManageMode((m) => !m)}
        >
          <Text style={styles.manageBarText}>
            {manageMode ? '完成' : '管理'}
          </Text>
        </Pressable>
      </View>

      {/* 创建弹窗 */}
      <Modal visible={createModal !== null} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>
              {createModal?.kind === 'category' ? '新建分类' : '新建小类'}
            </Text>
            <TextInput
              style={styles.modalInput}
              value={draftName}
              onChangeText={setDraftName}
              placeholder="名称"
              maxLength={12}
              autoFocus
            />
            <Text style={styles.modalSub}>选择图标</Text>
            <View style={styles.iconGrid}>
              {ICON_PRESETS.map((emoji) => {
                const selected = draftIcon === emoji;
                return (
                  <Pressable
                    key={emoji}
                    style={[styles.iconChip, selected && styles.iconChipSelected]}
                    onPress={() => setDraftIcon(emoji)}
                  >
                    <Text style={styles.iconChipText}>{emoji}</Text>
                  </Pressable>
                );
              })}
            </View>
            <View style={styles.modalBtns}>
              <Pressable
                style={[styles.modalBtn, styles.modalBtnCancel]}
                onPress={() => setCreateModal(null)}
              >
                <Text style={styles.modalBtnTextCancel}>取消</Text>
              </Pressable>
              <Pressable
                style={[styles.modalBtn, styles.modalBtnConfirm]}
                onPress={submitCreate}
              >
                <Text style={styles.modalBtnTextConfirm}>创建</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* 迁移账目弹窗 */}
      <Modal
        visible={migrateModal !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setMigrateModal(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { maxWidth: 380 }]}>
            <Text style={styles.modalTitle}>
              删除「{migrateModal?.fromSub.name}」
            </Text>
            <Text style={styles.modalSub}>
              该分类下有 {migrateModal?.affectedCount} 笔账目。请选择目标小类,
              账目将一并迁移过去:
            </Text>

            {/* 目标小类单选列表 */}
            <ScrollView style={{ maxHeight: 240 }}>
              {migrateModal?.defaultSub && (
                <Pressable
                  style={[
                    styles.targetRow,
                    migrateModal.selectedTarget === migrateModal.defaultSub.id &&
                      styles.targetRowSelected,
                  ]}
                  onPress={() =>
                    setMigrateModal((m) =>
                      m ? { ...m, selectedTarget: m.defaultSub!.id } : m
                    )
                  }
                >
                  <Text style={styles.targetRadio}>
                    {migrateModal.selectedTarget === migrateModal.defaultSub.id
                      ? '●'
                      : '○'}
                  </Text>
                  <Text style={styles.targetLabel}>
                    迁到「{migrateModal.defaultSub.name}」(默认)
                  </Text>
                </Pressable>
              )}
              {migrateModal?.alternatives.map((alt) => (
                <Pressable
                  key={alt.id}
                  style={[
                    styles.targetRow,
                    migrateModal.selectedTarget === alt.id &&
                      styles.targetRowSelected,
                  ]}
                  onPress={() =>
                    setMigrateModal((m) =>
                      m ? { ...m, selectedTarget: alt.id } : m
                    )
                  }
                >
                  <Text style={styles.targetRadio}>
                    {migrateModal.selectedTarget === alt.id ? '●' : '○'}
                  </Text>
                  <Text style={styles.targetLabel}>迁到「{alt.name}」</Text>
                </Pressable>
              ))}
            </ScrollView>

            <View style={[styles.modalBtns, { marginTop: 12 }]}>
              <Pressable
                style={[styles.modalBtn, styles.modalBtnCancel]}
                onPress={() => setMigrateModal(null)}
              >
                <Text style={styles.modalBtnTextCancel}>取消</Text>
              </Pressable>
              <Pressable
                style={[styles.modalBtn, styles.modalBtnConfirm]}
                onPress={confirmMigrate}
              >
                <Text style={styles.modalBtnTextConfirm}>迁移并删除</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: theme.colors.light,
  },
  col: {
    flex: 1, // 1:1 各占一半
  },
  rightCol: {
    backgroundColor: '#FFFFFF',
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderLeftColor: '#eee',
  },
  colContent: { paddingVertical: 6, paddingBottom: 48 },
  leftItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    gap: 8,
    position: 'relative',
  },
  leftItemActive: {
    backgroundColor: '#FFFFFF',
  },
  recentIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: theme.colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  leftLabel: {
    fontSize: 14,
    color: theme.colors.gray,
    flexShrink: 1,
  },
  leftLabelActive: {
    color: theme.colors.dark,
    fontWeight: '600',
  },
  recentBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    fontSize: 10,
    color: theme.colors.gray,
    backgroundColor: '#fff',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 8,
    overflow: 'hidden',
  },
  rightItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 11,
    paddingHorizontal: 12,
    gap: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#f0f0f0',
  },
  rightItemSelected: {
    backgroundColor: '#FFF3E0',
  },
  rightTextWrap: { flex: 1 },
  rightLabel: { fontSize: 14, color: theme.colors.dark },
  rightLabelSelected: { color: theme.colors.accent, fontWeight: '600' },
  parentLabel: { fontSize: 11, color: '#999', marginTop: 2 },
  checkMark: { fontSize: 16, color: theme.colors.accent, fontWeight: 'bold' },
  subEmpty: {
    color: theme.colors.gray,
    paddingVertical: 32,
    textAlign: 'center',
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  emptyText: { color: theme.colors.gray, marginTop: 8 },

  // 管理模式 - 删除按钮
  delBtn: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#FF4D4F',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 'auto',
  },
  delBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    lineHeight: 18,
  },

  // + 新建按钮
  addBtn: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginTop: 8,
    marginHorizontal: 8,
    borderRadius: 8,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: theme.colors.accent,
    borderStyle: 'dashed',
    alignItems: 'center',
  },
  addBtnText: { color: theme.colors.accent, fontSize: 13, fontWeight: '500' },

  // 底部管理栏
  manageBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 40,
    backgroundColor: '#fff',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#eee',
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  manageBarBtn: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 14,
    backgroundColor: '#FFF3E0',
  },
  manageBarText: { color: theme.colors.accent, fontSize: 13, fontWeight: '600' },

  // 创建弹窗
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalCard: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
  },
  modalTitle: { fontSize: 16, fontWeight: '600', color: '#333', marginBottom: 12 },
  modalInput: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: '#333',
    marginBottom: 16,
  },
  modalSub: { fontSize: 13, color: '#999', marginBottom: 8 },
  iconGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  iconChip: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: '#f5f5f5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconChipSelected: {
    backgroundColor: '#FFF3E0',
    borderWidth: 2,
    borderColor: theme.colors.accent,
  },
  iconChipText: { fontSize: 22 },
  modalBtns: { flexDirection: 'row', gap: 12 },
  modalBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  modalBtnCancel: { backgroundColor: '#f3f4f6' },
  modalBtnConfirm: { backgroundColor: theme.colors.accent },
  modalBtnTextCancel: { fontSize: 15, color: '#666', fontWeight: '500' },
  modalBtnTextConfirm: { fontSize: 15, color: '#fff', fontWeight: '500' },

  // 迁移弹窗 - 目标小类单选项
  targetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 6,
    gap: 8,
  },
  targetRowSelected: {
    backgroundColor: '#FFF3E0',
  },
  targetRadio: { fontSize: 16, color: theme.colors.accent, width: 16 },
  targetLabel: { fontSize: 14, color: '#333', flexShrink: 1 },
});