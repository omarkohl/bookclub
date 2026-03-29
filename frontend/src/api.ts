/**
 * Derive the API base URL from the current page URL.
 *
 * The app is served at /{club_secret}/ and the API lives at /api/{club_secret}/.
 * In dev mode with Vite proxy, we use the VITE_API_BASE env var.
 */
export function getApiBase(): string {
  if (import.meta.env.VITE_API_BASE) {
    return import.meta.env.VITE_API_BASE;
  }

  // In production, derive from the URL path.
  // URL pattern: /{club_secret}/... or /{club_secret}/admin/{admin_secret}/...
  const parts = window.location.pathname.split("/").filter(Boolean);
  if (parts.length === 0) {
    return "/api";
  }
  const clubSecret = parts[0];
  return `/api/${clubSecret}`;
}
