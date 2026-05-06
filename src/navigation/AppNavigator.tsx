import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Text, Platform } from 'react-native';
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

function TabIcon({ name, focused }: { name: string; focused: boolean }) {
  const icons: Record<string, string> = {
    Home: '◉',
    Week: '▦',
    Commitments: '⬡',
    Earnings: '◈',
  };
  return (
    <Text style={{ fontSize: 18, opacity: focused ? 1 : 0.4 }}>
      {icons[name]}
    </Text>
  );
}

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarIcon: ({ focused }) => <TabIcon name={route.name} focused={focused} />,
        tabBarActiveTintColor: COLORS.accent,
        tabBarInactiveTintColor: COLORS.textMuted,
        tabBarStyle: {
          backgroundColor: COLORS.surface,
          borderTopColor: COLORS.border,
          borderTopWidth: 1,
          paddingBottom: Platform.OS === 'ios' ? 20 : 10,
          paddingTop: 8,
          height: Platform.OS === 'ios' ? 82 : 68,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          letterSpacing: 0.5,
          marginBottom: 2,
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
