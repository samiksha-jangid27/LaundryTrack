import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useEffect } from 'react';
import * as SplashScreen from 'expo-splash-screen';
import { isRunningInExpoGo } from 'expo';
import { SessionProvider, useSession } from '../lib/session';
import LaunchScreen from '../components/LaunchScreen';
import { colors } from '../components/UI';
SplashScreen.preventAutoHideAsync().catch(() => {});
if (!isRunningInExpoGo()) SplashScreen.setOptions({ duration: 350, fade: true });
function AppContent() {
  const { loading, user } = useSession();
  useEffect(() => {
    SplashScreen.hideAsync().catch(() => {});
  }, []);
  if (loading)
    return (
      <>
        <StatusBar style="light" />
        <LaunchScreen />
      </>
    );
  return (
    <>
      <StatusBar style={user ? 'dark' : 'light'} />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.bg },
          headerTintColor: colors.green,
          headerShadowVisible: false,
          contentStyle: { backgroundColor: colors.bg },
        }}
      >
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="order/[id]" options={{ title: 'Order details' }} />
        <Stack.Screen name="support/[id]" options={{ title: 'Query conversation' }} />
        <Stack.Screen
          name="scan/[id]"
          options={{ title: 'Verify a garment', presentation: 'modal' }}
        />
      </Stack>
    </>
  );
}
export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <SessionProvider>
        <AppContent />
      </SessionProvider>
    </SafeAreaProvider>
  );
}
