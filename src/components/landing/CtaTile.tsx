import Link from "next/link";
import { getT } from "@/i18n/server";
import { PulseMark } from "@/components/Logo";

/**
 * Chapter six (ink field): the close. One accent tile with the one action
 * for the supply side of the marketplace — clubs — flanked by two cropped
 * tiles: the wordmark as tone-on-tone wallpaper, and the mark on deep
 * orange. The flanks run off the edges; the row looks cropped from a
 * longer one.
 */
export async function CtaTile() {
  const t = await getT();

  return (
    <section className="field-ink pb-[12vh] pt-[4vh]">
      <div className="flex h-[360px] w-full gap-[10px]">
        {/* Left flank: the wordmark as tone-on-tone wallpaper, falling like
            water and cropped by the tile. The stack is doubled for a
            seamless loop; hovering a word swaps it for the mark, and
            hovering the flank pauses the fall so aim is easy. */}
        <div
          aria-hidden
          className="cp-flank hidden w-[14vw] shrink-0 overflow-hidden bg-paper md:block"
        >
          <div className="pt-4">
            <div className="cp-fall select-none">
              {Array.from({ length: 20 }).map((_, i) => (
                <p
                  key={i}
                  className="whitespace-nowrap text-[40px] font-extrabold leading-none tracking-tight text-ink/10"
                  style={{ paddingInlineStart: i % 2 ? "1.5rem" : "1rem" }}
                >
                  {/* The word is set as CSS content (see .cp-txt::before), not
                      as a text node: it is aria-hidden decoration, and the
                      moving crop must not read as a sliced headline. */}
                  <span className="cp-word">
                    <span className="cp-txt" />
                    <PulseMark className="cp-mark" />
                  </span>
                </p>
              ))}
            </div>
          </div>
        </div>

        {/* The action tile. */}
        <div className="field-orange flex flex-1 flex-col justify-center gap-4 p-8 md:p-10">
          <h2 className="max-w-[18ch] text-4xl font-extrabold md:text-[40px]">
            {t("landing.cta.title")}
          </h2>
          <p className="max-w-[46ch] text-[length:var(--step-body)]">
            {t("landing.cta.text")}
          </p>
          <div>
            <Link
              href="/register"
              className="mt-2 inline-block bg-ink px-8 py-3 font-semibold text-paper transition-colors hover:bg-paper hover:text-ink"
            >
              {t("landing.cta.button")}
            </Link>
          </div>
        </div>

        {/* Right flank: the mark on deep orange. */}
        <div className="hidden w-[10vw] shrink-0 items-center justify-center bg-accent-deep md:flex">
          <PulseMark className="h-16 w-16 text-paper/40" />
        </div>
      </div>

      {/* Phone: the flanks follow beneath as a pair of colour blocks. */}
      <div className="mt-[10px] flex gap-[10px] md:hidden">
        <div aria-hidden className="h-24 flex-1 bg-paper" />
        <div className="flex h-24 flex-1 items-center justify-center bg-accent-deep">
          <PulseMark className="h-8 w-8 text-paper/40" />
        </div>
      </div>
    </section>
  );
}
