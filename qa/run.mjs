// 川越1日プランナーの QA（CI の QA と同じ）。node qa/run.mjs。結果は qa-report/report.md
// 1. 点のつけ方・最高点・お客さんの作り方（ブラウザなし） 2. ファイルの中身（数字・出典・ことば・PWA） 3. ブラウザで遊ぶ（スマホ・PC・キーボード・保存）
import { chromium } from "playwright";
import { mkdirSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { createRequire } from "node:module";
import { createServer } from "node:http";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { checkTransfer } from "./transfer-check.mjs";
import { checkSwStall } from "./sw-check.mjs";
import { checkDepth } from "./depth-check.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const results = [];
const check = (name, ok, detail = "") => results.push({ name, ok: !!ok, detail: String(detail).slice(0, 400) });
const firstClose = async (q) => { if (await q.locator("#howto[open]").count()) await q.click("#howto-ok"); if (await q.evaluate(() => !!(window.Core && Core.coach && Core.coach.active()))) { await q.evaluate(() => { Core.coach.leave(); scrollTo(0, 0); }); await q.waitForTimeout(100); } }; // はじめての練習の吹き出しをやめてホームへ
const G = createRequire(import.meta.url)(path.join(root, "data.js"));

// 過去の日のお客さんが変わらない（data.js のカード・WHO・WISH の並びを変えると変わる。値は 2026-11-28 に作ったもの）
const PINS = "friends:kane,slow:kane,again:kitain+hiru,abroad:kane+kura,again:kitain+hiru;solo:kane,family:omiyage,again:kashiya+kane,first:kane+kitain,family:omiyage+kura;solo:omiyage,again:kane,pair:hiru+kitain,friends:omiyage+kitain,first:kitain+kura";

// ---- 1. 点のつけ方・最高点・お客さん ----
{
  // 点：指定どおり「夜と朝・中心の外・泊まりを入れると点が上がる」「中心の通りは昼ほど混む」
  const day = { kura: 3, kashiya: 4, hiru: 5, omiyage: 6, cafe: 7 }; // 昼の中心だけの日帰り
  const good = { kura: 0, kashiya: 1, hiru2: 2, kitain: 3, senba: 4, yakata: 5, cafe: 7, yugure: 9, yuhan: 10, tomari: 12, asa: 13, asagohan: 14 };
  const a = G.score(day), b = G.score(good);
  check("点：昼の中心だけの日帰りより、夜と朝・中心の外・泊まりを入れた旅のほうが3つとも高い", b.time > a.time && b.money > a.money && b.crowd > a.crowd && b.total > a.total, `${JSON.stringify(a)} → ${JSON.stringify(b)}`);
  check("点：泊まりを足すと町にいた時間が上がる・中心の外へ移すと混雑の点が上がる", G.score({ ...day, tomari: 12 }).time > a.time && G.score({ kura: 3, kitain: 4 }).crowd > G.score({ kura: 3, kashiya: 4 }).crowd);
  check("点：中心の通りは昼ほど混む（混み方は12〜14時がいちばん高く、夜と朝は0）", G.CROWD.indexOf(Math.max(...G.CROWD)) === 4 && G.CROWD[5] === 5 && G.CROWD.slice(G.NIGHT).every((x) => x === 0) && G.CROWD[0] < G.CROWD[3]);
  check("時間割：朝9時〜20時は1時間ずつ・泊まり（21時〜翌朝7時）・翌朝7時と8時で合わせて24時間", G.SLOTS.length === 15 && G.LEN.reduce((x, y) => x + y, 0) === 24 && G.SLOTS[0] === 9 && G.SLOTS[G.NIGHT] === "n");
  check("点：何も置かないと0点・3つの点は0〜100", JSON.stringify(G.score({})) === JSON.stringify({ time: 0, money: 0, crowd: 0, total: 0 }) && [a, b].every((s) => ["time", "money", "crowd", "total"].every((k) => s[k] >= 0 && s[k] <= 100)));
  check("置き方：泊まりは泊まりの枠だけ・夕暮れの蔵さんぽは18時だけ・2枠のカードは泊まりをまたがない", G.fits("tomari", 12) && !G.fits("tomari", 11) && G.fits("yugure", 9) && !G.fits("yugure", 8) && !G.fits("yakata", 11));
  check("置き方：同じ時間に2枚は置けない（2枠のカードの次の枠も）", !G.canPut({ yakata: 2 }, "kura", 3) && G.canPut({ yakata: 2 }, "kura", 4) && !G.canPut({ kura: 1 }, "kashiya", 1));

  // 最高点：data.js の best()（動的計画法）を、別に書いた総当たりと比べる
  function brute(hand, must) {
    let b = -1; const used = new Set(), pl = {};
    (function dfs(s) {
      if (s >= G.SLOTS.length) { if (must.every((m) => used.has(m))) b = Math.max(b, G.score(pl).total); return; }
      dfs(s + 1);
      for (const id of hand) { if (used.has(id) || !G.fits(id, s)) continue; used.add(id); pl[id] = s; dfs(s + G.BY[id].dur); delete pl[id]; used.delete(id); }
    })(0);
    return b;
  }
  const bad = [];
  for (let i = 0; i < 6; i++) for (const lv of ["n", "h"]) {
    const g = G.guest(`${lv}|qa${i}`), top = G.best(g.hand, g.must), bf = brute(g.hand, g.must);
    if (top.total !== bf || G.score(top.place).total !== top.total || !g.must.every((m) => m in top.place)) bad.push(`${g.tag}:${top.total}/${bf}`);
  }
  check("最高点：best() が、別に書いた総当たりと同じ点になり、その置き方で本当にその点が出る（12組）", bad.length === 0, bad.join(","));
  check("星：最高点から4点以内で★3・14点以内で★2・ほかは★1", G.starsOf(90, 94) === 3 && G.starsOf(89, 94) === 2 && G.starsOf(80, 94) === 2 && G.starsOf(79, 94) === 1);

  // お客さん：3年分
  const badD = [], keys = new Set(); let low = 101;
  const d0 = Date.parse("2026-11-28");
  for (let i = 0; i < 365 * 3; i++) {
    const d = new Date(d0 + i * 864e5).toISOString().slice(0, 10);
    for (const tag of [...G.dailyTags(d), ...G.hardTags(d)]) {
      const g = G.guest(tag);
      const ok = g.hand.length === (g.lv ? 7 : 8) && g.hand.includes("tomari") && g.must.length === (g.lv ? 2 : 1) && g.must.every((m) => g.hand.includes(m)) && new Set(g.hand).size === g.hand.length && G.validTag(tag) && G.WHO.includes(g.who);
      if (!ok) badD.push(tag);
      keys.add(G.keyOf(g));
      if (i < 120) low = Math.min(low, G.best(g.hand, g.must).total);
    }
    if (G.dailyTags(d).map((t) => G.guest(t).lv).join() !== "0,0,1" || G.hardTags(d).length !== 2) badD.push(d);
  }
  check("お客さん：今日（ふつう2・上級1）と上級（2組）を3年分作れる。手札はふつう8枚・上級7枚で泊まりを含み、行きたい所（1つ・2つ）は手札にある", badD.length === 0, badD.slice(0, 5).join(","));
  check("お客さん：ちがう組み合わせが300通り以上（好きなだけ遊んでも同じ組が続かない。game-dev.md F6）", keys.size >= 300, keys.size);
  check("お客さん：どの組も、いちばん高い点が75点以上（★3をめざせる）", low >= 75, low);
  const snap = ["2026-11-28", "2026-11-29", "2027-01-01"].map((d) => [...G.dailyTags(d), ...G.hardTags(d)].map((t) => { const g = G.guest(t); return `${g.who}:${g.must.join("+")}`; }).join(",")).join(";");
  check("過去の日（2026-11-28・11-29・2027-01-01）のお客さんが作ったときのまま（カード・WHO・WISH の並びを変えると変わる）", snap === PINS, snap);
}

// ---- 2. ファイルの中身 ----
const html = readFileSync(path.join(root, "index.html"), "utf8"), gen = readFileSync(path.join(root, "data.js"), "utf8"), readme = readFileSync(path.join(root, "README.md"), "utf8");
const gameOwn = (x) => x.replace(/<!-- ([a-z0-9-]+):begin[\s\S]*?<!-- \1:end -->/g, "").replace(/\/\/ part:(\w+):begin[\s\S]*?\/\/ part:\1:end/g, "");
const own = gameOwn(html);
// ことば：画面の T を取り出して4言語をくらべる
const tSrc = own.match(/const T = (\{[\s\S]*?\n\});/)[1], tipsSrc = own.match(/const TIPS = (\{[\s\S]*?\n\});/)[1];
const T = new Function(`return ${tSrc};`)(), TIPS = new Function(`return ${tipsSrc};`)();
{
  const miss = [];
  for (const l of G.LANGS) {
    if (!T[l]) { miss.push(`${l}:なし`); continue; }
    for (const k of Object.keys(T.ja)) { const a = T.ja[k], b = T[l][k]; if (b === undefined || typeof a !== typeof b || (Array.isArray(a) && a.length !== b.length)) miss.push(`${l}.${k}`); else if (a && typeof a === "object" && !Array.isArray(a)) for (const q of Object.keys(a)) if (!b[q]) miss.push(`${l}.${k}.${q}`); }
    if (!TIPS[l] || TIPS[l].length !== TIPS.ja.length) miss.push(`TIPS.${l}`);
    for (const c of G.CARDS) if (!c.t[l] || c.t[l].length !== 2 || c.t[l].some((x) => !x)) miss.push(`card.${c.id}.${l}`);
  }
  check("ことば：日本語・English・中文・한국어の4つで、画面のことば・カードの名前と一言・今日のきほんに抜けが無い", miss.length === 0, miss.slice(0, 8).join(","));
  check("ことば：日本語のほかは AI の訳でまだ人が確かめていない、と「このゲームについて」に4言語とも書く", G.LANGS.every((l) => T[l].aboutP.some((p) => /AI/.test(p))));
  check("ことば：言語は URL の ?lang= か、この端末で選んだもの（kwd-lang）か、端末の言語で決まり、html の lang も替える", /URLSearchParams\(location\.search\)\.get\("lang"\)/.test(own) && /document\.documentElement\.lang = /.test(own));
  check("ことば：hreflang などの外のことばのページを作らない（1つのページの中で切り替える）", !/hreflang/.test(html));
}
{
  // 数字：統計は2つだけ（約736万人・93.8%）。ほかの人数・割合を書かない
  const texts = [JSON.stringify(T), JSON.stringify(TIPS), JSON.stringify(G.CARDS.map((c) => c.t)), readme.replace(/https?:\/\/\S+/g, "")].join("\n");
  const found = [...texts.matchAll(/\d[\d,.]*\s*(%|％|万人|만 명|million|人|명)/g)].map((m) => m[0].replace(/\s/g, ""));
  const okNum = /^(736万人|93\.8%|7\.36million|736만명|7,358,000人|[1-5]人|[1-5]명)$/; // 1〜5人はお客さんの人数（統計ではない）
  check("数字：統計は川越市の資料の2つ（観光客 約736万人・日帰り 93.8%）だけ", found.length > 0 && found.every((x) => okNum.test(x)), [...new Set(found)].join(","));
  check("数字：約736万人は2024年（令和6年）、93.8% は令和2年（2020年）の観光アンケートと書く", G.LANGS.every((l) => /2024/.test(T[l].factV) && /2020|令和2年/.test(T[l].factD)) && /2024年（令和6年）/.test(readme) && /2020年/.test(readme));
  check("数字：出典の資料は川越市のページ（一次資料）だけ", Object.values(G.SRC).every(([, u]) => /^https:\/\/www\.city\.kawagoe\.saitama\.jp\//.test(u)) && /r6matome\.pdf/.test(G.SRC.s1[1]) && /627\/r2\.pdf/.test(G.SRC.s2[1]));
  check("お金：「目安」と書き、本当の値段ではないと「このゲームについて」・README に書く", /目安/.test(T.ja.mMoney) && T.ja.aboutP.some((p) => /目安で、本当の値段ではありません/.test(p)) && /本当の値段ではありません/.test(readme) && !/円/.test(texts));
}
check("小江戸ゲーム部の名前・ロゴを入れない", !/小江戸ゲーム部|小江戸ポーカー部|Koedo Game/i.test(html + gen + readme));
check("画面にお笑いの言葉を入れない（本物っぽく）", !/お笑い|ギャグ|ツッコミ|なんでやねん|（うそ）/.test(html + gen));
check("色：蔵の黒 #3A302B・さつまいもの紫 #7A2E5B・黄 #E9C46A・漆喰の白 #FBF8F2 を使い、さつまいものアイコンがある", ["#3A302B", "#7A2E5B", "#E9C46A", "#FBF8F2"].every((c) => html.includes(c)) && /const IMO = `<svg/.test(own));
{
  const ext = [...html.matchAll(/(?:src|href)="(https?:[^"]+)"/g)].map((m) => m[1]).filter((u) => !/^https:\/\/fonts\.googleapis\.com(\/|$)|^https:\/\/ko-fi\.com\/satouaaaaa$/.test(u));
  check("外から読むのは文字（Google Fonts）だけ。スクリプト・広告・解析を入れない", ext.length === 0 && ![...html.matchAll(/<script[^>]+src="([^"]+)"/g)].some((m) => /^https?:/.test(m[1])), ext.join(","));
}
check("CSP で通信先を自分だけにしている", /connect-src 'self'/.test(html) && !/connect-src[^;"]*https/.test(html));
check("Math.random は練習・とことんの種だけ（今日のお客さん・上級は日付の乱数。data.js には無い）", (own.match(/Math\.random/g) || []).length === 1 && !/Math\.random/.test(gen));
check("乱数は sort の比較の中で引かない", !/\.sort\(\s*\([^)]*\)\s*=>[^\n;]*\b(R|rng|rand|Math\.random)\s*\(/.test(html + gen));
{ const inl = html.split("<script>").slice(1).map((x) => x.split("</" + "script>")[0]).join("\n");
  check("一行の式の途中にコメント // を足さない（行の残りが消える）", !/;\s*\/\/[^\n]*;\s*\w/.test((gen + "\n" + inl).split("\n").filter((l) => !l.trim().startsWith("//")).join("\n"))); }
check("引き継ぎ：transfer.js をゲームの script より前に、このゲームのキー（記録・文字・言語・復習）だけで読む・depth.js も前に読む", /<script src="transfer\.js" data-game="kawagoe-1day" data-keys="kwd-v1,kwd-fs,kwd-lang,kwd-depth"><\/script>\s*<script src="depth\.js" data-game="kawagoe-1day" data-key="kwd-depth"><\/script>\s*<\/head>/.test(html));
check("好きなだけ遊べる：チケット・回数の上限・🔒で開くモードを入れない（game-dev.md F1・F2）", !/🎫|チケット|すると開く|🔒/.test(own));
{ const og = (k) => (html.match(new RegExp(`<meta (?:property|name)="${k}" content="([^"]+)"`)) || [])[1] || "";
  const png = readFileSync(path.join(root, "og.png"));
  check("SNS で貼ると絵と題が出る（OGP・1200×630・絶対URL）", og("og:title") && og("og:description") && og("og:image") === "https://satou-aaaaa.github.io/kawagoe-1day/og.png" && og("twitter:card") === "summary_large_image" && png.readUInt32BE(16) === 1200 && png.readUInt32BE(20) === 630); }
{ const fy = readFileSync(path.join(root, ".github/ISSUE_TEMPLATE/feedback.yml"), "utf8");
  check("感想フォームの name が3字以上", [...((fy.match(/^name:\s*(.+)$/m) || [])[1] || "").trim()].length >= 3);
  check("感想フォームは名前・メールを聞かない", /id: fun/.test(fy) && !/id: (name|email|mail)/.test(fy) && /labels: \["感想"\]/.test(fy)); }
check("README の URL のすぐ後ろに全角の字を続けない（Link check が URL の一部と読む）", !/https?:\/\/[\x21-\x7e]*[^\x00-\x7f]/.test(readme.replace(/\]\(https?:\/\/[^)\s]+\)/g, "").replace(/<https?:\/\/[^>\s]+>/g, "")));
{ const sw = readFileSync(path.join(root, "sw.js"), "utf8"), mf = JSON.parse(readFileSync(path.join(root, "manifest.webmanifest"), "utf8"));
  const shell = JSON.parse(sw.match(/SHELL = (\[[^\]]+\])/)[1]);
  check("PWA：sw.js は画面のファイルを全部保存し（data.js・transfer.js・depth.js も）、外へ何も送らない", ["./index.html", "./data.js", "./transfer.js", "./transfer-qr.js", "./depth.js", "./manifest.webmanifest", "./icon-192.png", "./icon-512.png"].every((f) => shell.includes(f) && existsSync(path.join(root, f))) && /cache: "reload"/.test(sw));
  { const st = await checkSwStall(sw); check("PWA：通信が止まっても4秒ほどで保存した画面に切り替わる（shared-workflows template/qa/sw-check.mjs）", st.ok, JSON.stringify(st)); }
  check("PWA：manifest にアイコン2つと名前がある", mf.name === "川越1日プランナー" && mf.icons.length >= 2 && mf.start_url === "./"); }

