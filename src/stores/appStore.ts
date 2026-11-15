// 全局状态管理 - Zustand
// 持久化走 repository (src/services/storage),store 层只维护内存态 + reload

import { create } from 'zustand';
import {
  Category,
  SubCategory,
  Transaction,
  OverviewConfig,
  FilterParams,
  TransactionStatus,
} from '../models';
import { repository } from '../services/storage';
import type {
  CategoryDeleteResult,
  SubCategoryDeleteResult,
} from '../services/storage';
import { getMonthStart, getMonthEnd, getYearStart, getYearEnd } from '../utils';

export type { CategoryDeleteResult, SubCategoryDeleteResult };

interface AppState {
  // 数据
  categories: Category[];
  subCategories: SubCategory[];
  transactions: Transaction[]; // 含 revoked

  // 筛选
  filters: FilterParams;
  dateRange: 'day' | 'week' | 'month' | 'year';

  // 配置
  overviewConfig: OverviewConfig;

  // 统计
  totalIncome: number;
  totalExpense: number;
  balance: number;

  // 加载状态
  isLoading: boolean;

  // 金额隐私(流水/图表共用,仅内存)
  amountsHidden: boolean;
  toggleAmountsHidden: () => void;

  // 短时反馈,例如「保存成功」
  flashMessage: string | null;
  setFlashMessage: (message: string | null) => void;

  // 生命周期
  initialize: () => Promise<void>;

  // 分类操作
  loadCategories: () => Promise<void>;
  addCategory: (category: Omit<Category, 'id'>) => Promise<void>;
  removeCategory: (id: string) => Promise<CategoryDeleteResult>;

  // 小类操作
  loadSubCategories: () => Promise<void>;
  addSubCategory: (sub: Omit<SubCategory, 'id'>) => Promise<void>;
  /**
   * 删小类(轻量调用):
   * - 若无账目,内部直接删,返回 needsMigration=false
   * - 若有账目,返回 needsMigration=true + alternatives + defaultSub
   *    调用方拿到后,confirmAndMigrateDeleteSubCategory(目标 id) 完成迁移 + 删除
   */
  removeSubCategory: (id: string) => Promise<SubCategoryDeleteResult>;
  confirmMigrateDeleteSubCategory: (fromSubId: string, toSubId: string) => Promise<void>;

  // 账目操作
  loadTransactions: () => Promise<void>;
  addTransaction: (transaction: Omit<Transaction, 'id'>) => Promise<void>;
  /** 编辑账目;已撤销的账目 store 层抛错(被 UI 拦截) */
  updateTransaction: (transaction: Transaction) => Promise<void>;
  /** 撤销账目(软删,UI 灰色展示,统计不计入) */
  revokeTransaction: (id: string) => Promise<void>;
  /** 恢复撤销的账目 */
  restoreTransaction: (id: string) => Promise<void>;
  /** 物理删除账目(UI 需二次确认) */
  deleteTransaction: (id: string) => Promise<void>;

  // 筛选
  setFilters: (filters: FilterParams) => void;
  setDateRange: (range: 'day' | 'week' | 'month' | 'year') => void;

  // 配置
  updateOverviewConfig: (config: Partial<OverviewConfig>) => void;

  // 统计
  loadStatistics: () => Promise<void>;

  // 上次记账的类型(打开 AddTransactionScreen 默认类型)
  // 派生:transactions 中最近一笔 status=active 的 type
  lastTxType: 'income' | 'expense';
}

// ---------- 工具 ----------

const computeLastTxType = (txs: Transaction[]): 'income' | 'expense' => {
  const last = txs.find((t) => (t.status ?? 'active') === 'active');
  return last?.type ?? 'expense';
};

// 时间范围(本地) → ms 时间戳;endMs 取 23:59:59.999 防边界漏算
const rangeToMs = (range: 'day' | 'week' | 'month' | 'year'): { startMs: number; endMs: number } => {
  const now = new Date();
  let start: Date;
  let end: Date;
  switch (range) {
    case 'day':
      start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
      end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
      break;
    case 'week': {
      const ws = new Date(now);
      ws.setDate(now.getDate() - now.getDay());
      ws.setHours(0, 0, 0, 0);
      start = ws;
      end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
      break;
    }
    case 'month':
      start = new Date(getMonthStart(now));
      end = new Date(getMonthEnd(now));
      break;
    case 'year':
      start = new Date(getYearStart(now));
      end = new Date(getYearEnd(now));
      break;
  }
  return { startMs: start.getTime(), endMs: end.getTime() };
};

// ---------- store ----------

