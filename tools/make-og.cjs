// SNS で貼られたときの絵（og.png 1200×630）を作る。さつまいものアイコンと、朝から翌朝までの時間割の例。
// 使い方: node tools/make-og.cjs（qa/ の playwright を使う。無ければ入っている playwright）
const path = require("path");
let pw; try { pw = require(path.join(__dirname, "..", "qa", "node_modules", "playwright")); } catch (e) { pw = require("playwright"); }
const { IMO } = require("./make-icons.cjs");
(async () => {
  const b = await pw.chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
  const p = await b.newPage({ viewport: { width: 1200, height: 630 } });
  const rows = [["9時", "蔵の町並み", "#7A2E5B"], ["12時", "中心の外でお昼", "#2f6b46"], ["13時", "喜多院", "#2f6b46"], ["18時", "夕暮れ蔵さんぽ", "#7A2E5B"], ["19時", "夕ごはん", "#7A2E5B"], ["泊まり", "川越に泊まる", "#3A302B"], ["翌朝7時", "朝さんぽ", "#7A2E5B"]];
  const tt = rows.map(([h, n, c]) => `<div style="display:flex;gap:14px;align-items:center;margin:7px 0"><b style="width:120px;text-align:right;font-size:26px">${h}</b><span style="flex:1;background:#f6e6bd;border:3px solid #3A302B;border-left:12px solid ${c};border-radius:10px;padding:6px 14px;font-size:28px;font-weight:700">${n}</span></div>`).join("");
  await p.setContent(`<body style="margin:0;font-family:'Noto Sans CJK JP','IPAPGothic',sans-serif">
  <div style="width:1200px;height:630px;box-sizing:border-box;padding:44px 60px;background:#FBF8F2;color:#3A302B;display:flex;gap:48px;align-items:center">
    <div style="flex:1">
      <svg width="130" height="130" viewBox="0 0 64 64">${IMO}</svg>
      <div style="font-size:76px;font-weight:900;line-height:1.15;white-space:nowrap;margin-top:6px">川越<br><span style="color:#7A2E5B">1日プランナー</span></div>
      <div style="font-size:32px;margin-top:16px">朝から翌朝まで、川越の1日を組む</div>
    </div>
    <div style="width:520px">${tt}</div>
  </div></body>`);
  await p.screenshot({ path: path.join(__dirname, "..", "og.png") });
  await b.close();
})();
