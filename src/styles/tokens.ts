// Single source of truth for the Brand Grenade visual design system.
//
// Every color, font, and spacing token used across the platform should be
// imported from here. Do not hardcode hex values, font names, or rgba()
// strings in components — reference these tokens instead.

export const tokens = {
  amber: "#C81E1E",
  amberDivider: "rgba(200, 30, 30,0.2)",
  bgPrimary: "#0A0908",
  bgSecondary: "#1C1A18",
  bgTertiary: "#1C1A18",
  white: "#EDE8E0",
  muted: "#8B8680",
  fontBody: "Inter",
  fontMono: "Inter",
} as const;

export type DesignTokens = typeof tokens;
