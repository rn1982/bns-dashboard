// Vercel Cron sends `Authorization: Bearer <CRON_SECRET>` when CRON_SECRET is set
// in the project's environment variables.
// Returns null when the request may proceed, or a reason string when it must be rejected.
export function checkCronAuth(request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    // Not configured yet: allow, but the response warns about it.
    return null;
  }
  const header = request.headers.get('authorization') || '';
  return header === `Bearer ${secret}` ? null : 'Unauthorized';
}
