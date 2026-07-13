import { AnimatedSplashOverlay } from '@/components/animated-icon';
import AppTabs from '@/components/app-tabs';
import LoginScreen from '@/components/login-screen';
import NicknameScreen from '@/components/nickname-screen';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { DarkTheme, DefaultTheme, ThemeProvider } from 'expo-router';
import { ActivityIndicator, useColorScheme, View } from 'react-native';

function RootNavigation() {
  const { session, loading, needsNickname } = useAuth();

  if (loading) {
  return (
    <View style={{ flex: 1, backgroundColor: '#111', justifyContent: 'center', alignItems: 'center' }}>
      <ActivityIndicator size="large" color="#e53e3e" />
    </View>
  );
}

  if (!session) {
    return <LoginScreen />;
  }

  if (needsNickname) {
    return <NicknameScreen />;
  }

  return <AppTabs />;
}

export default function TabLayout() {
  const colorScheme = useColorScheme();
  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <AuthProvider>
        <AnimatedSplashOverlay />
        <RootNavigation />
      </AuthProvider>
    </ThemeProvider>
  );
}