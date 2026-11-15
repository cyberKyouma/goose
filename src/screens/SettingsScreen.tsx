// 设置页面 - 云端同步配置
import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Switch, Alert, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Card, Button, Input } from '../components';
import { theme } from '../theme';

// 云端类型
type CloudType = 'none' | 'firebase' | 'custom';

interface CloudConfig {
  type: CloudType;
  enabled: boolean;
  firebaseConfig?: {
    apiKey: string;
    projectId: string;
  };
  customConfig?: {
    endpoint: string;
    apiKey: string;
  };
}

export const SettingsScreen: React.FC = () => {
  const [cloudConfig, setCloudConfig] = useState<CloudConfig>({
    type: 'none',
    enabled: false,
  });
  
  // 模拟云端同步状态
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'success' | 'error'>('idle');
  const [lastSyncTime, setLastSyncTime] = useState<string>('');
  
  // 切换云端同步开关
  const handleToggleSync = (value: boolean) => {
    if (value && cloudConfig.type === 'none') {
      Alert.alert(
        '启用云端同步',
        '请先选择云端服务类型',
        [{ text: '确定' }]
      );
      return;
    }
    setCloudConfig(prev => ({ ...prev, enabled: value }));
  };
  
  // 选择云端类型
  const handleSelectCloudType = (type: CloudType) => {
    setCloudConfig(prev => ({ ...prev, type }));
  };
  
  // 手动同步
  const handleManualSync = () => {
    if (!cloudConfig.enabled) {
      Alert.alert('提示', '请先启用云端同步');
      return;
    }
    
    setSyncStatus('syncing');
    
    // 模拟同步过程
    setTimeout(() => {
      setSyncStatus('success');
      setLastSyncTime(new Date().toLocaleString());
      Alert.alert('同步成功', '数据已同步到云端');
    }, 2000);
  };
  
  // 清除本地数据
  const handleClearData = () => {
    Alert.alert(
      '清除数据',
      '确定要清除所有本地数据吗？此操作不可恢复！',
      [
        { text: '取消', style: 'cancel' },
        {
          text: '清除',
          style: 'destructive',
          onPress: () => {
            Alert.alert('提示', '数据已清除（模拟）');
          },
        },
      ]
    );
  };
  
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* 顶部标题 */}
        <View style={styles.header}>
          <Text style={styles.title}>设置</Text>
        </View>
        
        {/* 云端同步 */}
        <Card style={styles.section}>
          <Text style={styles.sectionTitle}>云端同步</Text>
          
          {/* 同步开关 */}
          <View style={styles.switchRow}>
            <View>
              <Text style={styles.switchLabel}>启用云端同步</Text>
              <Text style={styles.switchDesc}>将数据同步到云端</Text>
            </View>
            <Switch
              value={cloudConfig.enabled}
              onValueChange={handleToggleSync}
              trackColor={{ false: theme.colors.border, true: theme.colors.primary }}
            />
          </View>
          
          {/* 云端类型选择 */}
          <View style={styles.cloudTypeSection}>
            <Text style={styles.fieldLabel}>云端服务</Text>
            <View style={styles.cloudTypeRow}>
              <TouchableOpacity
                style={[
                  styles.cloudTypeButton,
                  cloudConfig.type === 'firebase' && styles.cloudTypeButtonActive
                ]}
                onPress={() => handleSelectCloudType('firebase')}
              >
                <Text style={[
                  styles.cloudTypeText,
                  cloudConfig.type === 'firebase' && styles.cloudTypeTextActive
                ]}>
                  Firebase
                </Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[
                  styles.cloudTypeButton,
                  cloudConfig.type === 'custom' && styles.cloudTypeButtonActive
                ]}
                onPress={() => handleSelectCloudType('custom')}
              >
                <Text style={[
                  styles.cloudTypeText,
                  cloudConfig.type === 'custom' && styles.cloudTypeTextActive
                ]}>
                  自定义 API
                </Text>
              </TouchableOpacity>
            </View>
          </View>
          
          {/* Firebase 配置 */}
          {cloudConfig.type === 'firebase' && (
            <View style={styles.configSection}>
              <Input
                label="Firebase API Key"
                placeholder="请输入 API Key"
                secureTextEntry
              />
              <Input
                label="Firebase Project ID"
                placeholder="请输入 Project ID"
              />
            </View>
          )}
          
          {/* 自定义 API 配置 */}
          {cloudConfig.type === 'custom' && (
            <View style={styles.configSection}>
              <Input
                label="API 端点"
                placeholder="https://api.example.com"
              />
              <Input
                label="API Key"
                placeholder="请输入 API Key"
                secureTextEntry
              />
            </View>
          )}
          
          {/* 同步按钮和状态 */}
          <View style={styles.syncSection}>
            <Button
              title={syncStatus === 'syncing' ? '同步中...' : '立即同步'}
              onPress={handleManualSync}
              disabled={syncStatus === 'syncing' || !cloudConfig.enabled}
              variant={syncStatus === 'success' ? 'secondary' : 'primary'}
            />
            {lastSyncTime && (
              <Text style={styles.lastSyncText}>
                上次同步: {lastSyncTime}
              </Text>
            )}
          </View>
        </Card>
        
        {/* 数据管理 */}
        <Card style={styles.section}>
          <Text style={styles.sectionTitle}>数据管理</Text>
          
          <TouchableOpacity style={styles.menuItem} onPress={handleClearData}>
            <Text style={[styles.menuItemText, { color: theme.colors.danger }]}>
              清除本地数据
            </Text>
          </TouchableOpacity>
        </Card>
        
        {/* 关于 */}
        <Card style={styles.section}>
          <Text style={styles.sectionTitle}>关于</Text>
          
          <View style={styles.aboutRow}>
            <Text style={styles.aboutLabel}>应用名称</Text>
            <Text style={styles.aboutValue}>Goose 记账</Text>
          </View>
          
          <View style={styles.aboutRow}>
            <Text style={styles.aboutLabel}>版本</Text>
            <Text style={styles.aboutValue}>1.0.0</Text>
          </View>
          
          <View style={styles.aboutRow}>
            <Text style={styles.aboutLabel}>构建</Text>
            <Text style={styles.aboutValue}>React Native + Expo</Text>
          </View>
        </Card>
        
        <View style={styles.bottomPadding} />
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.light,
  },
  header: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.md,
  },
  title: {
    fontSize: theme.fontSize.xxl,
    fontWeight: 'bold',
    color: theme.colors.dark,
  },
  section: {
    marginHorizontal: theme.spacing.md,
    marginBottom: theme.spacing.md,
  },
  sectionTitle: {
    fontSize: theme.fontSize.lg,
    fontWeight: '600',
    color: theme.colors.dark,
    marginBottom: theme.spacing.md,
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: theme.spacing.sm,
  },
  switchLabel: {
    fontSize: theme.fontSize.md,
    color: theme.colors.dark,
    fontWeight: '500',
  },
  switchDesc: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.gray,
    marginTop: 2,
  },
  cloudTypeSection: {
    marginTop: theme.spacing.md,
  },
  fieldLabel: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.dark,
    fontWeight: '500',
    marginBottom: theme.spacing.sm,
  },
  cloudTypeRow: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
  },
  cloudTypeButton: {
    flex: 1,
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: 'center',
  },
  cloudTypeButtonActive: {
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.primary,
  },
  cloudTypeText: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.dark,
  },
  cloudTypeTextActive: {
    color: theme.colors.white,
    fontWeight: '600',
  },
  configSection: {
    marginTop: theme.spacing.md,
  },
  syncSection: {
    marginTop: theme.spacing.lg,
  },
  lastSyncText: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.gray,
    textAlign: 'center',
    marginTop: theme.spacing.sm,
  },
  menuItem: {
    paddingVertical: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  menuItemText: {
    fontSize: theme.fontSize.md,
    fontWeight: '500',
  },
  aboutRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: theme.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  aboutLabel: {
    fontSize: theme.fontSize.md,
    color: theme.colors.gray,
  },
  aboutValue: {
    fontSize: theme.fontSize.md,
    color: theme.colors.dark,
  },
  bottomPadding: {
    height: theme.spacing.xl,
  },
});
