// funwari_forecast.js
// ------------------------------------
// - 朝7時・昼12時・夜19時・深夜0時（24時）から各2時間枠だけ投稿
// - 日本時間で判定
// - Gemini APIでふんわり予報生成
// - Jekyllブログ用markdown(_posts)に保存
// - Xシェア用リンク付き
// ------------------------------------

const allowedHours = [0, 7, 12, 19];  // 各枠で2時間OK
const nowJST = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Tokyo' }));
const currentHour = nowJST.getHours();
const currentMinute = nowJST.getMinutes();

// 「2時間枠」許可ロジック：例 7時→7,8時OK
const extendedAllowedHours = allowedHours.map(h => [h, (h+1)%24]).flat();

if (!extendedAllowedHours.includes(currentHour)) {
  console.log(`🕒 現在 ${currentHour} 時（JST）。投稿対象外のためスキップします。`);
  process.exit(0);
}

const axios = require("axios");
const fs = require("fs");
const path = require("path");
const Parser = require('rss-parser');

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

if (!GEMINI_API_KEY) {
  console.error("❌ GEMINI_API_KEY が設定されていません。");
  process.exit(1);
}

// --- 設定項目 ---
const RSS_FEED_URLS = [
  "https://news.yahoo.co.jp/rss/topics/top-picks.xml",
  "https://www.itmedia.co.jp/rss/index.rdf",
  "https://assets.wor.jp/rss/rdf/nikkei/news.rdf",
  "https://assets.wor.jp/rss/rdf/minkabufx/statement.rdf",
];
const SITE_BASE_URL = "https://kg-ninja.github.io/Funwariyoso";
const BMAC_LINK = "https://www.buymeacoffee.com/kgninja";
// --- 設定項目ここまで ---

const parser = new Parser({ timeout: 5000 });

async function fetchRecentArticleTitles(feedUrls, maxTitlesPerFeed = 3) {
  let allTitles = [];
  for (const url of feedUrls) {
    try {
      const feed = await parser.parseURL(url);
      if (feed.items) {
        const titles = feed.items.slice(0, maxTitlesPerFeed).map(item => item.title);
        allTitles = allTitles.concat(titles);
      }
    } catch (error) {
      console.warn(`⚠️ RSS取得失敗: ${url} - ${error.message}`);
    }
  }
  return allTitles.filter(title => title && title.trim() !== "");
}

async function main() {
  const recentTitles = await fetchRecentArticleTitles(RSS_FEED_URLS);
  if (recentTitles.length === 0) {
    console.warn("⚠️ RSSが空でした。スキップします。");
    return;
  }

  const titlesString = recentTitles.join("\n- ");
  const prompt = `
以下の現在のニュース記事のタイトル一覧を参考に、Yoneda 的分布仮説メタファーをふんわり入れた文章にして。
【メタファーの種】  
どんな文脈 X に対しても Hom(A,X) ≅ Hom(B,X) となるなら A ≅ B という
Yoneda 補題の考え方は、「どんなニュース（文脈）でも同じ一貫したメッセージを
発信する主体は、本質的に同じ」という分布仮説と似ています。

そして、その雰囲気に基づいた「現在のふんわり動向予報」を一言（30～50文字程度）で生成してください。
深刻な内容、断定的な表現、政治的・宗教的に偏った内容は避けてください。予報の最後には"#KGNINJA"という署名を必ず入れてください。

最近のニュースタイトル：
- ${titlesString}

現在のふんわり動向予報：
`;

  const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${GEMINI_API_KEY}`;
  let displayForecast = "現在のふんわり予報は、星の電波が届きませんでした。また次回！";

  try {
    const res = await axios.post(apiUrl, { contents: [{ parts: [{ text: prompt }] }] });
    const parts = res?.data?.candidates?.[0]?.content?.parts;
    if (parts?.[0]?.text) {
      displayForecast = parts[0].text.trim();
    }
  } catch (error) {
    console.error("❌ Gemini APIエラー:", error.response?.data || error.message);
  }

  // JSTでタイムスタンプ・ファイル名生成
  const year  = nowJST.getFullYear();
  const month = String(nowJST.getMonth() + 1).padStart(2, '0');
  const day   = String(nowJST.getDate()).padStart(2, '0');
  const hour  = String(nowJST.getHours()).padStart(2, '0');
  const min   = String(nowJST.getMinutes()).padStart(2, '0');
  const timestamp = `${hour}:${min}`;
  const postFilename = `${year}-${month}-${day}-${hour}-${min}-funwari-forecast.md`;
  const postPath      = `/${year}/${month}/${day}/${hour}${min}-funwari-forecast.html`;
  const postPermalink = `${SITE_BASE_URL}${postPath}`;
  const mdTitle = `現在のふんわり動向予報 ${year}-${month}-${day} ${timestamp}`;

  // X(Twitter)シェア用
  let tweetTextContent = displayForecast.split('。')[0] + '。';
  if (tweetTextContent.length > 100) {
    tweetTextContent = tweetTextContent.substring(0, 97) + "...";
  }
  const tweetText = `現在のふんわり予報: 「${tweetTextContent}」#KGNINJA 続きはブログで！👇`;
  const dynamicTwitterShareUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(tweetText)}&url=${encodeURIComponent("https://kg-ninja.github.io/Funwariyoso/")}`;

  // Jekyll用: ISO文字列も日本時間で
  const isoDate = nowJST.toISOString();

  const md = `---
title: "${mdTitle}"
date: "${isoDate}"
tags: [ふんわり予報, AI占い, 日常]
layout: post
---

${displayForecast}

<br>
*この予報はAIが生成したエンターテイメントです。内容の正確性を保証するものではありません。ふんわり一日に４回更新されます。みんなにふんわり拡散希望です。*

---
${BMAC_LINK ? `☕️ [Buy Me a Coffee](${BMAC_LINK})\n` : ''}
🐦 [現在の予報をXでシェア](${dynamicTwitterShareUrl})
`;

  const outDir = path.join(process.cwd(), "_posts");
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, postFilename), md);

  console.log("✅ ふんわり予報を保存しました:", postFilename);
}

main().catch(err => {
  console.error("❌ スクリプト全体でエラー:", err);
  process.exit(1);
});
