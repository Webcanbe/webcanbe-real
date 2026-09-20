import fs from "node:fs"
import { describe, expect, it } from "vitest"

const firebaseAuth = fs.readFileSync("src/firebaseAuth.ts", "utf8")
const app = fs.readFileSync("src/App.tsx", "utf8")
const pkg = JSON.parse(fs.readFileSync("package.json", "utf8")) as { dependencies?: Record<string,string> }

describe("Phase 5 Firebase Authentication", () => {
  it("initializes Firebase from the requested Vite environment variables", () => {
    for (const name of [
      "VITE_FIREBASE_API_KEY",
      "VITE_FIREBASE_AUTH_DOMAIN",
      "VITE_FIREBASE_PROJECT_ID",
      "VITE_FIREBASE_STORAGE_BUCKET",
      "VITE_FIREBASE_MESSAGING_SENDER_ID",
      "VITE_FIREBASE_APP_ID",
    ]) expect(firebaseAuth).toContain("import.meta.env." + name)
    expect(firebaseAuth).toContain("initializeApp(firebaseConfig)")
    expect(firebaseAuth).toContain("getAuth(app)")
  })

  it("keeps the public Firebase project ID as a safe build fallback", () => {
    expect(firebaseAuth).toContain('const FIREBASE_PROJECT_ID = import.meta.env.VITE_FIREBASE_PROJECT_ID || "webcanbe-b607e"')
    expect(firebaseAuth).toContain("projectId: FIREBASE_PROJECT_ID")
  })

  it("connects GitHub with Firebase popup auth and no GitHub client secret", () => {
    expect(firebaseAuth).toContain("new GithubAuthProvider()")
    expect(firebaseAuth).toContain("signInWithPopup(firebaseAuth(), new GithubAuthProvider())")
    expect(firebaseAuth).not.toContain("GITHUB_CLIENT_ID")
    expect(firebaseAuth).not.toContain("GITHUB_CLIENT_SECRET")
    expect(firebaseAuth).not.toContain("clientSecret")
  })

  it("connects email signup and login to the Firebase password APIs", () => {
    expect(firebaseAuth).toContain("createUserWithEmailAndPassword(firebaseAuth(), email, password)")
    expect(firebaseAuth).toContain("signInWithEmailAndPassword(firebaseAuth(), email, password)")
    expect(app).toContain("signup?await createEmailAccountFirebase")
    expect(app).toContain(":await signInWithEmailFirebase")
  })

  it("keeps the existing auth modal structure and uses its single field as email then password", () => {
    expect(app).toContain('className="auth-demo-modal"')
    expect(app).toContain('className="auth-demo-provider"')
    expect(app).toContain('className="auth-demo-email"')
    expect(app).toContain('className="auth-demo-continue"')
    expect(app).toContain('type={emailStep?"password":"email"}')
    expect(app).toContain('placeholder={emailStep?"Password":"Email address"}')
  })

  it("exchanges Firebase identity for the same first-party session used by protected routes", () => {
    expect(firebaseAuth).toContain("currentFirebaseIdToken")
    expect(app).toContain("productionSignedIn")
    expect(app).toContain("hostedProductClient.firebaseExchange(idToken)")
    expect(app).toContain("credential.user.getIdToken(true)")
    expect(app).toContain("productionSignOut")
    expect(app).toContain("signOutFirebase()")
    expect(app).not.toContain("firebaseAuthenticated().catch(()=>false)")
  })

  it("returns successful GitHub or email auth to the existing dashboard target", () => {
    expect(app).toContain('function Auth({signup=false,next="/dashboard"')
    expect(app).toContain("finish=()=>")
    expect(app).toContain("await establishFirebaseSession(credential)")
    expect(app).toContain("go(next)")
  })

  it("keeps the public Firebase project ID in the Worker rather than requiring another runtime secret", () => {
    const worker = fs.readFileSync("worker/index.js", "utf8")
    const deploy = fs.readFileSync("scripts/cloudflare-deploy.mjs", "utf8")
    expect(worker).toContain('const FIREBASE_PROJECT_ID = "webcanbe-b607e"')
    expect(deploy).not.toContain("VITE_FIREBASE_PROJECT_ID")
    expect(deploy).not.toContain("FIREBASE_PROJECT_ID")
  })

  it("pins the Firebase web SDK in the application dependency graph", () => {
    expect(pkg.dependencies?.firebase).toBe("^12.19.0")
  })
})
