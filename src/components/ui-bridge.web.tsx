// Explicit Web entry point. Re-export the same runtime bridge so Web and
// native behavior stay in sync even if Metro chooses a platform-specific file.
export * from "./ui-bridge-runtime";
