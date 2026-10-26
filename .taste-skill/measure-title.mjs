// One-off: how many lines does the real h1 take at 390px per candidate size?
import { Browser } from '../.agents/skills/design-taste-frontend/scripts/lib/cdp.mjs';

const urls = [
  'http://localhost:3100/events/seed-event-eth', // 46 chars
  'http://localhost:3100/events/seed-event-erc', // 52 chars (longest real title)
];
const browser = await Browser.launch();
try {
  for (const url of urls) {
    const page = await browser.newPage({ width: 390, height: 844, dsf: 1 });
    await page.goto(url, { timeoutMs: 30000, settleMs: 800 });
    for (const f of [40, 36, 34, 32, 30, 28, 26]) {
      for (const bleed of [false, true]) {
        const r = await page.eval(`(() => {
          const h1 = document.querySelector('h1');
          if (!h1) return { err: 'no h1' };
          h1.style.fontSize = '${f}px';
          ${bleed ? "h1.style.marginLeft='-16px'; h1.style.width='calc(100% + 32px)';" : "h1.style.marginLeft=''; h1.style.width='';"}
          const size = ${f};
          const walker = document.createTreeWalker(h1, NodeFilter.SHOW_TEXT);
          const range = document.createRange();
          const tops = [];
          for (let n = walker.nextNode(); n; n = walker.nextNode()) {
            if (!n.nodeValue.trim()) continue;
            range.selectNodeContents(n);
            for (const rc of range.getClientRects()) {
              if (rc.width < 1 || rc.height < size * 0.35) continue;
              const mid = rc.top + rc.height / 2;
              if (!tops.some((t) => Math.abs(t - mid) < size * 0.55)) tops.push(mid);
            }
          }
          return { lines: Math.max(1, tops.length), w: Math.round(h1.getBoundingClientRect().width) };
        })()`);
        console.log(url.split('/').pop(), `f=${f}`, bleed ? 'bleed' : 'pad  ', `lines=${r.lines ?? '?'}`, `w=${r.w ?? '?'}`);
      }
    }
    await page.close();
  }
} finally {
  await browser.close();
}
