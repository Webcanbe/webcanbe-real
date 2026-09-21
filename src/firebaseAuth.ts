import { getApp, getApps, initializeApp } from "firebase/app"
import {
  GithubAuthProvider,
  createUserWithEmailAndPassword,
  getAuth,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  type Auth,
  type UserCredential,
} from "firebase/auth"

// Firebase project IDs are public browser configuration. Keep the environment
// variable as the preferred source, but retain the verified production project
// ID so a single missing build variable cannot silently disable GitHub/Email
// authentication while the other Firebase Web config is present.
const FIREBASE_PROJECT_ID = import.meta.env.VITE_FIREBASE_PROJECT_ID || "webcanbe-b607e"

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

const firebaseConfigValues = Object.values(firebaseConfig)

export const firebaseAuthConfigured = () =>
  firebaseConfigValues.every(value => typeof value === "string" && value.trim().length > 0)

let cachedAuth: Auth | undefined

const firebaseAuth = () => {
  if (!firebaseAuthConfigured()) throw new Error("Firebase Authentication is not configured.")
  if (!cachedAuth) {
    const app = getApps().length ? getApp() : initializeApp(firebaseConfig)
    cachedAuth = getAuth(app)
  }
  return cachedAuth
}

export async function firebaseAuthenticated() {
  if (!firebaseAuthConfigured()) return false
  const auth = firebaseAuth()
  await auth.authStateReady()
  return Boolean(auth.currentUser)
}

export async function currentFirebaseIdToken(forceRefresh = false) {
  if (!firebaseAuthConfigured()) return undefined
  const auth = firebaseAuth()
  await auth.authStateReady()
  return auth.currentUser ? auth.currentUser.getIdToken(forceRefresh) : undefined
}

export async function currentFirebaseProviderIds() {
  if (!firebaseAuthConfigured()) return []
  const auth = firebaseAuth()
  await auth.authStateReady()
  return auth.currentUser?.providerData
    .map(item => item.providerId)
    .filter((value): value is string => typeof value === "string" && value.length > 0) ?? []
}

export function signInWithGithubFirebase(): Promise<UserCredential> {
  return signInWithPopup(firebaseAuth(), new GithubAuthProvider())
}

export function createEmailAccountFirebase(email: string, password: string): Promise<UserCredential> {
  return createUserWithEmailAndPassword(firebaseAuth(), email, password)
}

export function signInWithEmailFirebase(email: string, password: string): Promise<UserCredential> {
  return signInWithEmailAndPassword(firebaseAuth(), email, password)
}

export async function signOutFirebase() {
  if (!firebaseAuthConfigured()) return
  await signOut(firebaseAuth())
}

export function firebaseAuthErrorMessage(error: unknown) {
  const code = typeof error === "object" && error && "code" in error ? String((error as { code?: unknown }).code ?? "") : ""
  if (code === "auth/popup-closed-by-user") return "GitHub sign-in was cancelled."
  if (code === "auth/popup-blocked") return "The GitHub sign-in popup was blocked by your browser."
  if (code === "auth/account-exists-with-different-credential") return "An account already exists with this email using a different sign-in method."
  if (code === "auth/email-already-in-use") return "An account already exists with this email."
  if (code === "auth/invalid-email") return "Enter a valid email address."
  if (code === "auth/weak-password") return "Use a stronger password."
  if (code === "auth/invalid-credential" || code === "auth/wrong-password" || code === "auth/user-not-found") return "Email or password is incorrect."
  return error instanceof Error ? error.message : "Sign-in is unavailable."
}
