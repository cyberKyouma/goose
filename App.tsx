// 主入口
import React, { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { View, Text, ActivityIndicator, StyleSheet, Platform } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppNavigator } from './src/navigation/AppNavigator';
import { useStore } from './src/stores/appStore';
import { theme } from './src/theme';

// 加载组件
const LoadingScreen: React.FC = () => (
  <View style={styles.loading}>
    <ActivityIndicator size="large" color={theme.colors.primary} />
    <Text style={styles.loadingText}>加载中...</Text>
  </View>
);

export default function App() {
  const initialize = useStore((s) => s.initialize);
  const isLoading = useStore((s) => s.isLoading);
  const flashMessage = useStore((s) => s.flashMessage);
  const setFlashMessage = useStore((s) => s.setFlashMessage);

  useEffect(() => {
    initialize();
  }, [initialize]);

  useEffect(() => {
    if (!flashMessage) return;
    const timer = setTimeout(() => setFlashMessage(null), 1600);
    return () => clearTimeout(timer);
  }, [flashMessage, setFlashMessage]);

  if (isLoading) {
    return <LoadingScreen />;
  }

  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <View style={styles.frame}>
        <View style={styles.column}>
          <AppNavigator />
          {flashMessage ? (
            <View pointerEvents="none" style={styles.toastWrap}>
              <View style={styles.toast}>
                <Text style={styles.toastText}>{flashMessage}</Text>
              </View>
            </View>
          ) : null}
        </View>
      </View>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.colors.light,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: theme.colors.gray,
  },
  frame: {
    flex: 1,
    backgroundColor: Platform.OS === 'web' ? '#E4E4E4' : '#FFFFFF',
    alignItems: 'center',
  },
  column: {
    flex: 1,
    width: '100%',
    maxWidth: Platform.OS === 'web' ? 430 : undefined,
    backgroundColor: '#FFFFFF',
  },
  toastWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 96,
    alignItems: 'center',
  },
  toast: {
    backgroundColor: 'rgba(30,30,30,0.92)',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 6,
  },
  toastText: {
    color: '#FFFFFF',
    fontSize: 14,
  },
});
