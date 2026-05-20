import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { BottomTabScreenProps } from "@react-navigation/bottom-tabs";

export type AuthStackParamList = {
  Landing: undefined;
  SignIn: undefined;
  SignUp: undefined;
  ForgotPassword: undefined;
  ResetPassword: { token?: string };
  Contact: undefined;
};

export type AppTabParamList = {
  Dashboard: undefined;
  Requests: undefined;
  Tasks: undefined;
  CIRO: undefined;
  Profile: undefined;
};

export type AppStackParamList = {
  Tabs: undefined;
  Contact: undefined;
  ChangePassword: undefined;
  TwoFactorSettings: undefined;
  TwoFactorSetup: undefined;
  SafeZones: undefined;
  Chat: { requestId: string };
  NotFound: undefined;
};

export type AdminStackParamList = {
  Admin: undefined;
  AdminUsers: undefined;
  AdminRequests: undefined;
  AdminLogs: undefined;
  UserView: undefined;
  CIRO: undefined;
  SafeZones: undefined;
  ChangePassword: undefined;
  TwoFactorSettings: undefined;
  TwoFactorSetup: undefined;
  Chat: { requestId: string };
  Contact: undefined;
  NotFound: undefined;
};

export type AuthStackProps<T extends keyof AuthStackParamList> = NativeStackScreenProps<AuthStackParamList, T>;
export type AppStackProps<T extends keyof AppStackParamList> = NativeStackScreenProps<AppStackParamList, T>;
export type AdminStackProps<T extends keyof AdminStackParamList> = NativeStackScreenProps<AdminStackParamList, T>;
export type AppTabProps<T extends keyof AppTabParamList> = BottomTabScreenProps<AppTabParamList, T>;
