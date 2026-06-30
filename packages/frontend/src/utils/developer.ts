const DEVELOPER_EMAILS = (import.meta.env.VITE_DEVELOPER_EMAILS || '')
  .split(',')
  .map((email: string) => email.trim().toLowerCase())
  .filter(Boolean);

/** True when the signed-in user's email is in VITE_DEVELOPER_EMAILS (build-time). */
export function isDeveloperEmail(email?: string | null): boolean {
  if (!email || DEVELOPER_EMAILS.length === 0) return false;
  return DEVELOPER_EMAILS.includes(email.trim().toLowerCase());
}
