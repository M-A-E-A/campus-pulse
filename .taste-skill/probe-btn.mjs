// One-off: verify the shared .btn primitives on the auth forms — rest, hover,
// keyboard focus, disabled — measured from computed style rather than eyeballed.
// Usage: node .taste-skill/probe-btn.mjs [url]
import { Browser, sleep } from "../.agents/skills/design-taste-frontend/scripts/lib/cdp.mjs";

const url = process.argv[2] || "http://localhost:3100/login";

const browser = await Browser.launch();
try {
  const page = await browser.newPage({ width: 1440, height: 900, dsf: 1 });
  await page.goto(url, { timeoutMs: 30000, settleMs: 800 });
  await sleep(700);

  const read = async () =>
    page.eval(`(() => {
      const b = document.querySelector('button.btn');
      if (!b) return null;
      const c = getComputedStyle(b);
      return {
        text: b.innerText.trim(),
        disabled: b.disabled,
        bg: c.backgroundColor,
        color: c.color,
        opacity: c.opacity,
        outline: c.outlineStyle === 'none' ? 'none'
          : c.outlineWidth + ' ' + c.outlineStyle + ' ' + c.outlineColor + ' offset ' + c.outlineOffset,
        shadow: c.boxShadow,
        radius: c.borderRadius,
        cursor: c.cursor,
        size: c.fontSize + ' / ' + c.fontWeight,
      };
    })()`);

  const base = await read();

  // Hover: move the real pointer over the button.
  const box = await page.eval(`(() => {
    const r = document.querySelector('button.btn').getBoundingClientRect();
    return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) };
  })()`);
  await page.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: box.x, y: box.y });
  await sleep(400);
  const hover = await read();

  // Keyboard focus: Tab until the button is the active element. Chrome only
  // matches :focus-visible for keyboard focus, so a programmatic focus() would
  // not prove the ring exists.
  let focus = null;
  for (let i = 0; i < 24; i++) {
    await page.send("Input.dispatchKeyEvent", {
      type: "keyDown", key: "Tab", code: "Tab",
      windowsVirtualKeyCode: 9, nativeVirtualKeyCode: 9,
    });
    await page.send("Input.dispatchKeyEvent", {
      type: "keyUp", key: "Tab", code: "Tab",
      windowsVirtualKeyCode: 9, nativeVirtualKeyCode: 9,
    });
    await sleep(80);
    // Must be THIS button: the nav's language switcher is also a <button>, and
    // read() always reports button.btn — matching on tag alone silently
    // measured the wrong element.
    const reached = await page.eval(`(() => {
      const b = document.querySelector('button.btn');
      return document.activeElement === b;
    })()`);
    if (reached) { focus = await read(); break; }
  }

  // Disabled = the pending state (the form sets disabled={pending}).
  await page.eval(`(() => { document.querySelector('button.btn').disabled = true; })()`);
  await sleep(250);
  const disabled = await read();

  console.log(JSON.stringify({ base, hover, focus, disabled }, null, 1));
} finally {
  await browser.close();
}
