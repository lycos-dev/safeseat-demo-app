export function accountErrorMessage(error: unknown, fallback: string): string {
  const code = (error as { code?: string } | null)?.code;
  switch (code) {
    case "auth/email-already-in-use":
      return "An account with this email already exists. Log in, or use Forgot password to reset your password.";
    case "auth/invalid-email": return "Please enter a valid email address.";
    case "auth/weak-password": return "Use a stronger password with at least 6 characters.";
    case "auth/invalid-credential":
    case "auth/wrong-password":
    case "auth/invalid-password":
    case "auth/user-not-found": return "The email or password is incorrect. Please try again.";
    case "auth/too-many-requests": return "Too many attempts. Please try again later.";
    case "auth/network-request-failed":
    case "unavailable":
    case "firestore/unavailable": return "Check your internet connection and try again.";
    case "auth/user-disabled": return "This account has been disabled. Please contact support.";
    case "auth/requires-recent-login": return "Please log in again before making this change.";
    case "permission-denied":
    case "firestore/permission-denied": return "Your profile could not be saved because access was denied. Please contact support.";
    case "not-found": return "This profile no longer exists. Return to Profiles and refresh the list.";
    default: return fallback;
  }
}