// ---- 3. ブラウザで遊ぶ ----
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".png": "image/png", ".webmanifest": "application/manifest+json" };
const server = createServer((req, res) => {
  const p = decodeURIComponent(new URL(req.url, "http://x").pathname), f = path.join(root, p === "/" ? "index.html" : p);
  if ((f !== root && !f.startsWith(root + path.sep)) || !existsSync(f)) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { "content-type": TYPES[path.extname(f)] || "application/octet-stream" }); res.end(readFileSync(f));
}).listen(0, "127.0.0.1");
await new Promise((r) => server.once("listening", r));
const url = `http://127.0.0.1:${server.address().port}/`;
const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
const errors = [];
const TODAY = new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);
async function newPage(w = 390, ctx, q = "?lang=ja") {
  const c = ctx || await browser.newContext({ viewport: { width: w, height: 800 }, locale: "ja-JP" });
  await c.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
  const p = await c.newPage();
  p.on("pageerror", (e) => errors.push(e.message));
  p.on("console", (m) => { if (m.type() === "error" && !/ERR_FAILED|net::/.test(m.text())) errors.push(m.text()); });
  await p.goto(url + q); await p.waitForTimeout(200);
  return p;
}
// いまのお客さんを、最高点の置き方でカードを押して置き、決める
async function solve(p, { worst = false } = {}) {
  await p.waitForSelector("#hand");
  const plan = await p.evaluate((worst) => { const c = __kw.cur(); if (worst) { const o = {}; for (const m of c.g.must) { const C = __kw.G.BY[m]; for (let s = C.from; s <= C.to; s++) if (__kw.G.canPut(o, m, s)) { o[m] = s; break; } } return o; } return __kw.G.best(c.g.hand, c.g.must).place; }, worst);
  for (const [id, s] of Object.entries(plan)) { if (!(await p.locator(`#hand [data-c="${id}"][aria-pressed="true"]`).count())) await p.click(`#hand [data-c="${id}"]`); await p.click(`[data-put="${s}"]`); }
  await p.click("#decide"); await p.waitForSelector("#verdict");
}

