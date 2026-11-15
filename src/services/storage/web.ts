// Web 端 Repository:继续用 AsyncStorage 作为开发期 web 测试存储
// - 同样的 GooseRepository 接口
// - 性能不重要(数据量小)
// - 行为对齐 native,以便 store 切换无感

import AsyncStorage from '@react-native-async-storage/async-storage';
import { generateId } from '../../utils';
import type { Category, SubCategory, Transaction } from '../../models';
import type {
  CategoryDeleteResult,
  GooseRepository,
  SubCategoryDeleteResult,
} from './types';

const KEYS = {
  categories: '@goose/categories',
  subCategories: '@goose/subCategories',
  transactions: '@goose/transactions',
  lastTxType: '@goose/lastTxType',
};

const DEFAULT_CATEGORIES: Array<{
  name: string;
  icon: string;
  color: string;
  type: 'income' | 'expense';
  subs: string[];
}> = [
  { name: '餐饮', icon: '🍔', color: '#FF6384', type: 'expense', subs: ['其他', '早餐', '午餐', '晚餐', '夜宵', '饮料', '水果'] },
  { name: '交通', icon: '🚗', color: '#36A2EB', type: 'expense', subs: ['其他', '公交', '地铁', '打车', '油费', '停车', '高铁'] },
  { name: '购物', icon: '🛍️', color: '#FFCE56', type: 'expense', subs: ['其他', '日用', '服饰', '美妆', '数码', '杂物'] },
  { name: '居住', icon: '🏠', color: '#4BC0C0', type: 'expense', subs: ['其他', '房租', '水电', '物业', '维修'] },
  { name: '娱乐', icon: '🎮', color: '#9966FF', type: 'expense', subs: ['其他', '电影', '游戏', '运动', '旅行', '聚会'] },
  { name: '医疗', icon: '💊', color: '#FF9F40', type: 'expense', subs: ['其他', '药品', '门诊', '体检', '保健'] },
  { name: '教育', icon: '📚', color: '#FF6384', type: 'expense', subs: ['其他', '书籍', '课程', '培训', '考试'] },
  { name: '其他支出', icon: '📦', color: '#C9CBCF', type: 'expense', subs: ['其他', '红包', '礼品', '意外'] },
  { name: '工资', icon: '💰', color: '#4CAF50', type: 'income', subs: ['其他', '月薪', '加班', '补贴'] },
  { name: '奖金', icon: '🎁', color: '#8BC34A', type: 'income', subs: ['其他', '绩效', '项目', '抽奖'] },
  { name: '投资', icon: '📈', color: '#009688', type: 'income', subs: ['其他', '股票', '基金', '利息', '理财'] },
  { name: '其他收入', icon: '💵', color: '#607D8B', type: 'income', subs: ['其他', '兼职', '退款', '意外'] },
];

const isString = (v: unknown): v is string => typeof v === 'string';
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

const parseCategoryArray = (raw: string | null): Category[] => {
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return arr.filter((c): c is Category =>
      c && typeof c === 'object' &&
      isString(c.id) && isString(c.name) && isString(c.icon) && isString(c.color) &&
      (c.type === 'income' || c.type === 'expense')
    );
  } catch { return []; }
};

const parseSubArray = (raw: string | null): SubCategory[] => {
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return arr.filter((s): s is SubCategory =>
      s && typeof s === 'object' &&
      isString(s.id) && isString(s.name) && isString(s.categoryId)
    ).map((s) => ({ isDefault: false, ...s })); // 老数据无该字段
  } catch { return []; }
};

const parseTxArray = (raw: string | null): Transaction[] => {
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return arr.filter((t): t is Transaction =>
      t && typeof t === 'object' &&
      isString(t.id) && isString(t.date) && isString(t.note) &&
      isString(t.subCategoryId) &&
      isNum(t.amount) && t.amount > 0 &&
      (t.type === 'income' || t.type === 'expense')
    ).map((t) => ({ status: 'active' as const, ...t }));
  } catch { return []; }
};

const sortSubs = (subs: SubCategory[]): SubCategory[] =>
  [...subs].sort((a, b) => {
    const ad = a.isDefault ? 1 : 0;
    const bd = b.isDefault ? 1 : 0;
    if (ad !== bd) return ad - bd;
    return (a.sortOrder ?? 0) - (b.sortOrder ?? 0);
  });

export class WebAsyncStorageRepository implements GooseRepository {
  private categories: Category[] = [];
  private subCategories: SubCategory[] = [];
  private transactions: Transaction[] = [];
  private lastTxType: 'income' | 'expense' = 'expense';

  private initialized = false;
  private initPromise: Promise<void> | null = null;

