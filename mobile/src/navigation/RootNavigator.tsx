import React, { useCallback, useMemo, forwardRef } from "react";
import { NavigationContainer, NavigationContainerRef, DarkTheme as NavDarkTheme, DefaultTheme as NavLightTheme, Theme } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { StatusBar } from "expo-status-bar";
import {
  Home as HomeIcon,
  AlertTriangle,
  ListChecks,
  User as UserIcon,
  Radio,
} from "lucide-react-native";

import { useAuth } from "@/hooks/useAuth";
import { useSessionTimeout } from "@/hooks/useSessionTimeout";
import { Spinner } from "@/components/ui/Spinner";
import { SessionTimeoutModal } from "@/components/SessionTimeoutModal";
import { useTheme } from "@/theme/ThemeProvider";
import type { ColorPalette } from "@/theme";

import LandingScreen from "@/screens/LandingScreen";
import SignInScreen from "@/screens/SignInScreen";
import SignUpScreen from "@/screens/SignUpScreen";
import ForgotPasswordScreen from "@/screens/ForgotPasswordScreen";
import ResetPasswordScreen from "@/screens/ResetPasswordScreen";
import ContactScreen from "@/screens/ContactScreen";
import DashboardScreen from "@/screens/DashboardScreen";
import RequestsScreen from "@/screens/RequestsScreen";
import TasksScreen from "@/screens/TasksScreen";
import ProfileScreen from "@/screens/ProfileScreen";
import ChangePasswordScreen from "@/screens/ChangePasswordScreen";
import TwoFactorSettingsScreen from "@/screens/TwoFactorSettingsScreen";
import TwoFactorSetupScreen from "@/screens/TwoFactorSetupScreen";
import SafeZonesScreen from "@/screens/SafeZonesScreen";
import ChatScreen from "@/screens/ChatScreen";
import CIROScreen from "@/screens/CIROScreen";
import AdminDashboardScreen from "@/screens/admin/AdminDashboardScreen";
import AdminUsersScreen from "@/screens/admin/AdminUsersScreen";
import AdminRequestsScreen from "@/screens/admin/AdminRequestsScreen";
import AdminLogsScreen from "@/screens/admin/AdminLogsScreen";
import NotFoundScreen from "@/screens/NotFoundScreen";

import type {
  AdminStackParamList,
  AppStackParamList,
  AppTabParamList,
  AuthStackParamList,
} from "./types";

function buildNavTheme(palette: ColorPalette, mode: "dark" | "light"): Theme {
  const base = mode === "light" ? NavLightTheme : NavDarkTheme;
  return {
    ...base,
    colors: {
      ...base.colors,
      background: palette.background,
      card: palette.surface,
      border: palette.border,
      primary: palette.crisisRescue,
      text: palette.foreground,
      notification: palette.destructive,
    },
  };
}

const AuthStack = createNativeStackNavigator<AuthStackParamList>();
const AppStack = createNativeStackNavigator<AppStackParamList>();
const AdminStack = createNativeStackNavigator<AdminStackParamList>();
const Tabs = createBottomTabNavigator<AppTabParamList>();

function AuthNavigator() {
  return (
    <AuthStack.Navigator
      screenOptions={{
        headerShown: false,
        animation: "slide_from_right",
      }}
    >
      <AuthStack.Screen name="Landing" component={LandingScreen} />
      <AuthStack.Screen name="SignIn" component={SignInScreen} />
      <AuthStack.Screen name="SignUp" component={SignUpScreen} />
      <AuthStack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
      <AuthStack.Screen name="ResetPassword" component={ResetPasswordScreen} />
      <AuthStack.Screen name="Contact" component={ContactScreen} />
    </AuthStack.Navigator>
  );
}

