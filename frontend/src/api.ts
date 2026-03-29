/**
 * Parse the URL path to extract club and admin secrets.
 */
export function getPathSegments(): {
  clubSecret: string;
  adminSecret: string | null;
} {
  const parts = window.location.pathname.split("/").filter(Boolean);
  const clubSecret = parts[0] || "";
  let adminSecret: string | null = null;
  if (parts[1] === "admin" && parts[2]) {
    adminSecret = parts[2];
  }
  return { clubSecret, adminSecret };
}

/**
 * User API base: /api/{club_secret}
 */
export function getApiBase(): string {
  if (import.meta.env.VITE_API_BASE) {
    return import.meta.env.VITE_API_BASE;
  }
  const { clubSecret } = getPathSegments();
  return `/api/${clubSecret}`;
}

/**
 * Admin API base: /api/{club_secret}/admin/{admin_secret}
 */
export function getAdminApiBase(): string {
  if (import.meta.env.VITE_ADMIN_API_BASE) {
    return import.meta.env.VITE_ADMIN_API_BASE;
  }
  const { clubSecret, adminSecret } = getPathSegments();
  return `/api/${clubSecret}/admin/${adminSecret}`;
}
