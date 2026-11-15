// expo-sqlite 实现 (Android / iOS)
// - 启动建表 + 迁移 (schema_version)
// - 业务表操作走事务 (db.withTransactionAsync)

import * as SQLite from 'expo-sqlite';
import { generateId } from '../../utils';
import type { Category, SubCategory, Transaction } from '../../models';
import type {
  CategoryRow,
  CategoryDeleteResult,
  GooseRepository,
  SubCategoryDeleteResult,
  SubCategoryRow,
  TransactionRow,
} from './types';
import {
  rowToCategory,
  rowToSubCategory,
  rowToTransaction,
} from './types';

const DB_NAME = 'goose.db';
const CURRENT_SCHEMA_VERSION = 1;

const SCHEMA_V1: string[] = [
  `CREATE TABLE IF NOT EXISTS schema_version (
     version    INTEGER PRIMARY KEY,
     applied_at INTEGER NOT NULL
   );`,

  `CREATE TABLE IF NOT EXISTS categories (
     id          TEXT PRIMARY KEY,
     name        TEXT NOT NULL,
     icon        TEXT NOT NULL,
     color       TEXT NOT NULL,
     type        TEXT NOT NULL CHECK (type IN ('income','expense')),
     sort_order  INTEGER NOT NULL DEFAULT 0,
     created_at  INTEGER NOT NULL,
     updated_at  INTEGER NOT NULL
   );`,
  `CREATE INDEX IF NOT EXISTS idx_categories_type ON categories(type);`,

  `CREATE TABLE IF NOT EXISTS sub_categories (
     id          TEXT PRIMARY KEY,
     category_id TEXT NOT NULL,
     name        TEXT NOT NULL,
     icon        TEXT NOT NULL,
     is_default  INTEGER NOT NULL DEFAULT 0,
     sort_order  INTEGER NOT NULL DEFAULT 0,
     created_at  INTEGER NOT NULL,
     updated_at  INTEGER NOT NULL,
     FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE
   );`,
  `CREATE INDEX IF NOT EXISTS idx_sub_categories_category ON sub_categories(category_id);`,

  `CREATE TABLE IF NOT EXISTS transactions (
     id              TEXT PRIMARY KEY,
     amount          REAL    NOT NULL,
     type            TEXT    NOT NULL CHECK (type IN ('income','expense')),
     sub_category_id TEXT    NOT NULL,
     occurred_at     INTEGER NOT NULL,
     note            TEXT,
     status          TEXT    NOT NULL DEFAULT 'active' CHECK (status IN ('active','revoked')),
     revoked_at      INTEGER,
     created_at      INTEGER NOT NULL,
     updated_at      INTEGER NOT NULL,
     FOREIGN KEY (sub_category_id) REFERENCES sub_categories(id) ON DELETE RESTRICT
   );`,
  `CREATE INDEX IF NOT EXISTS idx_transactions_occurred_at ON transactions(occurred_at DESC);`,
  `CREATE INDEX IF NOT EXISTS idx_transactions_sub_category ON transactions(sub_category_id);`,
  `CREATE INDEX IF NOT EXISTS idx_transactions_type ON transactions(type, occurred_at DESC);`,
  `CREATE INDEX IF NOT EXISTS idx_transactions_status ON transactions(status, occurred_at DESC);`,
];

// ---------- 默认分类(全新用户初始化) ----------
// 每个 category 数组附带一组 subNames,首个 sub("其他")会带 is_default=1。

type DefaultSubSeed = string[]; // 其中第 0 个是 "其他"

const DEFAULT_CATEGORIES: Array<{
  name: string;
  icon: string;
  color: string;
  type: 'income' | 'expense';
  subs: DefaultSubSeed;
}> = [
  { name: '餐饮', icon: '🍔', color: '#FF6384', type: 'expense',
    subs: ['其他', '早餐', '午餐', '晚餐', '夜宵', '饮料', '水果'] },
  { name: '交通', icon: '🚗', color: '#36A2EB', type: 'expense',
    subs: ['其他', '公交', '地铁', '打车', '油费', '停车', '高铁'] },
  { name: '购物', icon: '🛍️', color: '#FFCE56', type: 'expense',
    subs: ['其他', '日用', '服饰', '美妆', '数码', '杂物'] },
  { name: '居住', icon: '🏠', color: '#4BC0C0', type: 'expense',
    subs: ['其他', '房租', '水电', '物业', '维修'] },
  { name: '娱乐', icon: '🎮', color: '#9966FF', type: 'expense',
    subs: ['其他', '电影', '游戏', '运动', '旅行', '聚会'] },
  { name: '医疗', icon: '💊', color: '#FF9F40', type: 'expense',
    subs: ['其他', '药品', '门诊', '体检', '保健'] },
  { name: '教育', icon: '📚', color: '#FF6384', type: 'expense',
    subs: ['其他', '书籍', '课程', '培训', '考试'] },
  { name: '其他支出', icon: '📦', color: '#C9CBCF', type: 'expense',
    subs: ['其他', '红包', '礼品', '意外'] },

  { name: '工资', icon: '💰', color: '#4CAF50', type: 'income',
    subs: ['其他', '月薪', '加班', '补贴'] },
  { name: '奖金', icon: '🎁', color: '#8BC34A', type: 'income',
    subs: ['其他', '绩效', '项目', '抽奖'] },
  { name: '投资', icon: '📈', color: '#009688', type: 'income',
    subs: ['其他', '股票', '基金', '利息', '理财'] },
  { name: '其他收入', icon: '💵', color: '#607D8B', type: 'income',
    subs: ['其他', '兼职', '退款', '意外'] },
];