  async init(): Promise<void> {
    if (this.initialized) return;
    if (this.initPromise) return this.initPromise;
    this.initPromise = (async () => {
      const [cRaw, sRaw, tRaw, lRaw] = await Promise.all([
        AsyncStorage.getItem(KEYS.categories),
        AsyncStorage.getItem(KEYS.subCategories),
        AsyncStorage.getItem(KEYS.transactions),
        AsyncStorage.getItem(KEYS.lastTxType),
      ]);
      this.categories = parseCategoryArray(cRaw);
      this.subCategories = parseSubArray(sRaw);
      this.transactions = parseTxArray(tRaw);
      this.lastTxType = lRaw === 'income' ? 'income' : 'expense';

      if (this.categories.length === 0) {
        await this.seedDefaults();
      } else if (this.subCategories.length === 0) {
        await this.seedDefaultSubs();
      }
      // 老用户:为已有 category 各补一个"其他"
      await this.ensureDefaultSubsForOldUsers();
      this.initialized = true;
    })();
    return this.initPromise;
  }

  private async persistCategories(): Promise<void> {
    await AsyncStorage.setItem(KEYS.categories, JSON.stringify(this.categories));
  }
  private async persistSubs(): Promise<void> {
    await AsyncStorage.setItem(KEYS.subCategories, JSON.stringify(this.subCategories));
  }
  private async persistTxs(): Promise<void> {
    await AsyncStorage.setItem(KEYS.transactions, JSON.stringify(this.transactions));
  }
  private async persistLastType(): Promise<void> {
    await AsyncStorage.setItem(KEYS.lastTxType, this.lastTxType);
  }

  private async seedDefaults(): Promise<void> {
    const cats: Category[] = [];
    const subs: SubCategory[] = [];
    for (const c of DEFAULT_CATEGORIES) {
      const cid = generateId();
      cats.push({ id: cid, name: c.name, icon: c.icon, color: c.color, type: c.type });
      c.subs.forEach((name, i) => {
        subs.push({
          id: generateId(),
          name,
          categoryId: cid,
          icon: c.icon,
          isDefault: i === 0,
          sortOrder: i,
        });
      });
    }
    this.categories = cats;
    this.subCategories = subs;
    await this.persistCategories();
    await this.persistSubs();
  }

  private async seedDefaultSubs(): Promise<void> {
    const subMap: Record<string, string[]> = {
      '餐饮': ['早餐', '午餐', '晚餐', '夜宵', '饮料', '水果'],
      '交通': ['公交', '地铁', '打车', '油费', '停车', '高铁'],
      '购物': ['日用', '服饰', '美妆', '数码', '杂物'],
      '居住': ['房租', '水电', '物业', '维修'],
      '娱乐': ['电影', '游戏', '运动', '旅行', '聚会'],
      '医疗': ['药品', '门诊', '体检', '保健'],
      '教育': ['书籍', '课程', '培训', '考试'],
      '工资': ['月薪', '加班', '补贴'],
      '奖金': ['绩效', '项目', '抽奖'],
      '投资': ['股票', '基金', '利息', '理财'],
    };
    const newSubs: SubCategory[] = [];
    for (const cat of this.categories) {
      const names = subMap[cat.name];
      if (!names) continue;
      if (this.subCategories.some((s) => s.categoryId === cat.id)) continue;
      names.forEach((name, i) => {
        newSubs.push({
          id: generateId(),
          name,
          categoryId: cat.id,
          icon: cat.icon,
          isDefault: false,
          sortOrder: i + 1,
        });
      });
    }
    if (newSubs.length > 0) {
      this.subCategories = [...this.subCategories, ...newSubs];
      await this.persistSubs();
    }
  }

  private async ensureDefaultSubsForOldUsers(): Promise<void> {
    if (this.subCategories.some((s) => s.isDefault)) return;
    const newSubs: SubCategory[] = this.categories.map((c) => ({
      id: generateId(),
      name: '其他',
      categoryId: c.id,
      icon: c.icon,
      isDefault: true,
      sortOrder: 999,
    }));
    this.subCategories = [...this.subCategories, ...newSubs];
    await this.persistSubs();
  }

  // ---------- Categories ----------

  async loadCategories(): Promise<Category[]> {
    await this.init();
    return [...this.categories];
  }

  async insertCategory(c: Omit<Category, 'id'>): Promise<Category> {
    await this.init();
    const newCat: Category = { id: generateId(), ...c };
    this.categories.push(newCat);
    // 同步建默认"其他"小类
    this.subCategories.push({
      id: generateId(),
      name: '其他',
      categoryId: newCat.id,
      icon: newCat.icon,
      isDefault: true,
      sortOrder: 999,
    });
    await this.persistCategories();
    await this.persistSubs();
    return newCat;
  }

  async deleteCategory(id: string): Promise<CategoryDeleteResult> {
    await this.init();
    const cat = this.categories.find((c) => c.id === id);
    if (!cat) return { needsMigration: false, affectedTxCount: 0, alternatives: [] };
    const subs = this.subCategories.filter((s) => s.categoryId === id);
    const defaultSub = subs.find((s) => s.isDefault);
    if (!defaultSub) throw new Error('该分类缺少默认"其他"小类');
    const subIds = new Set(subs.map((s) => s.id));

    let affectedTxCount = 0;
    this.transactions = this.transactions.map((t) => {
      if (subIds.has(t.subCategoryId)) {
        affectedTxCount++;
        return { ...t, subCategoryId: defaultSub.id };
      }
      return t;
    });
    this.subCategories = this.subCategories.filter((s) => s.categoryId !== id);
    this.categories = this.categories.filter((c) => c.id !== id);

    await this.persistTxs();
    await this.persistSubs();
    await this.persistCategories();
    return { needsMigration: affectedTxCount > 0, affectedTxCount, alternatives: [] };
  }

