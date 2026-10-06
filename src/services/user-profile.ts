import type { User } from "firebase/auth";
import { doc, runTransaction, type DocumentData } from "firebase/firestore";
import { db } from "../firebase";

// Auth accounts and Firestore documents are created separately. Repair accounts
// left without a profile, without resetting fields another device already saved.
export async function saveUserProfile(user: User, changes: DocumentData = {}) {
  const ref = doc(db, "users", user.uid);
  return runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(ref);
    const existing = snapshot.exists() ? snapshot.data() : {};
    const defaults: DocumentData = {
      name: user.displayName || "",
      phone: user.phoneNumber || "",
      createdAt: user.metadata.creationTime
        ? new Date(user.metadata.creationTime).toISOString()
        : new Date().toISOString(),
    };
    const patch: DocumentData = {};
    for (const [key, value] of Object.entries(defaults)) {
      if (existing[key] === undefined) patch[key] = value;
    }
    Object.assign(patch, changes);
    // Firebase Auth owns the login email; cached profile data must not replace it.
    delete patch.email;
    if (user.email !== null && existing.email !== user.email) patch.email = user.email;
    if (Object.keys(patch).length) transaction.set(ref, patch, { merge: true });
    return { ...existing, ...patch };
  });
}