function AppTabs() {
  const { palette } = useTheme();
  const { user } = useAuth();
  const role = (user?.role || "").toUpperCase();
  // Civilians (VICTIM role) can only create requests; the Tasks tab is
  // a volunteer-only concept, so hide it for them. Admin/staff who pass
  // through this stack also see Tasks since they may claim too.
  const showTasks = role !== "VICTIM";
  return (
    <Tabs.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle: {
          backgroundColor: palette.surface,
          borderTopColor: palette.border,
          height: 64,
          paddingTop: 6,
          paddingBottom: 8,
        },
        tabBarActiveTintColor: palette.crisisRescue,
        tabBarInactiveTintColor: palette.mutedForeground,
        tabBarLabelStyle: { fontSize: 11, fontWeight: "600" },
        tabBarIcon: ({ color, size }) => {
          const sz = size ?? 22;
          if (route.name === "Dashboard") return <HomeIcon size={sz} color={color} />;
          if (route.name === "Requests") return <AlertTriangle size={sz} color={color} />;
          if (route.name === "Tasks") return <ListChecks size={sz} color={color} />;
          if (route.name === "CIRO") return <Radio size={sz} color={color} />;
          return <UserIcon size={sz} color={color} />;
        },
      })}
    >
      <Tabs.Screen name="Dashboard" component={DashboardScreen} />
      <Tabs.Screen name="Requests" component={RequestsScreen} />
      {showTasks ? <Tabs.Screen name="Tasks" component={TasksScreen} /> : null}
      <Tabs.Screen name="CIRO" component={CIROScreen} options={{ title: "CIRO" }} />
      <Tabs.Screen name="Profile" component={ProfileScreen} />
    </Tabs.Navigator>
  );
}

function AppNavigator() {
  return (
    <AppStack.Navigator
      screenOptions={{
        headerShown: false,
        animation: "slide_from_right",
      }}
    >
      <AppStack.Screen name="Tabs" component={AppTabs} />
      <AppStack.Screen name="Contact" component={ContactScreen} />
      <AppStack.Screen name="ChangePassword" component={ChangePasswordScreen} />
      <AppStack.Screen name="TwoFactorSettings" component={TwoFactorSettingsScreen} />
      <AppStack.Screen name="TwoFactorSetup" component={TwoFactorSetupScreen} />
      <AppStack.Screen name="SafeZones" component={SafeZonesScreen} />
      <AppStack.Screen name="Chat" component={ChatScreen} />
      <AppStack.Screen name="NotFound" component={NotFoundScreen} />
    </AppStack.Navigator>
  );
}

function AdminNavigator() {
  return (
    <AdminStack.Navigator
      screenOptions={{
        headerShown: false,
        animation: "slide_from_right",
      }}
    >
      <AdminStack.Screen name="Admin" component={AdminDashboardScreen} />
      <AdminStack.Screen name="AdminUsers" component={AdminUsersScreen} />
      <AdminStack.Screen name="AdminRequests" component={AdminRequestsScreen} />
      <AdminStack.Screen name="AdminLogs" component={AdminLogsScreen} />
      <AdminStack.Screen name="UserView" component={AppTabs} />
      <AdminStack.Screen name="CIRO" component={CIROScreen} />
      <AdminStack.Screen name="SafeZones" component={SafeZonesScreen} />
      <AdminStack.Screen name="ChangePassword" component={ChangePasswordScreen} />
      <AdminStack.Screen name="TwoFactorSettings" component={TwoFactorSettingsScreen} />
      <AdminStack.Screen name="TwoFactorSetup" component={TwoFactorSetupScreen} />
      <AdminStack.Screen name="Chat" component={ChatScreen} />
      <AdminStack.Screen name="Contact" component={ContactScreen} />
      <AdminStack.Screen name="NotFound" component={NotFoundScreen} />
    </AdminStack.Navigator>
  );
}

const RootNavigator = forwardRef<NavigationContainerRef<any>>(function RootNavigator(_props, ref) {
  const { user, isLoading, signOut } = useAuth();
  const { palette, mode, themeKey } = useTheme();
  const isSignedIn = !!user;

  const handleExpire = useCallback(() => {
    signOut();
  }, [signOut]);

  const { showWarning, secondsLeft, extendSession } = useSessionTimeout(
    handleExpire,
    isSignedIn,
  );

  const navTheme = useMemo(() => buildNavTheme(palette, mode), [palette, mode]);

  if (isLoading) return <Spinner fullscreen />;

  const role = (user?.role || "").toUpperCase();
  const isAdmin = role === "ADMIN" || role === "SUPERADMIN" || role === "STAFF";

  return (
    <NavigationContainer key={themeKey} theme={navTheme} ref={ref}>
      <StatusBar style={mode === "light" ? "dark" : "light"} />
      {isSignedIn ? (isAdmin ? <AdminNavigator /> : <AppNavigator />) : <AuthNavigator />}
      <SessionTimeoutModal
        open={isSignedIn && showWarning}
        secondsLeft={secondsLeft}
        onExtend={extendSession}
        onSignOut={handleExpire}
      />
    </NavigationContainer>
  );
});

export default RootNavigator;
