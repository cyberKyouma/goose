// 数据库服务入口 (兼容层)
// 旧 src/services/database.ts 已被 storage 三件套替代:
//   ./storage/index.ts  平台路由,导出 repository
//   ./storage/types.ts  Repository 契约
//   ./storage/native.ts expo-sqlite 实现
//   ./storage/web.ts    AsyncStorage 实现
//
// 此文件保留以兼容旧 import path,业务代码应改为:
//   import { repository } from './storage';

export { repository } from './storage';
export type { GooseRepository } from './storage';
