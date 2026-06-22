/**
 * @lozzalingo/dashboard - Shared Admin Pages
 *
 * Every Lozzalingo app re-exports these from thin page files:
 *
 *   // app/admin/ops/page.tsx
 *   export { OpsPage as default } from "@lozzalingo/dashboard/pages";
 *
 * This ensures consistent UI across all apps.
 */

export { ModulePageProvider } from "./shared";
export type { ModulePageContext } from "./shared";

export { default as OpsPage } from "./OpsPage";
export { default as SubscribersPage } from "./SubscribersPage";
export { default as LogsPage } from "./LogsPage";
export { default as EmailPage } from "./EmailPage";
export { default as OutreachPage } from "./OutreachPage";
export { default as CalendarPage } from "./CalendarPage";
export { default as PaymentsPage } from "./PaymentsPage";
export { default as SettingsPage } from "./SettingsPage";
export { default as AnalyticsPage } from "./AnalyticsPage";
export { default as StoragePage } from "./StoragePage";
export { default as ConfigPage } from "./ConfigPage";
export { default as AuthPage } from "./AuthPage";
export { default as ExternalApiPage } from "./ExternalApiPage";
export { default as BlogAdminPage } from "./BlogAdminPage";
export { default as CrmPage } from "./CrmPage";

// Auth pages (mirrors Python framework's auth templates)
export { default as SignInPage } from "./SignInPage";
export { default as RegisterPage } from "./RegisterPage";
export { default as ForgotPasswordPage } from "./ForgotPasswordPage";
