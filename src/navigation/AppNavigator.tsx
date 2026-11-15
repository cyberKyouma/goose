// 导航: 主界面(含底栏) | 图表/流水为二级页(无全局底栏) | 记一笔模态
import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { HomeScreen } from '../screens/HomeScreen';
import { TransactionsScreen } from '../screens/TransactionsScreen';
import { AddTransactionScreen } from '../screens/AddTransactionScreen';
import { ChartsScreen } from '../screens/ChartsScreen';
import { CategoriesScreen } from '../screens/CategoriesScreen';

export type RootStackParamList = {
  Home: undefined;
  Charts: undefined;
  Transactions: undefined;
  AddTransaction: { editingId?: string } | undefined;
  Categories: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export const AppNavigator: React.FC = () => (
  <NavigationContainer>
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Home" component={HomeScreen} />
      <Stack.Screen name="Charts" component={ChartsScreen} />
      <Stack.Screen name="Transactions" component={TransactionsScreen} />
      <Stack.Screen
        name="AddTransaction"
        component={AddTransactionScreen}
        options={{
          presentation: 'modal',
          animation: 'slide_from_bottom',
        }}
      />
      <Stack.Screen name="Categories" component={CategoriesScreen} options={{ presentation: 'card' }} />
    </Stack.Navigator>
  </NavigationContainer>
);