  // ---------- SubCategories ----------

  async loadSubCategories(): Promise<SubCategory[]> {
    await this.init();
    return sortSubs(this.subCategories);
  }

  async insertSubCategory(s: Omit<SubCategory, 'id'>): Promise<SubCategory> {
    await this.init();
    const maxOrder = this.subCategories
      .filter((x) => x.categoryId === s.categoryId && !x.isDefault)
      .reduce((m, x) => Math.max(m, x.sortOrder ?? 0), 0);
    const newSub: SubCategory = {
      id: generateId(),
      ...s,
      isDefault: false,
      sortOrder: maxOrder + 1,
    };
    this.subCategories.push(newSub);
    await this.persistSubs();
    return newSub;
  }

  async deleteSubCategory(id: string): Promise<SubCategoryDeleteResult> {
    await this.init();
    const sub = this.subCategories.find((s) => s.id === id);
    if (!sub) {
      return { needsMigration: false, affectedTxCount: 0, alternatives: [], isDefault: false };
    }
    if (sub.isDefault) {
      return { needsMigration: false, affectedTxCount: 0, alternatives: [], isDefault: true };
    }
    const affectedTxCount = this.transactions.filter(
      (t) => t.subCategoryId === id && t.status !== 'revoked'
    ).length;

    if (affectedTxCount === 0) {
      this.subCategories = this.subCategories.filter((s) => s.id !== id);
      await this.persistSubs();
      return {
        needsMigration: false,
        affectedTxCount: 0,
        alternatives: this.subCategories.filter(
          (s) => s.categoryId === sub.categoryId && s.id !== id && !s.isDefault
        ),
        defaultSub: this.subCategories.find(
          (s) => s.categoryId === sub.categoryId && s.isDefault
        ),
        isDefault: false,
      };
    }
    return {
      needsMigration: true,
      affectedTxCount,
      alternatives: this.subCategories.filter(
        (s) => s.categoryId === sub.categoryId && s.id !== id && !s.isDefault
      ),
      defaultSub: this.subCategories.find(
        (s) => s.categoryId === sub.categoryId && s.isDefault
      ),
      isDefault: false,
    };
  }

  async migrateAndDeleteSubCategory(
    fromSubId: string,
    toSubId: string
  ): Promise<void> {
    await this.init();
    if (fromSubId === toSubId) throw new Error('迁移目标小类不能与源相同');
    this.transactions = this.transactions.map((t) =>
      t.subCategoryId === fromSubId ? { ...t, subCategoryId: toSubId } : t
    );
    this.subCategories = this.subCategories.filter((s) => s.id !== fromSubId);
    await this.persistTxs();
    await this.persistSubs();
  }

  // ---------- Transactions ----------

  async loadTransactions(): Promise<Transaction[]> {
    await this.init();
    return [...this.transactions].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );
  }

  async insertTransaction(t: Omit<Transaction, 'id'>): Promise<Transaction> {
    await this.init();
    const newTx: Transaction = { id: generateId(), ...t, status: 'active' };
    this.transactions.push(newTx);
    this.lastTxType = newTx.type;
    await this.persistTxs();
    await this.persistLastType();
    return newTx;
  }

  async updateTransaction(t: Transaction): Promise<Transaction> {
    await this.init();
    if (t.status === 'revoked') {
      throw new Error('已撤销的账目不可编辑');
    }
    const idx = this.transactions.findIndex((x) => x.id === t.id);
    if (idx < 0) throw new Error('账目不存在');
    this.transactions[idx] = t;
    await this.persistTxs();
    return t;
  }

  async revokeTransaction(id: string): Promise<void> {
    await this.init();
    this.transactions = this.transactions.map((t) =>
      t.id === id ? { ...t, status: 'revoked', revokedAt: new Date().toISOString() } : t
    );
    await this.persistTxs();
  }

  async restoreTransaction(id: string): Promise<void> {
    await this.init();
    this.transactions = this.transactions.map((t) => {
      if (t.id !== id) return t;
      const { revokedAt, ...rest } = t;
      return { ...rest, status: 'active' };
    });
    await this.persistTxs();
  }

  async deleteTransaction(id: string): Promise<void> {
    await this.init();
    this.transactions = this.transactions.filter((t) => t.id !== id);
    await this.persistTxs();
  }

  async sumRange(
    startMs: number,
    endMs: number
  ): Promise<{ totalIncome: number; totalExpense: number }> {
    await this.init();
    let totalIncome = 0;
    let totalExpense = 0;
    for (const t of this.transactions) {
      if (t.status === 'revoked') continue;
      const ms = new Date(t.date).getTime();
      if (ms < startMs || ms > endMs) continue;
      if (t.type === 'income') totalIncome += t.amount;
      else totalExpense += t.amount;
    }
    return { totalIncome, totalExpense };
  }
}

export const webRepository: GooseRepository = new WebAsyncStorageRepository();
