// Single runtime bridge for iOS, Android, and Web.
// Keeping this entry point platform-safe prevents Web from accidentally
// resolving native-only @expo/ui icon implementations.
export * from "./ui-bridge-runtime";
