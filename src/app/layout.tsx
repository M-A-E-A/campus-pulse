import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { IBM_Plex_Sans_Arabic } from "next/font/google";
import { Nav } from "@/components/Nav";
import { RegisterSW } from "@/components/pwa/RegisterSW";
import { ViewReporter } from "@/components/traffic/ViewReporter";
import { getLocale, getDict, getT, LOCALE_DIRS } from "@/i18n/server";
import { I18nProvider } from "@/i18n/provider";
import "./globals.css";

// Cabinet Grotesk, self-hosted (Fontshare woff2, latin subset, ~20KB each):
// one family, two roles — display 800, body 400/500. No runtime CDN.
const cabinet = localFont({
  src: [
    { path: "../fonts/cabinet-grotesk-400.woff2", weight: "400", style: "normal" },
    { path: "../fonts/cabinet-grotesk-500.woff2", weight: "500", style: "normal" },
    { path: "../fonts/cabinet-grotesk-800.woff2", weight: "800", style: "normal" },
  ],
  variable: "--font-cabinet",
  display: "swap",
  // Name the @font-face after the typeface it actually is. next/font otherwise
  // takes the family from the JS variable, so the stack shipped as
  // `font-family: cabinet` — an undocumented alias for the real thing. The
  // loaded files were always Cabinet Grotesk; this only makes the CSS say so,
  // which is also what the dealt-typeface check compares against (the sheet
  // deals "Cabinet Grotesk"). The plugin derives both the @font-face family
  // and --font-cabinet from this value, so the two cannot drift apart.
  declarations: [{ prop: "font-family", value: "'Cabinet Grotesk'" }],
});
// Arabic swaps the whole stack to IBM Plex Arabic (its Latin glyphs
// fall through for proper nouns like "EMSI").
const plexArabic = IBM_Plex_Sans_Arabic({
  subsets: ["arabic"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-arabic",
});

/**
 * Next 15 moved themeColor from metadata to the viewport export. Ink, same as
 * the manifest's theme_color — the address bar / standalone window chrome
 * should match the app's own header rule.
 */
export const viewport: Viewport = {
  themeColor: "#14130f",
};

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return {
    // Share cards need absolute image URLs; without a base Next emits
    // relative og:image refs that WhatsApp/Slack silently drop (or worse,
    // resolve against localhost). Env-driven so prod never inherits dev.
    metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3100"),
    title: t("meta.title"),
    description: t("meta.description"),
    // The icon.* file convention can only yield ONE icon (Next's resolver
    // stops at the first extension that exists, so app/icon.svg and
    // app/icon.png cannot both auto-link). The favicon is therefore declared
    // explicitly: SVG first for every modern browser, PNG as the Safari
    // fallback (Safari has no SVG favicon support). app/favicon.ico still
    // auto-prepends as the legacy 16px entry, and app/apple-icon.png keeps
    // its file-convention ROUTE — this block only replaces the head tags.
    icons: {
      icon: [
        { type: "image/svg+xml", url: "/icon.svg" },
        { type: "image/png", url: "/icon.png" },
      ],
      apple: [{ url: "/apple-icon.png" }],
    },
    // iOS ignores app/manifest.ts for home-screen chrome: it wants these meta
    // tags (app/apple-icon.png feeds the link tag from the icons block above).
    appleWebApp: {
      capable: true,
      title: "Campus Pulse",
      // The nav sits on paper, so a light status bar with dark text is the
      // honest continuation of the page under it.
      statusBarStyle: "default",
    },
  };
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();
  const dir = LOCALE_DIRS[locale];
  const dict = await getDict();
  const t = await getT();

  return (
    // Font variables live on <html>: the @theme --font-sans/--font-display
    // chains resolve at :root, so putting them on <body> left them empty.
    <html
      lang={locale}
      dir={dir}
      className={`${cabinet.variable} ${plexArabic.variable}`}
    >
      <body className="antialiased">
        <I18nProvider locale={locale} dir={dir} dict={dict}>
          <a
            href="#main"
            className="sr-only focus:not-sr-only focus:fixed focus:start-4 focus:top-4 focus:z-[100] focus:rounded-md focus:bg-ink focus:px-4 focus:py-2 focus:text-paper"
          >
            {t("common.skipToContent")}
          </a>
          <Nav />
          <main id="main">{children}</main>
          {/* PWA: registers the service worker (prod only, no-op otherwise). */}
          <RegisterSW />
          {/* Creator traffic: one beacon per client-side navigation (fire-and-forget). */}
          <ViewReporter />
        </I18nProvider>
      </body>
    </html>
  );
}
