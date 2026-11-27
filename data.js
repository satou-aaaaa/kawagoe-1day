// 川越1日プランナー：時間割・カード・点のつけ方・お客さんの作り方（index.html と qa/run.mjs が読む）
// 数字の出典は川越市の資料の2つだけ（観光客 約736万人・日帰り 93.8%）。カードのお金・混み方は遊びのための目安で、本当の値段・人の数ではない。
(function (root) {
  "use strict";
  const LANGS = ["ja", "en", "zh", "ko"];

  // ---- 時間割：朝9時〜20時は1時間ずつ、21時〜翌朝7時は「泊まり」の1枠、翌朝7時・8時 ----
  const SLOTS = [9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, "n", "m7", "m8"];
  const LEN = [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 10, 1, 1]; // 枠ごとの時間（合わせて24時間）
  const NIGHT = 12;
  // 中心の通りの混み方の目安（昼ほど混む。夕方から下がり、夜と朝は少ない）。遊びの決まりで、人の数を測ったものではない
  const CROWD = [1, 2, 3, 4, 5, 5, 4, 3, 2, 1, 0, 0, 0, 0, 0];

  // ---- カード：[id, 場所 c=中心の通り o=中心の外 s=泊まり, 種類, 枠の数, お金の目安, 置ける最初の枠, 最後の枠, 絵] ----
  const RAW = [
    ["kura", "c", "see", 1, 2, 0, 8, "🏘️"],
    ["kashiya", "c", "see", 1, 2, 1, 7, "🍬"],
    ["kane", "c", "see", 1, 0, 0, 8, "🔔"],
    ["kitain", "o", "see", 1, 1, 0, 7, "🍁"],
    ["senba", "o", "see", 1, 0, 0, 8, "💧"],
    ["yakata", "o", "see", 2, 0, 0, 7, "🌳"],
    ["yugure", "c", "night", 1, 1, 9, 9, "🌇"],
    ["hiru", "c", "food", 1, 3, 2, 5, "🍱"],
    ["hiru2", "o", "food", 1, 3, 2, 5, "🍜"],
    ["cafe", "c", "food", 1, 2, 0, 9, "🍵"],
    ["taiken", "o", "exp", 2, 4, 1, 6, "🧵"],
    ["omiyage", "c", "shop", 1, 3, 1, 8, "🎁"],
    ["yuhan", "c", "food", 1, 4, 9, 11, "🍽️"],
    ["tomari", "s", "stay", 1, 8, 12, 12, "🛏️"],
    ["asa", "c", "morning", 1, 0, 13, 14, "🌅"],
    ["asagohan", "c", "food", 1, 2, 13, 14, "🥢"],
  ];
  // 名前と一言（日本語のほかは AI の訳で、まだ人が確かめていない）。見どころの一言は川越市「川越百景」などに書いてあることだけ
  const TXT = {
    kura: { ja: ["蔵の町並み", "蔵造りの商家が並ぶ、川越を代表する通り。"], en: ["Kura warehouse street", "The street of old clay-walled merchant houses that symbolizes Kawagoe."], zh: ["藏造老街", "仓库式商家林立，是川越的代表街道。"], ko: ["구라 거리", "흙벽 창고식 상가가 늘어선 가와고에의 대표 거리."] },
    kashiya: { ja: ["菓子屋横丁", "昔なつかしい駄菓子屋が並ぶ通り。"], en: ["Kashiya Yokocho (Candy Alley)", "A lane of old-fashioned candy shops."], zh: ["点心横丁", "怀旧零食店林立的小巷。"], ko: ["과자 골목", "옛날 과자 가게가 늘어선 골목."] },
    kane: { ja: ["時の鐘のあたり", "川越のシンボルの鐘つき堂。"], en: ["Around Toki no Kane", "The bell tower, a symbol of Kawagoe."], zh: ["时之钟一带", "川越的象征——钟楼。"], ko: ["도키노카네 주변", "가와고에의 상징인 종루."] },
    kitain: { ja: ["喜多院", "五百羅漢があり、文化財が多いお寺。"], en: ["Kita-in Temple", "A temple with many cultural treasures and the Gohyaku Rakan statues."], zh: ["喜多院", "有五百罗汉、文物众多的寺院。"], ko: ["기타인", "오백나한이 있고 문화재가 많은 절."] },
    senba: { ja: ["仙波河岸史跡公園", "河岸場の跡の公園。湧き水がある静かな所。"], en: ["Senba Kashi Historic Park", "A quiet park on an old riverside landing, with spring water."], zh: ["仙波河岸史迹公园", "河岸码头遗址公园，有涌泉，很安静。"], ko: ["센바 가시 사적공원", "옛 나루터 자리의 조용한 공원. 샘물이 있다."] },
    yakata: { ja: ["河越館跡史跡公園", "武士の河越氏の館の跡（国の史跡）。少し遠い。"], en: ["Kawagoe-yakata Ruins Park", "Site of the samurai Kawagoe clan's residence (national historic site). A bit far."], zh: ["河越馆迹史迹公园", "武士河越氏宅邸遗址（国家史迹），稍远。"], ko: ["가와고에 관터 사적공원", "무사 가와고에 씨의 저택 터(국가 사적). 조금 멀다."] },
    yugure: { ja: ["18時の鐘の夕暮れ蔵さんぽ", "夕方6時の鐘を聞きながら、すいた蔵の町を歩く。"], en: ["Dusk walk at the 6 p.m. bell", "Walk the quiet kura streets as the evening bell rings."], zh: ["18点钟声·黄昏藏街散步", "听着傍晚6点的钟声，漫步人少的藏街。"], ko: ["18시 종소리 해 질 녘 산책", "저녁 6시 종소리를 들으며 한산한 구라 거리를 걷는다."] },
    hiru: { ja: ["一番街でお昼", "中心の通りでお昼ごはん。"], en: ["Lunch on the main street", "Lunch in the busy center."], zh: ["在一番街吃午饭", "在中心街道吃午饭。"], ko: ["이치반가이에서 점심", "중심 거리에서 점심."] },
    hiru2: { ja: ["中心の外でお昼", "少し歩いた先のお店でお昼ごはん。"], en: ["Lunch outside the center", "Lunch at a place a short walk away."], zh: ["在中心外吃午饭", "走远一点的店里吃午饭。"], ko: ["중심 밖에서 점심", "조금 걸어간 가게에서 점심."] },
    cafe: { ja: ["蔵のカフェで一服", "ひと休み。"], en: ["Break at a kura café", "Take a rest."], zh: ["在藏造咖啡馆歇脚", "休息一下。"], ko: ["창고 카페에서 휴식", "잠깐 쉬기."] },
    taiken: { ja: ["手しごと体験", "中心の外の工房で、ものづくりを体験。"], en: ["Craft workshop", "Try making something at a workshop outside the center."], zh: ["手工体验", "在中心外的工坊体验手工。"], ko: ["공예 체험", "중심 밖 공방에서 만들기 체험."] },
    omiyage: { ja: ["おみやげ選び", "中心の通りで買いもの。"], en: ["Souvenir shopping", "Shopping on the main street."], zh: ["挑选伴手礼", "在中心街道购物。"], ko: ["기념품 고르기", "중심 거리에서 쇼핑."] },
    yuhan: { ja: ["夕ごはん", "町のお店で夕ごはん。"], en: ["Dinner", "Dinner at a local restaurant."], zh: ["晚饭", "在街上的店里吃晚饭。"], ko: ["저녁 식사", "동네 가게에서 저녁."] },
    tomari: { ja: ["泊まり", "川越に泊まる。"], en: ["Stay overnight", "Stay the night in Kawagoe."], zh: ["住宿", "在川越住一晚。"], ko: ["숙박", "가와고에에서 하룻밤."] },
    asa: { ja: ["朝さんぽ", "人の少ない朝の一番街を歩く。"], en: ["Morning walk", "Stroll the main street before the crowds."], zh: ["早晨散步", "在人少的早晨走走一番街。"], ko: ["아침 산책", "사람이 적은 아침 거리를 걷는다."] },
    asagohan: { ja: ["朝ごはん", "町のお店で朝ごはん。"], en: ["Breakfast", "Breakfast in town."], zh: ["早饭", "在街上吃早饭。"], ko: ["아침 식사", "동네에서 아침."] },
  };
  const CARDS = RAW.map(([id, area, kind, dur, cost, from, to, ic]) => ({ id, area, kind, dur, cost, from, to, ic, t: TXT[id] }));
  const BY = {}; for (const c of CARDS) BY[c.id] = c;
  const name = (id, l) => (BY[id].t[l] || BY[id].t.ja)[0];
  const desc = (id, l) => (BY[id].t[l] || BY[id].t.ja)[1];

  // ---- 出典（数字は S1・S2 の2つだけ）----
  const SRC = {
    s1: ["川越市「令和6年 川越市入込観光客数」", "https://www.city.kawagoe.saitama.jp/_res/projects/default_project/_page_/001/011/628/r6matome.pdf"],
    s2: ["川越市「観光アンケート調査報告書（2020年）」", "https://www.city.kawagoe.saitama.jp/_res/projects/default_project/_page_/001/011/627/r2.pdf"],
    s3: ["川越市「川越百景」", "https://www.city.kawagoe.saitama.jp/_res/projects/default_project/_page_/001/010/680/hyakkeilist.pdf"],
    s4: ["川越市「史跡河越館跡保存活用計画（案）概要版」", "https://www.city.kawagoe.saitama.jp/_res/projects/default_project/_page_/001/019/155/kawagoeyakata_keikaku_gaiyou.pdf"],
    s5: ["川越市の広報（時の鐘）", "https://www.city.kawagoe.saitama.jp/_res/projects/default_project/_page_/001/010/105/1244p20.pdf"],
  };
  const FACTS = { visitors: "約736万人", visitorsYear: 2024, dayTrip: "93.8%", dayTripYear: "令和2年" };

  // ---- 置き方を確かめる：place は { カードid: 最初の枠 } ----
  function fits(id, s) { const c = BY[id]; return !!c && Number.isInteger(s) && s >= c.from && s <= c.to && s + c.dur <= SLOTS.length && !(c.dur > 1 && s < NIGHT && s + c.dur > NIGHT); }
  function cells(place) { const o = new Array(SLOTS.length).fill(null); for (const id in place) { const s = place[id]; if (!fits(id, s)) continue; for (let i = s; i < s + BY[id].dur; i++) o[i] = id; } return o; }
  function canPut(place, id, s) { if (!fits(id, s)) return false; for (const k in place) { if (k === id || !BY[k]) continue; const a = place[k], b = a + BY[k].dur; if (s < b && a < s + BY[id].dur) return false; } return true; }

  // ---- 点：町にいた時間・使ったお金の目安・混雑（住む人の困りごと。少ないほど高い点）----
  const MONEY_FULL = 22;
  function parts(place) {
    let f = 99, last = -1, cost = 0, load = 0, out = 0, n = 0;
    for (const id in place) {
      const s = place[id]; if (!fits(id, s)) continue; const c = BY[id]; n++;
      f = Math.min(f, s); last = Math.max(last, s + c.dur - 1); cost += c.cost;
      if (c.area === "c") for (let i = s; i < s + c.dur; i++) load += CROWD[i];
      if (c.area === "o") out++;
    }
    if (!n) return { hours: 0, cost: 0, load: 0, out: 0, n: 0, first: -1, last: -1 };
    let hours = 0; for (let i = f; i <= last; i++) hours += LEN[i];
    return { hours, cost, load, out, n, first: f, last };
  }
  function scoreOf(p) {
    if (!p.n) return { time: 0, money: 0, crowd: 0, total: 0 };
    const time = Math.round((100 * p.hours) / 24);
    const money = Math.min(100, Math.round((p.cost * 100) / MONEY_FULL));
    const crowd = Math.max(0, Math.min(100, 100 - p.load * 4 + 8 * Math.min(p.out, 2)));
    return { time, money, crowd, total: Math.round((time + money + crowd) / 3) };
  }
  const score = (place) => scoreOf(parts(place));

  // ---- いちばん高い点（同じ手札で）：枠を前から埋める動的計画法。最初の枠・最後の枠・使ったカードごとに、混み方の最小を持つ ----
  const bestCache = new Map();
  function best(hand, must) {
    const key = hand.join(",") + "/" + must.join(",");
    if (bestCache.has(key)) return bestCache.get(key);
    const H = hand.map((id) => BY[id]), n = H.length, M = 1 << n, S = SLOTS.length + 1;
    const mm = must.reduce((a, m) => a | (1 << hand.indexOf(m)), 0);
    const ld = H.map((c) => SLOTS.map((_, s) => { let v = 0; if (c.area === "c") for (let i = s; i < s + c.dur && i < SLOTS.length; i++) v += CROWD[i]; return v; }));
    const INF = 1e9, dp = new Float64Array(S * M * S).fill(INF), from = new Float64Array(S * M * S).fill(-1);
    const ix = (s, m, F) => (s * M + m) * S + F;
    for (let i = 0; i < n; i++) for (let t = H[i].from; t <= H[i].to; t++) { if (!fits(H[i].id, t)) continue; const k = ix(t + H[i].dur, 1 << i, t); if (ld[i][t] < dp[k]) { dp[k] = ld[i][t]; from[k] = -2 - (i * 64 + t); } }
    let top = { total: -1 };
    for (let s = 1; s < S; s++) for (let m = 1; m < M; m++) for (let F = 0; F < S - 1; F++) {
      const k0 = ix(s, m, F), v = dp[k0]; if (v >= INF) continue;
      if ((m & mm) === mm) {
        let cost = 0, out = 0; for (let i = 0; i < n; i++) if ((m >> i) & 1) { cost += H[i].cost; if (H[i].area === "o") out++; }
        let hours = 0; for (let i = F; i < s; i++) hours += LEN[i];
        const sc = scoreOf({ hours, cost, load: v, out, n: 1 });
        if (sc.total > top.total) top = { ...sc, k: k0 };
      }
      for (let i = 0; i < n; i++) { if ((m >> i) & 1) continue; for (let t = Math.max(H[i].from, s); t <= H[i].to; t++) { if (!fits(H[i].id, t)) continue; const k = ix(t + H[i].dur, m | (1 << i), F), nv = v + ld[i][t]; if (nv < dp[k]) { dp[k] = nv; from[k] = k0 * 1024 + i * 64 + t; } } }
    }
    // 道すじを戻して、置き方の一例を作る
    const place = {}; let k = top.k;
    while (k !== undefined && k >= 0) { const f = from[k]; if (f <= -2) { const x = -2 - f; place[hand[Math.floor(x / 64)]] = x % 64; break; } const x = f % 1024; place[hand[Math.floor(x / 64)]] = x % 64; k = Math.floor(f / 1024); }
    const r = { total: top.total, time: top.time, money: top.money, crowd: top.crowd, place };
    bestCache.set(key, r);
    return r;
  }

  // ---- 星：その手札でいちばん高い点に、どれだけ近いか ----
  const starsOf = (total, top) => (total >= top - 4 ? 3 : total >= top - 14 ? 2 : 1);

  // ---- ひとことの講評（いちばん低い点と、入れていないものから）----
  function review(place) {
    const p = parts(place), sc = scoreOf(p), ids = Object.keys(place).filter((id) => fits(id, place[id]));
    const has = (f) => ids.some((id) => f(BY[id]));
    const notes = [];
    if (!has((c) => c.id === "tomari")) notes.push("stay");
    if (!cells(place).some((id, i) => id && i >= 9 && i < NIGHT && id !== "tomari")) notes.push("night"); // 18〜20時に置いたものだけを夜に数える
    if (!has((c) => c.area === "o")) notes.push("outer");
    if (p.load >= 12) notes.push("noon");
    if (!has((c) => c.from >= 13)) notes.push("morning");
    if (!notes.length) notes.push(sc.total >= 85 ? "great" : "good");
    return { key: notes[0], all: notes };
  }

  // ---- お客さん（今日のお題）：だれでも同じ日付の種。手札は8枚（泊まりは必ず入る）、行きたい所1つ。上級は7枚・行きたい所2つ ----
  // part:seedOf:begin（shared-workflows の template/parts/data/seedOf.js の写し。ここでは直さない。node scripts/sync-template.mjs で写す）
  function seedOf(str) { let h = 2166136261; for (const ch of String(str)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }
  // part:seedOf:end
  // part:rng:begin（shared-workflows の template/parts/data/rng.js の写し。ここでは直さない。node scripts/sync-template.mjs で写す）
  function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  // part:rng:end
  // part:ri:begin（shared-workflows の template/parts/data/ri.js の写し。ここでは直さない。node scripts/sync-template.mjs で写す）
  const ri = (R, a, b) => a + Math.floor(R() * (b - a + 1));
  // part:ri:end
  // part:shuffle:begin（shared-workflows の template/parts/data/shuffle.js の写し。ここでは直さない。node scripts/sync-template.mjs で写す）
  function shuffle(R, a) { const b = a.slice(); for (let i = b.length - 1; i > 0; i--) { const j = ri(R, 0, i); [b[i], b[j]] = [b[j], b[i]]; } return b; }
  // part:shuffle:end
  // part:pickN:begin（shared-workflows の template/parts/data/pickN.js の写し。ここでは直さない。node scripts/sync-template.mjs で写す）
  function pickN(R, a, n) { return shuffle(R, a).slice(0, n); }
  // part:pickN:end

  const WHO = ["first", "pair", "family", "solo", "friends", "abroad", "again", "slow"];
  const WISH = ["kura", "kashiya", "kane", "kitain", "hiru", "omiyage"]; // 行きたい所（中心の通りが多い）
  const OTHERS = CARDS.map((c) => c.id).filter((id) => id !== "tomari");
  const guestCache = new Map();
  // tag は「n|種」（ふつう）か「h|種」（上級）
  function guest(tag) {
    if (guestCache.has(tag)) return guestCache.get(tag);
    const [lv, seed] = String(tag).split("|"), hard = lv === "h", R = rng(seedOf(tag));
    const who = WHO[ri(R, 0, WHO.length - 1)];
    const must = hard ? pickN(R, WISH, 2) : pickN(R, WISH, 1);
    const rest = pickN(R, OTHERS.filter((id) => !must.includes(id)), (hard ? 7 : 8) - 1 - must.length);
    const order = new Map(CARDS.map((c, i) => [c.id, i]));
    const hand = [...must, ...rest, "tomari"].sort((a, b) => order.get(a) - order.get(b));
    const g = { tag, lv: hard ? 1 : 0, who, must, hand, seed };
    guestCache.set(tag, g);
    return g;
  }
  const keyOf = (g) => g.lv + ":" + g.must.join(",") + "/" + g.hand.join(",");
  const validTag = (t) => typeof t === "string" && /^[nh]\|[\w:.\-]{1,40}$/.test(t);

  // 今日のお題：ふつう2人と上級1人。上級：上級2人（今日のお題とは別の種）
  const dailyTags = (d) => [`n|d${d}:0`, `n|d${d}:1`, `h|d${d}:2`];
  const hardTags = (d) => [`h|h${d}:0`, `h|h${d}:1`];

  const api = { LANGS, SLOTS, LEN, NIGHT, CROWD, CARDS, BY, name, desc, SRC, FACTS, WHO, fits, cells, canPut, parts, scoreOf, score, best, starsOf, review, guest, keyOf, validTag, dailyTags, hardTags, MONEY_FULL };
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.KWD = api;
})(typeof window !== "undefined" ? window : globalThis);