export class NativeSqliteRepository implements GooseRepository {
  private db: SQLite.SQLiteDatabase | null = null;
  private initialized = false;
  private initPromise: Promise<void> | null = null;

  async init(): Promise<void> {
    if (this.initialized) return;
    if (this.initPromise) return this.initPromise;
    this.initPromise = (async () => {
      this.db = await SQLite.openDatabaseAsync(DB_NAME);
      await this.migrate();
      await this.seedIfEmpty();
      await this.ensureDefaultSubsForOldUsers();
      this.initialized = true;
    })();
    return this.initPromise;
  }

  private async migrate(): Promise<void> {
    if (!this.db) throw new Error('db not opened');
    // schema_version 表第一条语句会创建
    await this.db.execAsync('PRAGMA foreign_keys = ON;');
    for (const sql of SCHEMA_V1) {
      await this.db.execAsync(sql);
    }
    await this.db.runAsync(
      `INSERT OR IGNORE INTO schema_version (version, applied_at) VALUES (?, ?);`,
      CURRENT_SCHEMA_VERSION,
      Date.now()
    );
  }

  private async seedIfEmpty(): Promise<void> {
    if (!this.db) throw new Error('db not opened');
    const row = await this.db.getFirstAsync<{ c: number }>(
      `SELECT COUNT(*) AS c FROM categories;`
    );
    if ((row?.c ?? 0) > 0) return;
    const now = Date.now();
    await this.db.withTransactionAsync(async () => {
      const db = this.db!;
      let catOrder = 0;
      for (const c of DEFAULT_CATEGORIES) {
        const catId = generateId();
        await db.runAsync(
          `INSERT INTO categories (id, name, icon, color, type, sort_order, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?);`,
          catId, c.name, c.icon, c.color, c.type, catOrder++, now, now
        );
        let subOrder = 0;
        for (let i = 0; i < c.subs.length; i++) {
          const subName = c.subs[i];
          const isDefault = i === 0 ? 1 : 0; // 第一个 sub = "其他"
          await db.runAsync(
            `INSERT INTO sub_categories (id, category_id, name, icon, is_default, sort_order, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?);`,
            generateId(), catId, subName, c.icon, isDefault, subOrder++, now, now
          );
        }
      }
    });
  }

  /**
   * 老用户升级路径:
   *  - 若整张表没有 is_default=1 的 sub,遍历所有 category 各建一个"其他"
   *  - 已 seed 过的子分类保留,只补默认"其他"
   */
  private async ensureDefaultSubsForOldUsers(): Promise<void> {
    if (!this.db) throw new Error('db not opened');
    const row = await this.db.getFirstAsync<{ c: number }>(
      `SELECT COUNT(*) AS c FROM sub_categories WHERE is_default = 1;`
    );
    if ((row?.c ?? 0) > 0) return;
    const cats = await this.db.getAllAsync<CategoryRow>(`SELECT * FROM categories;`);
    if (cats.length === 0) return;
    const now = Date.now();
    await this.db.withTransactionAsync(async () => {
      const db = this.db!;
      for (const cat of cats) {
        await db.runAsync(
          `INSERT INTO sub_categories (id, category_id, name, icon, is_default, sort_order, created_at, updated_at)
           VALUES (?, ?, ?, ?, 1, 999, ?, ?);`,
          generateId(), cat.id, '其他', cat.icon, now, now
        );
      }
    });
  }

  // ---------- Categories ----------

  async loadCategories(): Promise<Category[]> {
    await this.init();
    const rows = await this.db!.getAllAsync<CategoryRow>(
      `SELECT * FROM categories ORDER BY sort_order ASC, created_at ASC;`
    );
    return rows.map(rowToCategory);
  }

