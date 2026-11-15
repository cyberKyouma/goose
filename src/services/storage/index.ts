// 平台路由:
// - native (Android/iOS) → expo-sqlite 实现
// - web (仅作开发期测试) → AsyncStorage 实现
// 业务层 store 只通过此模块拿到 repository,不直接 import ./native 或 ./web

import { Platform } from 'react-native';
import { nativeRepository } from './native';
import { webRepository } from './web';
import type { GooseRepository } from './types';

export const repository: GooseRepository =
  Platform.OS === 'web' ? webRepository : nativeRepository;

export type { GooseRepository, CategoryDeleteResult, SubCategoryDeleteResult } from './types';
