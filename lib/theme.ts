// Centralized Tailwind class tokens for the app theme.
// Modern, minimalistic design following Material Design principles

// Pitch basic black theme
export const APP_BG =
  "min-h-screen bg-black text-slate-50";

export const PAGE_MAIN = "mx-auto max-w-none px-6 sm:px-8 py-8";

// Account for fixed sidebar (w-72 = 288px + left-6 = 24px = 312px + gap)
export const LAYOUT_ROW = "flex gap-6 lg:gap-8 lg:ml-[320px]";

// Card styles - dark shade of black
export const CARD_PRIMARY =
  "rounded-xl bg-[#0a0a0a] shadow-sm shadow-white/5 border border-white/5";

export const CARD_SECONDARY =
  "rounded-xl bg-[#0a0a0a] shadow-sm shadow-white/5 border border-white/5";

// Typography
export const TEXT_HEADING = "text-lg sm:text-xl font-semibold text-white";

export const TEXT_BODY = "text-sm text-slate-200 leading-relaxed";

export const TEXT_MUTED = "text-xs text-slate-500";

// Accent colors (limited to 2-3)
export const ACCENT_PRIMARY = "text-sky-400";
export const ACCENT_SECONDARY = "text-emerald-400";

// Interactive states
export const HOVER_BG = "hover:bg-white/5 transition-colors duration-200";

// Shadows
export const SHADOW_CARD = "shadow-lg shadow-black/20";
export const SHADOW_SUBTLE = "shadow-sm shadow-black/10";
