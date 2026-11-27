// アプリのアイコン（icon-192.png・icon-512.png）を作る。漆喰の白の地に、さつまいも（紫と黄）。
// 使い方: node tools/make-icons.cjs（qa/ の playwright を使う。無ければ入っている playwright）
const path = require("path");
let pw; try { pw = require(path.join(__dirname, "..", "qa", "node_modules", "playwright")); } catch (e) { pw = require("playwright"); }
const IMO = `<path d="M14 44c-6-8-2-22 10-28 12-7 26-5 30 3 4 9-4 21-16 27-10 5-19 5-24-2z" fill="#7A2E5B"/><path d="M20 40c4 2 12 1 18-3M24 26c3 0 7-1 10-3" stroke="#E9C46A" stroke-width="3" fill="none" stroke-linecap="round"/><path d="M50 18c3-3 6-4 8-3-1 3-3 5-7 6" fill="#3A302B"/><path d="M9 47c-3 1-5 3-5 5 3 0 5-1 7-3" fill="#3A302B"/>`;
module.exports = { IMO };
if (require.main === module) (async () => {
  const b = await pw.chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
  for (const s of [192, 512]) {
    const p = await b.newPage({ viewport: { width: s, height: s } });
    await p.setContent(`<body style="margin:0"><svg width="${s}" height="${s}" viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg"><rect width="64" height="64" fill="#FBF8F2"/><circle cx="32" cy="32" r="29" fill="#E9C46A" opacity=".35"/><g transform="translate(2 2) scale(.94)">${IMO}</g></svg></body>`);
    await p.screenshot({ path: path.join(__dirname, "..", `icon-${s}.png`), clip: { x: 0, y: 0, width: s, height: s } });
  }
  await b.close();
})();