try {
  const p = await newPage();
  check("はじめて開くと、点数に入らない練習の吹き出しが出る", await p.locator("#core-coach").waitFor({ timeout: 3000 }).then(() => true, () => false));
  await firstClose(p);
  check("はじめての練習が始まったその場で「見た」が残る", await p.evaluate(() => __kw.load().tut === true));
  check("ホーム：題・今日のきほん・数字2つ（約736万人・93.8%）が出る", (await p.textContent(".title")).includes("1日プランナー") && (await p.textContent("#tip")).includes("今日のきほん") && (await p.textContent(".facts")).includes("約736万人") && (await p.textContent(".facts")).includes("93.8%"));

  // 4言語で切り替わり、開き直しても残る
  { const seen = [];
    for (const [l, word, lang] of [["en", "Today's guests", "en"], ["zh", "今天的客人", "zh-Hans"], ["ko", "오늘의 손님", "ko"], ["ja", "今日のお客さん", "ja"]]) {
      await p.click(`.langs button[data-l="${l}"]`); await p.waitForTimeout(80);
      seen.push((await p.textContent("#go-d")).includes(word) && (await p.evaluate(() => document.documentElement.lang)) === lang);
    }
    await p.click('.langs button[data-l="ko"]'); await p.goto(url); await p.waitForTimeout(150);
    const kept = (await p.textContent("#go-d")).includes("오늘의 손님");
    await p.click('.langs button[data-l="ja"]');
    check("言語：日本語・English・中文・한국어に切り替わり（html の lang も）、開き直しても残る", seen.every(Boolean) && kept, seen.join(",") + " " + kept); }
  { const c = await browser.newContext({ locale: "en-US" }); const q = await newPage(390, c, ""); await firstClose(q);
    check("言語：はじめは端末の言語（英語の端末なら English）", (await q.textContent("#go-d")).includes("Today's guests")); await c.close(); }

  // 今日のお客さん3組：最高点で組む → ★3・記録・共有
  await p.click("#go-d");
  check("今日のお客さんは日付から決まる（data.js の dailyTags と同じ）", JSON.stringify(await p.evaluate(() => __kw.load().runs.d.list)) === JSON.stringify(G.dailyTags(TODAY)));
  check("行きたい所を入れるまで「この旅で決める」は押せない", await p.locator("#decide[disabled]").count() === 1);
  await solve(p);
  check("決めると3つの点・合計・星・講評・この手札の最高点が出る", (await p.textContent("#verdict")).includes("町にいた時間") && (await p.textContent("#verdict")).includes("使ったお金の目安") && (await p.textContent("#verdict")).includes("混雑（住む人の困りごと）") && (await p.textContent("#kou")).length > 10 && (await p.textContent("#top")).includes("最高点") && await p.locator('#verdict .stars[role="img"][aria-label="星3つ"]').count() === 1);
  await p.click("#showtop"); check("「最高点の組み方を見る」で、置き方の一例の時間割が出る", await p.locator("#topbox .cell.on").count() > 2);
  // 途中で開き直しても置いたカードが残る（続きから）
  await p.click("#next"); await p.waitForSelector("#hand");
  const g2 = await p.evaluate(() => __kw.cur().g); const m2 = g2.must[0], s2 = G.BY[m2].from;
  await p.click(`#hand [data-c="${m2}"]`); await p.click(`[data-put="${s2}"]`);
  await p.reload(); await p.waitForTimeout(150); await p.click("#go-d");
  check("途中で閉じても、置いたカードは続きから残っている", await p.locator(`[data-rm="${m2}"]`).count() === 1 && (await p.textContent("#go-d").catch(() => "")) === "");
  await p.click(`[data-rm="${m2}"]`); check("置いたカードを押すとはずれる", await p.locator(`[data-rm="${m2}"]`).count() === 0);
  await solve(p, { worst: true });
  check("行きたい所だけの旅は★1か★2（最高点から遠い）", await p.locator('#verdict .stars[aria-label="星3つ"]').count() === 0);
  await p.click("#next"); await solve(p); await p.click("#next"); await p.waitForTimeout(150);
  const rec = await p.evaluate((d) => __kw.load().days[d], TODAY);
  check("3組を終えると今日の記録に残る（星と点）", rec && rec.m.length === 3 && rec.m[0] === 0 && rec.m[1] > 0 && rec.s.length === 3, JSON.stringify(rec));
  check("結果：シェアの文に組み方は出さない・色だけで分けない記号", await p.locator(".share").count() === 1 && /🟣/.test(await p.textContent(".share")) && !/蔵の町並み|喜多院/.test(await p.textContent(".share")));
  check("★3に届かなかったお客さんは復習に入る（depth.js）", await p.evaluate(() => Object.keys(JSON.parse(localStorage.getItem("kwd-depth") || "{}").rv || {}).length) >= 1);
  check("見どころ帳に、旅に入れたカードが集まる", await p.evaluate(() => __kw.tally(__kw.load()).kinds) >= 3);
  await p.goto(url + "?lang=ja"); await p.waitForTimeout(150);
  check("ホーム：今日の結果を見るに変わる", (await p.textContent("#go-d")).includes("今日の結果"));

  // とことん：降りると★3の数を自己ベストに
  await p.click("#go-e"); await solve(p); await p.click("#quit"); await p.waitForTimeout(150);
  check("とことん：「ここで降りる」で終わり、★3の数が自己ベストに残る", (await p.textContent("#eres")).includes("1組") && await p.evaluate(() => __kw.load().ebest) === 1 && await p.evaluate(() => __kw.load().runs.e) === null);

  // 保存に失敗したら帯で知らせる
  check("保存に失敗したら、保存できるまで帯（#savewarn）で知らせ続け、保存できたら消す", await p.evaluate(() => { const orig = Storage.prototype.setItem; Storage.prototype.setItem = function () { throw new Error("full"); }; __kw.save(() => {}); __kw.save(() => {}); const one = document.querySelectorAll("#savewarn").length === 1; Storage.prototype.setItem = orig; __kw.save(() => {}); return one && !document.getElementById("savewarn"); }));
  // 壊れた記録でもホームが出る
  await p.evaluate((d) => localStorage.setItem("kwd-v1", JSON.stringify({ v: 1, tut: true, days: { [d]: { m: [9, "x"] } }, hdays: [], adays: {}, dex: { constructor: 1, kura: "3" }, runs: { d: { mode: "d", date: d, list: ["zz|1"], res: [], cur: null, id: "x" }, p: { mode: "p", date: d, list: ["n|x"], res: [], cur: { i: 0, tag: "n|x", place: { kura: 99, tomari: 12, constructor: 1 } }, id: "y" } }, kofi: {}, ach: {}, ebest: { toString: null } })), TODAY);
  await p.reload(); await p.waitForTimeout(150);
  check("記録が壊れていても（形のちがう日・constructor・知らないお客さん・置けない枠）ホームが出て、数に入れない", await p.locator("#go-dex").count() === 1 && (await p.textContent("#go-dex")).includes("1/16") && await p.evaluate(() => JSON.stringify(__kw.load().runs.p.cur.place)) === '{"tomari":12}');
  await p.close();

  // スマホ幅・とても大きい文字・PC幅でもはみ出さない・押す所は44px以上
  { const bad = [], small = [];
    for (const [w, fs, lang] of [[320, 3, "ja"], [390, 2, "en"], [320, 1, "ko"], [1280, 2, "zh"]]) {
      const q = await newPage(w, undefined, "?lang=" + lang); await firstClose(q);
      await q.evaluate((fs) => { const a = JSON.parse(localStorage.getItem("a11y-v1") || "{}"); a.fs = fs; localStorage.setItem("a11y-v1", JSON.stringify(a)); }, fs); await q.reload(); await q.waitForTimeout(150);
      for (const go of [null, "#go-d", "pick", "solve", "#go-cal", "#go-dex", "#go-ach", "#f-about"]) {
        if (go === "pick") { await q.click("#hand .card"); }
        else if (go === "solve") { await q.goto(url + "?lang=" + lang); await q.waitForTimeout(100); await q.click("#go-p"); await q.click(".lv button"); await solve(q); }
        else if (go) { await q.goto(url + "?lang=" + lang); await q.waitForTimeout(100); await q.click(go); }
        await q.waitForTimeout(100);
        const ov = await q.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        if (ov > 0) bad.push(`${w}px 文字${fs} ${lang} ${go || "ホーム"} ${ov}px`);
        small.push(...(await q.$$eval("button:not([disabled]), a[href]", (bs) => bs.filter((b) => b.checkVisibility() && !b.closest(".cal")).filter((b) => Math.round(b.getBoundingClientRect().height) < 44).map((b) => (b.id || b.className || b.textContent).slice(0, 20)))).map((x) => `${w}/${fs}/${go}:${x}`));
      }
      await q.context().close();
    }
    check("幅320px（とても大きい文字）・390px・PC 1280px の4言語で横にはみ出さない", bad.length === 0, bad.join(" / "));
    check("押せる所は高さ44px以上", small.length === 0, [...new Set(small)].slice(0, 8).join(",")); }
  // PC では手札と時間割が横に並ぶ・スマホでは点の帯が下に残る
  { const q = await newPage(1280); await firstClose(q); await q.click("#go-p"); await q.click(".lv button"); await q.waitForSelector("#hand");
    const side = await q.evaluate(() => { const a = document.querySelector("#hand").getBoundingClientRect(), b = document.querySelector("#tt").getBoundingClientRect(); return b.left > a.right - 1; });
    await q.setViewportSize({ width: 390, height: 700 }); await q.waitForTimeout(100);
    const sticky = await q.evaluate(() => { scrollTo(0, document.querySelector("#tt").getBoundingClientRect().top + scrollY + 200); const r = document.querySelector("#decide").getBoundingClientRect(); return r.bottom <= innerHeight + 1 && r.top > 0; });
    check("PC では手札と時間割が横に並び、スマホでは時間割を見ながら点と「この旅で決める」が下に出たまま", side && sticky, `${side} ${sticky}`); await q.context().close(); }
  // キーボードだけで遊べる
  { const q = await newPage(); await firstClose(q);
    await q.focus("#go-p"); await q.keyboard.press("Enter"); await q.waitForTimeout(80); await q.focus(".lv button"); await q.keyboard.press("Enter"); await q.waitForSelector("#hand");
    const m = await q.evaluate(() => __kw.cur().g.must[0]); const at = G.BY[m].from;
    await q.focus(`#hand [data-c="${m}"]`); await q.keyboard.press("Enter"); await q.waitForTimeout(80);
    const moved = await q.evaluate(() => !!document.activeElement && document.activeElement.hasAttribute("data-put"));
    await q.focus(`[data-put="${at}"]`); await q.keyboard.press("Enter"); await q.waitForTimeout(80);
    await q.focus("#decide"); await q.keyboard.press("Enter"); await q.waitForTimeout(100);
    check("キーボードだけでカードを選び、置いて、決められる（選ぶと置ける時間へフォーカスが動く）", moved && await q.locator("#verdict").count() === 1);
    await q.context().close(); }
  // 見やすさの設定を全部入れても、ページの一番下まで動ける
  { const ctx = await browser.newContext({ viewport: { width: 390, height: 700 } });
    await ctx.addInitScript(() => localStorage.setItem("a11y-v1", JSON.stringify({ read: true, cvd: true, calm: true, say: true, ruby: true })));
    const q = await newPage(390, ctx); await firstClose(q);
    const r = await q.evaluate(() => { window.scrollTo(0, 1e5); const f = document.querySelector("footer").getBoundingClientRect(); return [scrollY, Math.round(f.bottom), innerHeight, getComputedStyle(document.documentElement).position]; });
    check("見やすさの設定を全部入れても、いちばん下まで動ける", r[0] > 0 && r[1] <= r[2] && r[3] === "static", r.join(","));
    await ctx.close(); }
  // 引き継ぎコード
  { const sample = { "kwd-v1": JSON.stringify({ v: 1, tut: true, days: { "2026-11-28": { m: [0, 1, 0], s: [90, 80, 88] } }, hdays: {}, adays: {}, dex: { kura: 2, kitain: 1, tomari: 1 }, runs: {}, kofi: {}, ach: {}, ebest: 3, plans: 4, t: 1 }), "kwd-fs": "3", "kwd-lang": "en", "kwd-depth": JSON.stringify({ v: 1, rv: { "n|x1": { s: 1, due: "2026-11-30", t: 5 } } }) };
    await checkTransfer({ browser, url: url + "?lang=ja", game: "kawagoe-1day", sample, check, open: async (pg) => { await firstClose(pg); } }); }
} catch (e) { check("ブラウザでの検査が最後まで動く", false, e.stack.split("\n").slice(0, 3).join(" ")); }
await browser.close();
server.close();
check("画面のエラーが無い", errors.length === 0, errors.slice(0, 3).join(" | "));
{ const e = await checkDepth(readFileSync(path.join(root, "depth.js"), "utf8")); check("depth.js（復習）の動き（shared-workflows template/qa/depth-check.mjs）", e.length === 0, e.join(" / ")); }
{ // 見やすさ・読みやすさ・偏り（shared-workflows template/qa/a11y.mjs の写し）
  const { spawnSync } = await import("node:child_process");
  const a = spawnSync(process.execPath, [path.join(root, "qa", "a11y.mjs")], { encoding: "utf8", env: process.env });
  check("見やすさ・読みやすさの検査（qa/a11y.mjs。中身は qa-report/a11y.md）", a.status === 0, (a.stdout.match(/^- ❌.*$/gm) || []).join(" / ") || (a.status ? a.stderr.slice(-300) : ""));
}

const ng = results.filter((r) => !r.ok);
const md = `# 川越1日プランナー QA\n\n${results.map((r) => `- ${r.ok ? "✅" : "❌"} ${r.name}${r.detail ? `（${r.detail}）` : ""}`).join("\n")}\n\n${ng.length ? `❌ ${ng.length}件` : `✅ ${results.length}項目すべて通過`}\n`;
mkdirSync(path.join(root, "qa-report"), { recursive: true });
writeFileSync(path.join(root, "qa-report/report.md"), md);
console.log(md);
process.exit(ng.length ? 1 : 0);
