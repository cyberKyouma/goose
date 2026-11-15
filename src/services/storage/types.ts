// Storage Repository 契约
// - native 端: expo-sqlite 实现 (见 ./native.ts)
// - web 端  : AsyncStorage 实现 (见 ./web.ts) — 仅作开发期 web 测试
//
// 业务方 (store) 只依赖此接口,不感知具体实现。

import type { Category, SubCategory, Transaction, TransactionStatus } from '../../models';

// ---------- 删除结果类型 ----------

/** 删除 category 的反馈(可能需要让用户重选) */
export interface CategoryDeleteResult {
  needsMigration: boolean;
  affectedTxCount: number;
  alternatives: Category[]; // 候选 target category(同 type)
}

/** 删除 subCategory 的反馈(需要让用户重选) */
export interface SubCategoryDeleteResult {
  needsMigration: boolean;
  affectedTxCount: number;
  alternatives: SubCategory[]; // 本大类下其他非默认 sub
  defaultSub?: SubCategory; // 本大类的"其他"(若存在)
  isDefault: boolean; // 是否为不可删除的默认"其他"
}

// ---------- Repository 接口 ----------

export interface GooseRepository {
  // 生命周期
  init(): Promise<void>;

  // ----- 分类 -----
  loadCategories(): Promise<Category[]>;
  insertCategory(c: Omit<Category, 'id'>): Promise<Category>;
  deleteCategory(id: string): Promise<CategoryDeleteResult>;

  // ----- 小类 -----
  loadSubCategories(): Promise<SubCategory[]>;
  insertSubCategory(s: Omit<SubCategory, 'id'>): Promise<SubCategory>;
  /**
   * 删小类:
   * - 默认"其他"(isDefault=1)→ 抛错
   * - 下面无账目 → 直接删
   * - 下面有账目 → 返回 SubCategoryDeleteResult,等待 UI 决策
   *    调用方拿到结果后,通过下面的 migrateAndDeleteSubCategory 完成迁移+删除
   */
  deleteSubCategory(id: string): Promise<SubCategoryDeleteResult>;
  /**
   * 迁移账目后删除小类
   * @param fromSubId 要删除的小类
   * @param toSubId 账目目标小类(必须在同 category 下)
   */
  migrateAndDeleteSubCategory(fromSubId: string, toSubId: string): Promise<void>;

  // ----- 账目 -----
  loadTransactions(): Promise<Transaction[]>;
  insertTransaction(t: Omit<Transaction, 'id'>): Promise<Transaction>;
  updateTransaction(t: Transaction): Promise<Transaction>;
  revokeTransaction(id: string): Promise<void>;
  restoreTransaction(id: string): Promise<void>;
  deleteTransaction(id: string): Promise<void>; // 物理删除,需 UI 二次确认

  // ----- 统计 -----
  /**
   * 指定时间区间内 status=active 的收支合计
   * 边界:endMs 已含当天 23:59:59.999
   */
  sumRange(startMs: number, endMs: number): Promise<{
    totalIncome: number;
    totalExpense: number;
  }>;
}

// ---------- 公共行类型 (DB row) ----------

export interface CategoryRow {
  id: string;
  name: string;
  icon: string;
  color: string;
  type: 'income' | 'expense';
  sort_order: number;
  created_at: number;
  updated_at: number;
}

export interface SubCategoryRow {
  id: string;
  category_id: string;
  name: string;
  icon: string;
  is_default: number; // 0/1
  sort_order: number;
  created_at: number;
  updated_at: number;
}

export interface TransactionRow {
  id: string;
  amount: number;
  type: 'income' | 'expense';
  sub_category_id: string;
  occurred_at: number; // ms
  note: string | null;
  status: TransactionStatus;
  revoked_at: number | null;
  created_at: number;
  updated_at: number;
}

// ---------- row ↔ domain 映射 ----------

export const rowToCategory = (r: CategoryRow): Category => ({
  id: r.id,
  name: r.name,
  icon: r.icon,
  color: r.color,
  type: r.type,
});

export const rowToSubCategory = (r: SubCategoryRow): SubCategory => ({
  id: r.id,
  name: r.name,
  categoryId: r.category_id,
  icon: r.icon,
  isDefault: r.is_default === 1,
  sortOrder: r.sort_order,
});

export const rowToTransaction = (r: TransactionRow): Transaction => ({
  id: r.id,
  amount: r.amount,
  type: r.type,
  subCategoryId: r.sub_category_id,
  date: new Date(r.occurred_at).toISOString(),
  note: r.note ?? '',
  status: r.status,
  revokedAt: r.revoked_at ? new Date(r.revoked_at).toISOString() : undefined,
});

/** 把 ISO date 转成毫秒时间戳 */
export const dateToMs = (iso: string): number => new Date(iso).getTime();
