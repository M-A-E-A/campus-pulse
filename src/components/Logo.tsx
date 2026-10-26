/**
 * The Campus Pulse mark: one ECG beat as a single stroke. One colour,
 * square caps, chunky enough to read at 16px. Reused in nav, hero,
 * footer and the CTA wallpaper.
 */
export function PulseMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      <path
        d="M1 13.5h4.5L8 6l4 13 3-9 1.8 3.5H23"
        stroke="currentColor"
        strokeWidth="2.6"
        strokeLinecap="square"
      />
    </svg>
  );
}
