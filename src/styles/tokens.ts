// Single source of truth for the Brand Grenade visual design system.
//
// Every color, font, and spacing token used across the platform should be
// imported from here. Do not hardcode hex values, font names, or rgba()
// strings in components — reference these tokens instead.

export const tokens = {
  amber: "#D4924A",
  amberDivider: "rgba(212,146,74,0.2)",
  bgPrimary: "#0f0f0d",
  bgSecondary: "#161612",
  bgTertiary: "#1c1c17",
  white: "#f2efe9",
  muted: "#7a776f",
  fontBody: "DM Sans",
  fontMono: "DM Mono",
} as const;

export type DesignTokens = typeof tokens;
