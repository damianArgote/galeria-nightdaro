import { Dela_Gothic_One, JetBrains_Mono, Yuji_Syuku, Zen_Kaku_Gothic_New } from "next/font/google";

// Typefaces of the visual reference: display, body, brush kanji and mono labels.
export const display = Dela_Gothic_One({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-dela",
  display: "swap",
});
export const body = Zen_Kaku_Gothic_New({
  weight: ["400", "500", "700"],
  subsets: ["latin"],
  variable: "--font-zen",
  display: "swap",
});
export const brush = Yuji_Syuku({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-yuji",
  display: "swap",
  preload: false,
});
export const mono = JetBrains_Mono({
  weight: "500",
  subsets: ["latin"],
  variable: "--font-jbm",
  display: "swap",
});
