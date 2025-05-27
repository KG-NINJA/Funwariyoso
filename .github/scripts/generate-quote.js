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
  // 他にも気になるニュースサイトやブログのRSSフィードを追加できます
];

const SITE_BASE_URL = "https://kg-ninja.github.io/Funwari-Forecast-Blog"; // あなたの新しいブログのURL
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
    console.warn("⚠️ RSSから取得できる記事タイトルがありませんでした。処理をスキップします。");
    // 必要に応じて、ここでは固定のメッセージを生成したり、処理を中断したりする
    // 今回は、予報生成に進まずに終了するようにします。
    // もし固定のメッセージを出したい場合は、displayForecast の初期値を設定し、
    // 以下のAPI呼び出しをスキップするなどの処理を記述します。
    // displayForecast = "今日は情報収集がお休みのため、ふんわり予報もお休みです。";
    // console.log(displayForecast); // ログには出す
    // fs.writeFileSync(...) // Markdown生成に進む場合はこのコメントを外す
    return; // RSSから情報が取れなければ予報は出さない
  }

  // 2. Gemini APIに投げるプロンプトを組み立てる
  const titlesString = recentTitles.join("\n- "); // タイトルを箇条書き形式に
  const prompt = `
以下の最近のニュース記事のタイトル一覧を参考に、世の中の「ふんわりとした雰囲気」を読み取ってください。
そして、その雰囲気に基づいた「明日のふんわり動向予報」を、占いやおみくじのような、ユーモラスかつ曖昧なスタイルで、一言（50～100文字程度）で生成してください。
深刻な内容、断定的な表現、政治的・宗教的に偏った内容は避けてください。読者がクスッと笑えたり、少しだけポジティブな気持ちになれるような、当たり障りのない楽しい予報をお願いします。
予報の最後には「明日のラッキーアイテム：〇〇」のような一文を添えてください。

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
  let tweetTextContent = displayForecast.split('。')[0] + '。'; // 最初の句点まで
  if (tweetTextContent.length > 100) { // 長すぎる場合は短縮
      tweetTextContent = tweetTextContent.substring(0, 97) + "...";
  }
  const tweetText = `明日のふんわり予報: 「${tweetTextContent}」続きはブログで！ 👇`;
  
  const [year, month, day] = today.split('-');
  const postFilename = `${year}-${month}-${day}-funwari-forecast.md`; // ファイル名も変更
  const postPath = `/${year}/${month}/${day}/funwari-forecast.html`; // パーマリンクも変更
  const postPermalink = `${SITE_BASE_URL}${postPath}`;
  
  const encodedTweetText = encodeURIComponent(tweetText);
  const encodedPostPermalink = encodeURIComponent(postPermalink);
  const dynamicTwitterShareUrl = `https://twitter.com/intent/tweet?text=${encodedTweetText}&url=${encodedPostPermalink}`;

  const md = `---
title: "${mdTitle}"
date: ${today}
tags: [ふんわり予報, AI占い, 日常]
layout: post
---

${displayForecast}

<br>
*この予報はAIが生成したエンターテイメントです。内容の正確性を保証するものではありません。お楽しみください。*
---
${BMAC_LINK ? `☕️ [Buy Me a Coffee](${BMAC_LINK})\n` : ''}
🐦 <a href="#" class="twitter-share-button" data-post-permalink="${postPermalink}" data-tweet-essence="${encodeURIComponent(tweetTextContent)}">今日の予報をXでシェア</a>
`;

  const outDir = path.join(process.cwd(), "_posts");
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }
  const outPath = path.join(outDir, postFilename);
  fs.writeFileSync(outPath, md);

  console.log("✅ ふんわり予報を保存しました:", outPath);
}

main().catch(err => {
  // main関数内で個別エラー処理をしているので、ここでは汎用的なエラー出力のみ
  console.error("❌ スクリプト全体で予期せぬエラーが発生しました:", err);
  process.exit(1);
});