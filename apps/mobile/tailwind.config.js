/** @type {import('tailwindcss').Config} */
/**
 * App theme: use `pin-*` for primary brand (alerts, CTAs, headers).
 * Surfaces: `bg-slate-50`, cards `bg-white border-slate-200`.
 * Status: `emerald-*` ok, `amber-*` warnings, destructive actions `red-*` or `pin-*` muted.
 */
module.exports = {
  content: ["./App.tsx", "./src/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        pin: {
          50: "#fef2f2",
          100: "#fee2e2",
          200: "#fecaca",
          300: "#fca5a5",
          400: "#f87171",
          500: "#ef4444",
          600: "#dc2626",
          700: "#b91c1c",
          800: "#991b1b",
          900: "#7f1d1d",
          950: "#450a0a",
        },
      },
    },
  },
  plugins: [],
};
