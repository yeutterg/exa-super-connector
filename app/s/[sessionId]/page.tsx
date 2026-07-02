import { AppShell } from "@/components/app-shell";

// Session permalink route — /s/<sessionId> renders the same client app; the
// store reads the session id from the pathname on mount. Sessions live in
// localStorage, so links resolve on the browser that created them (which is
// exactly what demo navigation, reloads, and back/forward need).
export default function SessionPage() {
  return <AppShell />;
}
