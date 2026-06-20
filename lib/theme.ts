export const DEFAULT_SIDEBAR_COLOR = '#0f172a'

export const SIDEBAR_COLOR_PRESETS = [
  { name: 'Slate', value: '#0f172a' },
  { name: 'Navy', value: '#1e3a5f' },
  { name: 'Blue', value: '#1e3a8a' },
  { name: 'Teal', value: '#134e4a' },
  { name: 'Green', value: '#14532d' },
  { name: 'Purple', value: '#581c87' },
  { name: 'Maroon', value: '#7f1d1d' },
  { name: 'Charcoal', value: '#171717' },
] as const

export function isValidHexColor(color: string | null | undefined): boolean {
  return typeof color === 'string' && /^#[0-9A-Fa-f]{6}$/.test(color)
}

export function normalizeSidebarColor(color: string | null | undefined): string {
  return isValidHexColor(color) ? color! : DEFAULT_SIDEBAR_COLOR
}

export interface OrgTheme {
  sidebar: string
  primary: string
  primaryForeground: string
  ring: string
  accentSoft: string
}

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const normalized = hex.replace('#', '')
  if (normalized.length !== 6) return null
  const r = parseInt(normalized.slice(0, 2), 16)
  const g = parseInt(normalized.slice(2, 4), 16)
  const b = parseInt(normalized.slice(4, 6), 16)
  if ([r, g, b].some((n) => Number.isNaN(n))) return null
  return { r, g, b }
}

function rgbToHsl(r: number, g: number, b: number): { h: number; s: number; l: number } {
  const rn = r / 255
  const gn = g / 255
  const bn = b / 255
  const max = Math.max(rn, gn, bn)
  const min = Math.min(rn, gn, bn)
  const l = (max + min) / 2
  let h = 0
  let s = 0

  if (max !== min) {
    const d = max - min
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
    switch (max) {
      case rn:
        h = ((gn - bn) / d + (gn < bn ? 6 : 0)) / 6
        break
      case gn:
        h = ((bn - rn) / d + 2) / 6
        break
      default:
        h = ((rn - gn) / d + 4) / 6
    }
  }

  return {
    h: Math.round(h * 360),
    s: Math.round(s * 100),
    l: Math.round(l * 100),
  }
}

export function hexToHslParts(hex: string): { h: number; s: number; l: number } | null {
  const rgb = hexToRgb(hex)
  if (!rgb) return null
  return rgbToHsl(rgb.r, rgb.g, rgb.b)
}

/** Brighter accent from sidebar color — used for buttons, badges, active nav. */
export function deriveOrgTheme(sidebarHex: string): OrgTheme {
  const sidebar = normalizeSidebarColor(sidebarHex)
  const hsl = hexToHslParts(sidebar) ?? { h: 221, s: 83, l: 15 }

  const accentS = Math.min(92, Math.max(48, hsl.s < 35 ? hsl.s + 30 : hsl.s + 8))
  const accentL = hsl.l < 28 ? 46 : Math.min(56, Math.max(40, hsl.l + 22))

  const primary = `${hsl.h} ${accentS}% ${accentL}%`
  const primaryForeground = accentL > 54 ? '222.2 47.4% 11.2%' : '0 0% 98%'
  const accentSoft = `${hsl.h} ${Math.round(accentS * 0.45)}% 92%`

  return {
    sidebar,
    primary,
    primaryForeground,
    ring: primary,
    accentSoft,
  }
}

const DEFAULT_THEME = deriveOrgTheme(DEFAULT_SIDEBAR_COLOR)

export function applyOrgTheme(sidebarHex: string | null | undefined): OrgTheme {
  const theme = deriveOrgTheme(normalizeSidebarColor(sidebarHex))
  const root = document.documentElement
  root.style.setProperty('--primary', theme.primary)
  root.style.setProperty('--primary-foreground', theme.primaryForeground)
  root.style.setProperty('--ring', theme.ring)
  root.style.setProperty('--org-sidebar', theme.sidebar)
  root.style.setProperty('--org-accent-soft', theme.accentSoft)
  return theme
}

export function resetOrgTheme(): void {
  const root = document.documentElement
  root.style.setProperty('--primary', DEFAULT_THEME.primary)
  root.style.setProperty('--primary-foreground', DEFAULT_THEME.primaryForeground)
  root.style.setProperty('--ring', DEFAULT_THEME.ring)
  root.style.removeProperty('--org-sidebar')
  root.style.removeProperty('--org-accent-soft')
}