  async insertCategory(c: Omit<Category, 'id'>): Promise<Category> {
    await this.init();
    const now = Date.now();
    const id = generateId();
    const row = await this.db!.getFirstAsync<{ sort_order: number }>(
      `SELECT COALESCE(MAX(sort_order), -1) + 1 AS sort_order FROM categories WHERE type = ?;`,
      c.type
    );
    await this.db!.runAsync(
      `INSERT INTO categories (id, name, icon, color, type, sort_order, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?);`,
      id, c.name, c.icon, c.color, c.type, row?.sort_order ?? 0, now, now
    );
    // 同时建一个默认"其他"小类,跟新分类挂钩
    await this.db!.runAsync(
      `INSERT INTO sub_categories (id, category_id, name, icon, is_default, sort_order, created_at, updated_at)
       VALUES (?, ?, ?, ?, 1, 999, ?, ?);`,
      generateId(), id, '其他', c.icon, now, now
    );
    return { id, ...c };
  }

  async deleteCategory(id: string): Promise<CategoryDeleteResult> {
    await this.init();
    const now = Date.now();

    const cat = await this.db!.getFirstAsync<CategoryRow>(
      `SELECT * FROM categories WHERE id = ?;`, id
    );
    if (!cat) {
      return { needsMigration: false, affectedTxCount: 0, alternatives: [] };
    }
    const subRows = await this.db!.getAllAsync<SubCategoryRow>(
      `SELECT * FROM sub_categories WHERE category_id = ?;`, id
    );
    const subIds = subRows.map((r) => r.id);
    const defaultSub = subRows.find((r) => r.is_default === 1);

    // 业务上 "删除大类" 的语义:
    // 1) 把所有账目迁到本类的默认"其他"小类(若有)
    // 2) 删大类(数据库 CASCADE 删子分类)
    // 3) 若本类没默认"其他"(理论上不可能,因为初始化保证),拒绝删
    if (!defaultSub) {
      throw new Error('该分类缺少默认"其他"小类,无法安全删除');
    }

    const affected = await this.db!.getFirstAsync<{ c: number }>(
      subIds.length === 0
        ? `SELECT COUNT(*) AS c FROM transactions WHERE 0;`
        : `SELECT COUNT(*) AS c FROM transactions WHERE sub_category_id IN (${subIds.map(() => '?').join(',')});`,
      ...subIds
    );
    const affectedTxCount = affected?.c ?? 0;

    await this.db!.withTransactionAsync(async () => {
      const db = this.db!;
      if (affectedTxCount > 0) {
        await db.runAsync(
          `UPDATE transactions SET sub_category_id = ?, updated_at = ? WHERE sub_category_id IN (${subIds.map(() => '?').join(',')});`,
          defaultSub.id, now, ...subIds
        );
      }
      await db.runAsync(`DELETE FROM categories WHERE id = ?;`, id);
    });

    return {
      needsMigration: affectedTxCount > 0,
      affectedTxCount,
      alternatives: [],
    };
  }

  // ---------- SubCategories ----------

  async loadSubCategories(): Promise<SubCategory[]> {
    await this.init();
    const rows = await this.db!.getAllAsync<SubCategoryRow>(
      `SELECT * FROM sub_categories
       ORDER BY is_default ASC, sort_order ASC, created_at ASC;`
    );
    return rows.map(rowToSubCategory);
  }

  async insertSubCategory(s: Omit<SubCategory, 'id'>): Promise<SubCategory> {
    await this.init();
    const now = Date.now();
    const id = generateId();
    const row = await this.db!.getFirstAsync<{ sort_order: number }>(
      `SELECT COALESCE(MAX(sort_order), 0) + 1 AS sort_order
       FROM sub_categories WHERE category_id = ? AND is_default = 0;`,
      s.categoryId
    );
    await this.db!.runAsync(
      `INSERT INTO sub_categories (id, category_id, name, icon, is_default, sort_order, created_at, updated_at)
       VALUES (?, ?, ?, ?, 0, ?, ?, ?);`,
      id, s.categoryId, s.name, s.icon ?? '📂', row?.sort_order ?? 0, now, now
    );
    return { id, ...s, isDefault: false };
  }

