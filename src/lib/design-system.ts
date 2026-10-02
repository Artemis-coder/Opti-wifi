/**
 * OptiSpace Design System — TypeScript mirror of src/styles/design-system.css
 * ---------------------------------------------------------------------------
 * The CSS file is the canonical source for Tailwind utilities; this module
 * mirrors the same values for code that cannot read CSS: Recharts series,
 * canvas/SVG output, native (Capacitor/Android) configuration and exports.
 *
 * Both files must be kept in sync when a brand token changes.
 */

export const BRAND = {
  /** #3f9e63 — main actions, active states, focus rings */
  primary: "#3f9e63",
  /** #84c865 — accents, active nav text, gradients */
  secondary: "#84c865",
  /** #1b3f2b — dark surfaces: sidebars, bottom nav, splash background */
  chrome: "#1b3f2b",
  /** text/icon colour on primary and secondary fills */
  onBrand: "#0b1a0f",
} as const;

export const BRAND_SCALE = {
  50: "#f2f9f4",
  100: "#e0f2e7",
  200: "#c2e5cf",
  300: "#9ed6b4",
  400: BRAND.secondary,
  500: BRAND.primary,
  600: "#358554",
  700: "#2b6b45",
  800: "#235437",
  900: BRAND.chrome,
  950: "#0f261a",
} as const;

export const FEEDBACK = {
  danger: "#ba1a1a",
  dangerSoft: "#fdecec",
  warning: "#f59e0b",
  warningSoft: "#ffdfa6",
  info: "#3b82f6",
  success: BRAND.primary,
} as const;

/** Ordered series palette for charts, brand colour first. */
export const CHART_SERIES = [
  BRAND.primary,
  "#3b82f6",
  BRAND.secondary,
  "#8b5cf6",
  "#ef4444",
  "#6366f1",
  "#14b8a8",
] as const;

/** Native shell colours: status bar, splash, WebView background. */
export const NATIVE = {
  background: `${BRAND.chrome}ff`,
  statusBar: BRAND.chrome,
  splashBackground: BRAND.chrome,
  launcherBackground: BRAND.secondary,
} as const;

export const APP = {
  name: "OptiSpace",
  legacyName: "Opti Wi-Fi",
  /** Package id is intentionally unchanged: changing it breaks installs. */
  appId: "com.optiwifi.app",
} as const;