export const useStore = create<AppState>((set, get) => ({
  categories: [],
  subCategories: [],
  transactions: [],
  filters: {},
  dateRange: 'month',
  overviewConfig: {
    showIncome: true,
    showExpense: true,
    dateRange: 'month',
  },
  totalIncome: 0,
  totalExpense: 0,
  balance: 0,
  isLoading: false,
  amountsHidden: false,
  flashMessage: null,
  lastTxType: 'expense',

  toggleAmountsHidden: () => set((s) => ({ amountsHidden: !s.amountsHidden })),
  setFlashMessage: (message) => set({ flashMessage: message }),

  // ---------- 初始化 ----------
  initialize: async () => {
    set({ isLoading: true });
    try {
      await repository.init();
      await get().loadCategories();
      await get().loadSubCategories();
      await get().loadTransactions();
      await get().loadStatistics();
    } catch (error) {
      console.error('Initialize error:', error);
      throw error;
    } finally {
      set({ isLoading: false });
    }
  },

  // ---------- 分类 ----------
  loadCategories: async () => {
    const categories = await repository.loadCategories();
    set({ categories });
  },

  addCategory: async (category) => {
    try {
      await repository.insertCategory(category);
      await get().loadCategories();
      await get().loadSubCategories();
    } catch (error) {
      console.error('Failed to add category:', error);
      throw error;
    }
  },

  removeCategory: async (id) => {
    try {
      const result = await repository.deleteCategory(id);
      await get().loadCategories();
      await get().loadSubCategories();
      await get().loadTransactions();
      await get().loadStatistics();
      return result;
    } catch (error) {
      console.error('Failed to remove category:', error);
      throw error;
    }
  },

  // ---------- 小类 ----------
  loadSubCategories: async () => {
    const subCategories = await repository.loadSubCategories();
    set({ subCategories });
  },

  addSubCategory: async (sub) => {
    try {
      await repository.insertSubCategory(sub);
      await get().loadSubCategories();
    } catch (error) {
      console.error('Failed to add sub category:', error);
      throw error;
    }
  },

  removeSubCategory: async (id) => {
    try {
      const result = await repository.deleteSubCategory(id);
      if (!result.needsMigration) {
        // 直接删了,刷新
        await get().loadSubCategories();
        await get().loadTransactions();
        await get().loadStatistics();
      }
      return result;
    } catch (error) {
      console.error('Failed to remove sub category:', error);
      throw error;
    }
  },

  confirmMigrateDeleteSubCategory: async (fromSubId, toSubId) => {
    try {
      await repository.migrateAndDeleteSubCategory(fromSubId, toSubId);
      await get().loadSubCategories();
      await get().loadTransactions();
      await get().loadStatistics();
    } catch (error) {
      console.error('Failed to migrate & delete sub category:', error);
      throw error;
    }
  },

  // ---------- 账目 ----------
  loadTransactions: async () => {
    const transactions = await repository.loadTransactions();
    set({ transactions, lastTxType: computeLastTxType(transactions) });
  },

  addTransaction: async (transaction) => {
    try {
      await repository.insertTransaction(transaction);
      await get().loadTransactions();
      await get().loadStatistics();
    } catch (error) {
      console.error('Failed to add transaction:', error);
      throw error;
    }
  },

  updateTransaction: async (transaction) => {
    try {
      // store 层兜底:撤销态不允许编辑
      if ((transaction.status ?? 'active') === 'revoked') {
        throw new Error('已撤销的账目不可编辑');
      }
      await repository.updateTransaction(transaction);
      await get().loadTransactions();
      await get().loadStatistics();
    } catch (error) {
      console.error('Failed to update transaction:', error);
      throw error;
    }
  },

  revokeTransaction: async (id) => {
    try {
      await repository.revokeTransaction(id);
      await get().loadTransactions();
      await get().loadStatistics();
    } catch (error) {
      console.error('Failed to revoke transaction:', error);
      throw error;
    }
  },

  restoreTransaction: async (id) => {
    try {
      await repository.restoreTransaction(id);
      await get().loadTransactions();
      await get().loadStatistics();
    } catch (error) {
      console.error('Failed to restore transaction:', error);
      throw error;
    }
  },

  deleteTransaction: async (id) => {
    try {
      await repository.deleteTransaction(id);
      await get().loadTransactions();
      await get().loadStatistics();
    } catch (error) {
      console.error('Failed to delete transaction:', error);
      throw error;
    }
  },

  // ---------- 筛选 / 配置 ----------
  setFilters: (filters) => {
    set({ filters });
    // 不再走 repository 的 getTransactions 参数过滤,前端筛
    get().loadTransactions();
  },

  setDateRange: (range) => {
    set({ dateRange: range });
    get().loadStatistics();
  },

  updateOverviewConfig: (config) => {
    set((state) => ({
      overviewConfig: { ...state.overviewConfig, ...config },
    }));
  },

  // ---------- 统计 ----------
  loadStatistics: async () => {
    const { dateRange } = get();
    const { startMs, endMs } = rangeToMs(dateRange);
    try {
      const { totalIncome, totalExpense } = await repository.sumRange(startMs, endMs);
      set({
        totalIncome,
        totalExpense,
        balance: totalIncome - totalExpense,
      });
    } catch (error) {
      console.error('Failed to load statistics:', error);
      throw error;
    }
  },
}));