  async deleteSubCategory(id: string): Promise<SubCategoryDeleteResult> {
    await this.init();

    const sub = await this.db!.getFirstAsync<SubCategoryRow>(
      `SELECT * FROM sub_categories WHERE id = ?;`, id
    );
    if (!sub) {
      return {
        needsMigration: false,
        affectedTxCount: 0,
        alternatives: [],
        isDefault: false,
      };
    }
    if (sub.is_default === 1) {
      return {
        needsMigration: false,
        affectedTxCount: 0,
        alternatives: [],
        isDefault: true,
      };
    }

    const affected = await this.db!.getFirstAsync<{ c: number }>(
      `SELECT COUNT(*) AS c FROM transactions WHERE sub_category_id = ? AND status = 'active';`,
      id
    );
    const affectedTxCount = affected?.c ?? 0;

    const alternatives = (
      await this.db!.getAllAsync<SubCategoryRow>(
        `SELECT * FROM sub_categories
         WHERE category_id = ? AND id != ? AND is_default = 0
         ORDER BY sort_order ASC, created_at ASC;`,
        sub.category_id, id
      )
    ).map(rowToSubCategory);

    const defaultRow = await this.db!.getFirstAsync<SubCategoryRow>(
      `SELECT * FROM sub_categories WHERE category_id = ? AND is_default = 1;`,
      sub.category_id
    );
    const defaultSub = defaultRow ? rowToSubCategory(defaultRow) : undefined;

    if (affectedTxCount === 0) {
      // 没账目,直接删
      await this.db!.runAsync(`DELETE FROM sub_categories WHERE id = ?;`, id);
      return {
        needsMigration: false,
        affectedTxCount: 0,
        alternatives,
        defaultSub,
        isDefault: false,
      };
    }

    return {
      needsMigration: true,
      affectedTxCount,
      alternatives,
      defaultSub,
      isDefault: false,
    };
  }

  async migrateAndDeleteSubCategory(
    fromSubId: string,
    toSubId: string
  ): Promise<void> {
    await this.init();
    if (fromSubId === toSubId) {
      throw new Error('迁移目标小类不能与源相同');
    }
    const now = Date.now();
    await this.db!.withTransactionAsync(async () => {
      const db = this.db!;
      await db.runAsync(
        `UPDATE transactions SET sub_category_id = ?, updated_at = ? WHERE sub_category_id = ?;`,
        toSubId, now, fromSubId
      );
      await db.runAsync(`DELETE FROM sub_categories WHERE id = ?;`, fromSubId);
    });
  }

  // ---------- Transactions ----------

  async loadTransactions(): Promise<Transaction[]> {
    await this.init();
    const rows = await this.db!.getAllAsync<TransactionRow>(
      `SELECT * FROM transactions ORDER BY occurred_at DESC;`
    );
    return rows.map(rowToTransaction);
  }

  async insertTransaction(t: Omit<Transaction, 'id'>): Promise<Transaction> {
    await this.init();
    const now = Date.now();
    const id = generateId();
    await this.db!.runAsync(
      `INSERT INTO transactions
         (id, amount, type, sub_category_id, occurred_at, note, status, revoked_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, 'active', NULL, ?, ?);`,
      id, t.amount, t.type, t.subCategoryId,
      new Date(t.date).getTime(), t.note ?? '', now, now
    );
    return { id, ...t, status: 'active' };
  }

  async updateTransaction(t: Transaction): Promise<Transaction> {
    await this.init();
    const now = Date.now();
    // 撤销态不允许编辑(在 store 层也校验一次,这里兜底)
    if (t.status === 'revoked') {
      throw new Error('已撤销的账目不可编辑');
    }
    await this.db!.runAsync(
      `UPDATE transactions
         SET amount = ?, type = ?, sub_category_id = ?,
             occurred_at = ?, note = ?, updated_at = ?
       WHERE id = ?;`,
      t.amount, t.type, t.subCategoryId,
      new Date(t.date).getTime(), t.note ?? '', now, t.id
    );
    return t;
  }

  async revokeTransaction(id: string): Promise<void> {
    await this.init();
    const now = Date.now();
    await this.db!.runAsync(
      `UPDATE transactions SET status = 'revoked', revoked_at = ?, updated_at = ?
       WHERE id = ?;`,
      now, now, id
    );
  }

  async restoreTransaction(id: string): Promise<void> {
    await this.init();
    const now = Date.now();
    await this.db!.runAsync(
      `UPDATE transactions SET status = 'active', revoked_at = NULL, updated_at = ?
       WHERE id = ?;`,
      now, id
    );
  }

  async deleteTransaction(id: string): Promise<void> {
    await this.init();
    await this.db!.runAsync(`DELETE FROM transactions WHERE id = ?;`, id);
  }

  // ---------- Stats ----------

  async sumRange(
    startMs: number,
    endMs: number
  ): Promise<{ totalIncome: number; totalExpense: number }> {
    await this.init();
    const rows = await this.db!.getAllAsync<{ type: 'income' | 'expense'; total: number }>(
      `SELECT type, COALESCE(SUM(amount), 0) AS total
       FROM transactions
       WHERE status = 'active' AND occurred_at BETWEEN ? AND ?
       GROUP BY type;`,
      startMs, endMs
    );
    let totalIncome = 0;
    let totalExpense = 0;
    for (const r of rows) {
      if (r.type === 'income') totalIncome = r.total;
      else totalExpense = r.total;
    }
    return { totalIncome, totalExpense };
  }
}

export const nativeRepository: GooseRepository = new NativeSqliteRepository();
