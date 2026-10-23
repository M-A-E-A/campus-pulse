/** Gray pulse block in the paper palette — used by the loading.tsx files. */
export function Skeleton({ className = "" }: { className?: string }) {
  return <div aria-hidden className={`animate-pulse rounded-lg bg-line/60 ${className}`} />;
}
