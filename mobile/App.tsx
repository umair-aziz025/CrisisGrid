import "react-native-gesture-handler";
import React, { useRef } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { NavigationContainerRef } from "@react-navigation/native";

import { ToastProvider } from "@/components/Toast";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { AuthProvider } from "@/hooks/useAuth";
import { useFCMNotifications, setNotificationNavigationRef, processPendingNavigation } from "@/hooks/useFCMNotifications";
import { ThemeProvider } from "@/theme/ThemeProvider";
import RootNavigator from "@/navigation/RootNavigator";

function PushNotificationManager() {
  useFCMNotifications();
  return null;
}

export default function App() {
  const navigationRef = useRef<NavigationContainerRef<any>>(null);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider>
          <ErrorBoundary>
            <AuthProvider>
              <ToastProvider>
                <PushNotificationManager />
                <RootNavigator
                  ref={(ref) => {
                    navigationRef.current = ref;
                    setNotificationNavigationRef(ref);
                    // Process any pending navigation from a notification tapped while app was killed
                    setTimeout(() => processPendingNavigation(), 500);
                  }}
                />
              </ToastProvider>
            </AuthProvider>
          </ErrorBoundary>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
