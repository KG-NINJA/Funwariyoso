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
以下の現在のニュース記事のタイトル一覧を参考に、世の中の深淵をあなたの全能力を駆使して深読みしてください。
そして、その雰囲気に基づいた「現在のふんわり動向予報」を一言（30～60文字程度）で生成してください。
深刻な内容、断定的な表現、政治的・宗教的に偏った内容は避けてください。争うのが馬鹿らしく思えるユーモアで「慈愛」をふんわり表現して。予報の最後には"#KG-NINJA"という署名を必ず入れてください。

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

  const now = new Date();
  const [year, month, day] = now.toISOString().split('T')[0].split('-');
  const hour = String(now.getHours()).padStart(2, '0');
  const min = String(now.getMinutes()).padStart(2, '0');
  const timestamp = `${hour}:${min}`;

  const postFilename = `${year}-${month}-${day}-${hour}-${min}-funwari-forecast.md`;
  const postPath      = `/${year}/${month}/${day}/${hour}${min}-funwari-forecast.html`;
  const postPermalink = `${SITE_BASE_URL}${postPath}`;
　const mdTitle = `現在のふんわり動向予報 ${year}-${month}-${day}`;

  let tweetTextContent = displayForecast.split('。')[0] + '。';
  if (tweetTextContent.length > 100) {
    tweetTextContent = tweetTextContent.substring(0, 97) + "...";
  }
  const tweetText = `現在のふんわり予報: 「${tweetTextContent}」#KGNINJA 続きはブログで！👇`;
  const dynamicTwitterShareUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(tweetText)}&url=${encodeURIComponent("https://kg-ninja.github.io/Funwariyoso/")}`;

// 追加：ISO文字列で日時を取得（日本時間として扱われるよう Jekyll 側で自動調整されます）
const isoDate = new Date().toISOString();

const md = `---
title: "${mdTitle}"
date: "${isoDate}"
tags: [ふんわり予報, AI占い, 日常]
layout: post
---


${displayForecast}

<br>
*この予報はAIが生成したエンターテイメントです。内容の正確性を保証するものではありません。ふんわり３０分おきに更新されます。みんなにふんわり拡散希望です。*
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
