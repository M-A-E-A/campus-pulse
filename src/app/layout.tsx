import type { Metadata } from "next";
import { Inter, Space_Grotesk, IBM_Plex_Sans_Arabic } from "next/font/google";
import { Nav } from "@/components/Nav";
import { getLocale, getDict, getT, LOCALE_DIRS } from "@/i18n/server";
import { I18nProvider } from "@/i18n/provider";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const spaceGrotesk = Space_Grotesk({ subsets: ["latin"], variable: "--font-space-grotesk" });
// Arabic pages swap body + display type to IBM Plex Arabic (its Latin glyphs
// fall through to Inter for proper nouns like "EMSI").
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
      className={`${inter.variable} ${spaceGrotesk.variable} ${plexArabic.variable}`}
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
