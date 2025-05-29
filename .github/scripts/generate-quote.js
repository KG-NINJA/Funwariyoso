const axios = require("axios");
const fs = require("fs");
const path = require("path");
const Parser = require('rss-parser'); // rss-parser をインポート

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

if (!GEMINI_API_KEY) {
  console.error("❌ GEMINI_API_KEY が設定されていません。");
  process.exit(1);
}

// --- 設定項目 ---
// 解析するRSSフィードのURLリスト（例としていくつか記載。実際のものに置き換えてください）
const RSS_FEED_URLS = [
  "https://news.yahoo.co.jp/rss/topics/top-picks.xml", // Yahoo!ニュース 主要トピックス
  "https://www.itmedia.co.jp/rss/index.rdf",          // ITmedia総合
  "https://assets.wor.jp/rss/rdf/nikkei/news.rdf",  //日経新聞速報
   "https://assets.wor.jp/rss/rdf/minkabufx/statement.rdf", //みんかぶ FX/為替の要人発言
  // 他にも気になるニュースサイトやブログのRSSフィードを追加できます
];

const SITE_BASE_URL = "https://kg-ninja.github.io/Funwariyoso"; // あなたの新しいブログのURL
const BMAC_LINK = "https://www.buymeacoffee.com/kgninja"; // Buy Me a Coffeeのリンク（必要なら）
// --- 設定項目ここまで ---

const parser = new Parser({
    timeout: 5000 // タイムアウトを5秒に設定
});

// RSSフィードから記事タイトルを取得する関数
async function fetchRecentArticleTitles(feedUrls, maxTitlesPerFeed = 3) {
  let allTitles = [];
  console.log("📰 RSSフィードから記事タイトルを取得開始...");
  for (const url of feedUrls) {
    try {
      console.log(`  - ${url} を取得中...`);
      const feed = await parser.parseURL(url);
      if (feed.items) {
        const titles = feed.items.slice(0, maxTitlesPerFeed).map(item => item.title);
        allTitles = allTitles.concat(titles);
        console.log(`    ${titles.length}件のタイトルを取得: ${titles.join(', ')}`);
      }
    } catch (error) {
      console.warn(`  ⚠️ RSSフィード (${url}) の取得に失敗しました: ${error.message}`);
    }
  }
  console.log(`📰 合計 ${allTitles.length}件のタイトルを取得完了。`);
  return allTitles.filter(title => title && title.trim() !== ""); // 空のタイトルを除外
}

async function main() {
  // 1. RSSフィードから最近の記事タイトルを取得
  const recentTitles = await fetchRecentArticleTitles(RSS_FEED_URLS);

  if (recentTitles.length === 0) {
    console.warn("⚠️ RSSから取得できる記事タイトルがありませんでした。予報は生成されません。");
    return; // RSSから情報が取れなければ予報は出さない
  }

  // 2. Gemini APIに投げるプロンプトを組み立てる
  const titlesString = recentTitles.join("\n- ");
  const prompt = `
以下の最近のニュース記事のタイトル一覧を参考に、世の中の深淵をあなたの全能力を駆使して深読みしてください。
そして、その雰囲気に基づいた「明日のふんわり動向予報」を一言（30～60文字程度）で生成してください。
深刻な内容、断定的な表現、政治的・宗教的に偏った内容は避けてください。争うのが馬鹿らしく思えるユーモアで「慈愛」をふんわり表現して。予報の最後には「明日のラッキーアイテム：〇〇」のような一文を添えてください。

最近のニュースタイトル：
- ${titlesString}

明日のふんわり動向予報：
`;

  console.log("🤖 Gemini APIに送信するプロンプト:\n", prompt);

  const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${GEMINI_API_KEY}`;

  // 3. Gemini APIで「ふんわり予報」を生成
  let displayForecast = "今日のふんわり予報は、星の電波が届きませんでした。また明日！"; // デフォルトメッセージ

  try {
    const res = await axios.post(apiUrl, {
      contents: [{ parts: [{ text: prompt }] }]
    });

    if (res.data.candidates && res.data.candidates[0] && res.data.candidates[0].content && res.data.candidates[0].content.parts && res.data.candidates[0].content.parts[0]) {
      displayForecast = res.data.candidates[0].content.parts[0].text.trim();
    } else {
      console.warn("⚠️ Gemini APIからの予報の取得に失敗しました。レスポンス構造が予期せぬ形です。");
      console.warn("API Response:", JSON.stringify(res.data, null, 2));
    }
  } catch (error) {
    console.error("❌ Gemini APIリクエストでエラーが発生しました。");
    if (error.response) {
      console.error("ステータスコード:", error.response.status);
      console.error("APIからのエラー詳細:", JSON.stringify(error.response.data, null, 2));
    } else if (error.request) {
      console.error("APIサーバーからの応答がありませんでした。");
    } else {
      console.error("リクエスト設定時のエラー:", error.message);
    }
    // APIエラー時もデフォルトメッセージが使われる
  }
  
  console.log("🔮 生成されたふんわり予報:\n", displayForecast);

  // 4. Markdownファイルを生成
  const today = new Date().toISOString().split("T")[0];
  const mdTitle = `明日のふんわり動向予報 ${today}`;

  // ツイート用のテキスト（予報の最初の部分など、短めに）
  let tweetTextContent = displayForecast.split('。')[0] + '。'; // 最初の句点までを取得
  if (tweetTextContent.length > 100) { // 長すぎる場合は短縮
      tweetTextContent = tweetTextContent.substring(0, 97) + "...";
  }
  const tweetText = `明日のふんわり予報: 「${tweetTextContent}」続きはブログで！ 👇`;
  
  const [year, month, day] = today.split('-');
  const postFilename = `${year}-${month}-${day}-funwari-forecast.md`;
  const postPath = `/${year}/${month}/${day}/funwari-forecast.html`;
  const postPermalink = `${SITE_BASE_URL}${postPath}`;
  
  const encodedTweetText = encodeURIComponent(tweetText);
  const encodedPostPermalink = encodeURIComponent(postPermalink);
  // ▼▼▼ 動的なTwitter共有URLをここで直接生成 ▼▼▼
  const dynamicTwitterShareUrl = `https://twitter.com/intent/tweet?text=${encodedTweetText}&url=${encodedPostPermalink}`;

  const md = `---
title: "${mdTitle}"
date: ${today}
tags: [ふんわり予報, AI占い, 日常]
layout: post
---

${displayForecast}

<br>
*この予報はAIが生成したエンターテイメントです。内容の正確性を保証するものではありません。毎日昼の１１時ごろにふんわり更新されます。みんなにふんわり拡散希望です。*
---
${BMAC_LINK ? `☕️ [Buy Me a Coffee](${BMAC_LINK})\n` : ''}
🐦 [今日の予報をXでシェア](${dynamicTwitterShareUrl}) `;

  const outDir = path.join(process.cwd(), "_posts");
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }
  const outPath = path.join(outDir, postFilename);
  fs.writeFileSync(outPath, md);

  console.log("✅ ふんわり予報を保存しました:", outPath);
}

main().catch(err => {
  console.error("❌ スクリプト全体で予期せぬエラーが発生しました:", err);
  process.exit(1);
});
