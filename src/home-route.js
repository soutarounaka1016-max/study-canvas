export const HOME_ROUTES = Object.freeze([
  "home",
  "daily",
  "weekly",
  "notes",
  "stats",
  "pages",
  "backup",
]);

const ROUTE_SET = new Set(HOME_ROUTES);

export function normalizeHomeRoute(hash) {
  const value = typeof hash === "string"
    ? hash.replace(/^#/, "").trim().toLowerCase()
    : "";
  return ROUTE_SET.has(value) ? value : "home";
}

export function homeRouteHash(route) {
  return `#${normalizeHomeRoute(route)}`;
}
