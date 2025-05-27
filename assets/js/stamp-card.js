// assets/js/stamp-card.js (デバッグ用 console.log 追加版)

document.addEventListener('DOMContentLoaded', function() {
    console.log("stamp-card.js: DOMContentLoaded - スクリプト開始"); // スクリプト開始のログ

    const STORAGE_KEY_USER_PROGRESS = 'geminiQuoteBlogUserProgress_v1';
    const todayString = new Date().toISOString().split('T')[0];
    console.log("stamp-card.js: 今日 (todayString):", todayString);

    let userData = JSON.parse(localStorage.getItem(STORAGE_KEY_USER_PROGRESS)) || {
        lastVisitDate: null,
        stamps: 0,
        rank: "Curious Newcomer"
    };
    console.log("stamp-card.js: 読み込み直後の userData:", JSON.stringify(userData, null, 2));

    if (userData.lastVisitDate !== todayString) {
        console.log("stamp-card.js: 新しい日の訪問です。スタンプ処理を実行します。");
        userData.stamps += 1;
        userData.lastVisitDate = todayString;
        updateUserRank(); // ランク更新を呼び出し
        localStorage.setItem(STORAGE_KEY_USER_PROGRESS, JSON.stringify(userData));
        console.log("stamp-card.js: スタンプ処理後の userData:", JSON.stringify(userData, null, 2));
    } else {
        console.log("stamp-card.js: 今日は既に訪問済みです。");
    }

    function updateUserRank() {
        console.log("stamp-card.js: updateUserRank 関数が呼ばれました。現在のスタンプ数:", userData.stamps);
        const oldRank = userData.rank;
        if (userData.stamps >= 30) {
            userData.rank = "Quote Virtuoso";
        } else if (userData.stamps >= 15) {
            userData.rank = "Wisdom Master";
        } else if (userData.stamps >= 7) {
            userData.rank = "Dedicated Reader";
        } else if (userData.stamps >= 3) {
            userData.rank = "Quote Collector";
        }
        // ランクが実際に更新されたか、または初期設定のランクかを確認
        if (oldRank !== userData.rank) {
            console.log("stamp-card.js: ランクが更新されました。新しいランク:", userData.rank);
        } else {
            console.log("stamp-card.js: ランクに変更はありません。現在のランク:", userData.rank);
        }
    }

    updateUserRank(); // ページ読み込み時にランクを（再）計算
    console.log("stamp-card.js: ページ読み込み時の最終的な userData.rank:", userData.rank);


    const shareButtons = document.querySelectorAll('.twitter-share-button');
    console.log("stamp-card.js: 検出された共有ボタンの数:", shareButtons.length);

    shareButtons.forEach((button, index) => {
        console.log(`stamp-card.js: 共有ボタン ${index + 1} を処理中`);
        const postPermalink = button.getAttribute('data-post-permalink');
        const tweetEssence = button.getAttribute('data-tweet-essence');
        console.log(`stamp-card.js: ボタン ${index + 1} - permalink:`, postPermalink);
        console.log(`stamp-card.js: ボタン ${index + 1} - essence:`, tweetEssence);

        if (postPermalink && tweetEssence) {
            const tweetText = `[${userData.rank}] AI Quote of the Day: "${tweetEssence}" See more 👇`;
            const encodedTweetText = encodeURIComponent(tweetText);
            const encodedPermalink = encodeURIComponent(postPermalink);
            
            button.href = `https://twitter.com/intent/tweet?text=${encodedTweetText}&url=${encodedPermalink}`;
            button.target = "_blank";
            button.rel = "noopener noreferrer";
            console.log(`stamp-card.js: ボタン ${index + 1} の href を更新しました:`, button.href);
        } else {
            console.warn(`stamp-card.js: ボタン ${index + 1} に data属性が不足しているか、値がありません。`);
            button.style.display = 'none';
        }
    });

    console.log("stamp-card.js: スクリプト終了"); // スクリプト終了のログ
});
