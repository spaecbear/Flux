import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Text, View, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS } from '../constants/colors';

import HomeScreen from '../screens/HomeScreen';
import AddShiftScreen from '../screens/AddShiftScreen';
import CommitmentsScreen from '../screens/CommitmentsScreen';
import EditCommitmentScreen from '../screens/EditCommitmentScreen';
import EarningsScreen from '../screens/EarningsScreen';
import WeekScreen from '../screens/WeekScreen';

export type RootStackParamList = {
  Main: undefined;
  AddShift: { shiftId?: string; prefillDate?: string };
  EditCommitment: { jobId?: string };
};

export type TabParamList = {
  Home: undefined;
  Week: undefined;
  Commitments: undefined;
  Earnings: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<TabParamList>();

const TAB_ICONS: Record<string, string> = {
  Home: '◉',
  Week: '▦',
  Commitments: '⬡',
  Earnings: '◈',
};

const TAB_LABELS: Record<string, string> = {
  Home: 'HOME',
  Week: 'WEEK',
  Commitments: 'JOBS',
  Earnings: 'PAY',
};

function TabIcon({ name, focused, color }: { name: string; focused: boolean; color: string }) {
  return (
    <View style={{ alignItems: 'center', gap: 3 }}>
      <Text style={{ fontSize: 18, color, opacity: focused ? 1 : 0.45, lineHeight: 22 }}>
        {TAB_ICONS[name]}
      </Text>
      <Text
        numberOfLines={1}
        style={{ fontSize: 10, color, opacity: focused ? 1 : 0.45, letterSpacing: 0.8, lineHeight: 13 }}
      >
        {TAB_LABELS[name]}
      </Text>
    </View>
  );
}

function MainTabs() {
  const insets = useSafeAreaInsets();

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarShowLabel: false,
        tabBarIcon: ({ focused, color }) => <TabIcon name={route.name} focused={focused} color={color} />,
        tabBarActiveTintColor: COLORS.accent,
        tabBarInactiveTintColor: COLORS.textMuted,
        tabBarStyle: {
          backgroundColor: COLORS.surface,
          borderTopColor: COLORS.border,
          borderTopWidth: 1,
          height: 60 + Math.max(insets.bottom, 0),
          paddingTop: 8,
          paddingBottom: Math.max(insets.bottom, 8),
        },
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Week" component={WeekScreen} />
      <Tab.Screen name="Commitments" component={CommitmentsScreen} />
      <Tab.Screen name="Earnings" component={EarningsScreen} />
    </Tab.Navigator>
  );
}

export default function AppNavigator() {
  return (
    <NavigationContainer>
      <Stack.Navigator
        screenOptions={{
          headerStyle: { backgroundColor: COLORS.background },
          headerTintColor: COLORS.textPrimary,
          headerTitleStyle: { fontWeight: '600', letterSpacing: 0.5 },
          headerShadowVisible: false,
          contentStyle: { backgroundColor: COLORS.background },
        }}
      >
        <Stack.Screen name="Main" component={MainTabs} options={{ headerShown: false }} />
        <Stack.Screen
          name="AddShift"
          component={AddShiftScreen}
          options={({ route }) => ({
            title: route.params?.shiftId ? 'Edit Shift' : 'New Shift',
            presentation: 'modal',
          })}
        />
        <Stack.Screen
          name="EditCommitment"
          component={EditCommitmentScreen}
          options={({ route }) => ({
            title: route.params?.jobId ? 'Edit Commitment' : 'New Commitment',
            presentation: 'modal',
          })}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
