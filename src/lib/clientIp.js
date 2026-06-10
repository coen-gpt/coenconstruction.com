// Fallback client IP lookup for SMS consent records. The primary source is
// the verifyTurnstile backend function (reads cf-connecting-ip server-side);
// this only runs if that call failed or didn't return an IP.
export async function fetchClientIp() {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4000);
    const res = await fetch('https://api.ipify.org?format=json', { signal: controller.signal });
    clearTimeout(timer);
    const data = await res.json();
    return typeof data?.ip === 'string' ? data.ip : null;
  } catch {
    return null;
  }
}
