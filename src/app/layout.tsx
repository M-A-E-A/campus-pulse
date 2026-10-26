import type { Metadata } from "next";
import localFont from "next/font/local";
import { IBM_Plex_Sans_Arabic } from "next/font/google";
import { Nav } from "@/components/Nav";
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

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return {
    title: t("meta.title"),
    description: t("meta.description"),
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
        </I18nProvider>
      </body>
    </html>
  );
}
