import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StyleSheet } from 'react-native';
import { AppProvider } from './src/context/AppContext';
import AppNavigator from './src/navigation/AppNavigator';
import { requestNotificationPermissions } from './src/utils/notifications';
import { useEffect } from 'react';

export default function App() {
  useEffect(() => {
    requestNotificationPermissions().catch(() => {});
  }, []);

  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <AppProvider>
          <AppNavigator />
        </AppProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
