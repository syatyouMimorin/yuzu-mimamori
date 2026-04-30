// =============================
// 設定（変更する場合はここを編集）
// =============================
const FOLDER_ID          = '1GV3iOOw79Rq6aC24ZsOhGxeVgLD7nlnI'; // baby-trackerフォルダID
const API_KEY            = 'AIzaSyAdy7m2S2L7pflb05K_VJmlfD8MgQPXbwU';
const FETCH_INTERVAL_MIN = 5;   // Driveからの取得間隔（分）
const DISPLAY_UPDATE_SEC = 60;  // 画面更新間隔（秒）
const NEXT_MILK_HOURS    = 3;   // 次の授乳までの目安時間（時間）
// =============================

let lastMilkTime  = null;
let lastSleepTime = null;
let isSleeping    = false;

// 現在時刻を表示
function updateClock() {
  const now  = new Date();
  const h    = String(now.getHours()).padStart(2, '0');
  const m    = String(now.getMinutes()).padStart(2, '0');
  const days = ['日', '月', '火', '水', '木', '金', '土'];
  const day  = days[now.getDay()];
  document.getElementById('clock').textContent =
    now.getFullYear() + '/' +
    String(now.getMonth() + 1).padStart(2, '0') + '/' +
    String(now.getDate()).padStart(2, '0') + '（' + day + '） ' + h + ':' + m;
}

// フォルダ内の最新ファイルIDを取得してからテキストを取得
async function fetchFromDrive() {
  try {
    // フォルダ内のファイル一覧を更新日時降順で取得
    const listUrl = `https://www.googleapis.com/drive/v3/files?q='${FOLDER_ID}'+in+parents+and+trashed=false&orderBy=modifiedTime+desc&pageSize=1&fields=files(id,name,modifiedTime)&key=${API_KEY}`;
    const listRes = await fetch(listUrl);
    if (!listRes.ok) throw new Error('一覧取得エラー HTTP ' + listRes.status);
    const listData = await listRes.json();

    if (!listData.files || listData.files.length === 0) {
      throw new Error('フォルダにファイルが見つかりません');
    }

    const latestFile = listData.files[0];

    // 最新ファイルの中身を取得
    const fileUrl = `https://www.googleapis.com/drive/v3/files/${latestFile.id}?alt=media&key=${API_KEY}`;
    const fileRes = await fetch(fileUrl);
    if (!fileRes.ok) throw new Error('ファイル取得エラー HTTP ' + fileRes.status);
    const text = await fileRes.text();

    parsePiyolog(text);
    updateDisplay();
    document.getElementById('status').textContent =
      '最終取得: ' + new Date().toLocaleTimeString('ja-JP') + '（' + latestFile.name + '）';
  } catch (e) {
    document.getElementById('status').textContent = '取得エラー: ' + e.message;
  }
}

// ぴよログテキストをパース
function parsePiyolog(text) {
  lastMilkTime  = null;
  lastSleepTime = null;
  isSleeping    = false;

  const lines = text.split('\n').map(l => l.trim()).filter(l => l);

  // 日付を取得
  let baseDate = new Date();
  const dateMatch = text.match(/【ぴよログ】(\d{4})\/(\d{2})\/(\d{2})/);
  if (dateMatch) {
    baseDate = new Date(
      parseInt(dateMatch[1]),
      parseInt(dateMatch[2]) - 1,
      parseInt(dateMatch[3])
    );
  }

  const milkTimes  = [];
  const sleepTimes = [];
  const wakeTimes  = [];

  for (const line of lines) {
    // ミルク（行頭の時刻のみ使用）
    const milkMatch = line.match(/^(\d{1,2}):(\d{2})\s+ミルク/);
    if (milkMatch) {
      const d = new Date(baseDate);
      d.setHours(parseInt(milkMatch[1]), parseInt(milkMatch[2]), 0, 0);
      milkTimes.push(d);
    }
    // 寝る（行頭の時刻のみ使用・同行複数時刻は無視）
    const sleepMatch = line.match(/^(\d{1,2}):(\d{2})\s+寝る/);
    if (sleepMatch) {
      const d = new Date(baseDate);
      d.setHours(parseInt(sleepMatch[1]), parseInt(sleepMatch[2]), 0, 0);
      sleepTimes.push(d);
    }
    // 起きる
    const wakeMatch = line.match(/^(\d{1,2}):(\d{2})\s+起きる/);
    if (wakeMatch) {
      const d = new Date(baseDate);
      d.setHours(parseInt(wakeMatch[1]), parseInt(wakeMatch[2]), 0, 0);
      wakeTimes.push(d);
    }
  }

  if (milkTimes.length > 0) {
    lastMilkTime = milkTimes[milkTimes.length - 1];
  }

  const lastSleep = sleepTimes.length > 0 ? sleepTimes[sleepTimes.length - 1] : null;
  const lastWake  = wakeTimes.length  > 0 ? wakeTimes[wakeTimes.length - 1]   : null;

  if (lastSleep && (!lastWake || lastSleep > lastWake)) {
    isSleeping    = true;
    lastSleepTime = lastSleep;
  }
}

function fmt(date) {
  return String(date.getHours()).padStart(2, '0') + ':' + String(date.getMinutes()).padStart(2, '0');
}

function diffMin(a, b) {
  return Math.floor((b - a) / 60000);
}

function fmtDuration(minutes) {
  const abs = Math.abs(minutes);
  const h   = Math.floor(abs / 60);
  const m   = abs % 60;
  return h > 0 ? h + '時間' + m + '分' : m + '分';
}

// 画面を更新
function updateDisplay() {
  const now = new Date();

  // ミルクカード
  const milkEl = document.getElementById('milk-content');
  if (lastMilkTime) {
    const nextMilk   = new Date(lastMilkTime.getTime() + NEXT_MILK_HOURS * 60 * 60 * 1000);
    const diffToNext = diffMin(now, nextMilk);
    const elapsed    = diffMin(lastMilkTime, now);

    let badge   = '';
    let nextSub = '';
    if (diffToNext > 30) {
      badge   = '<span class="badge badge-ok">余裕あり</span>';
      nextSub = 'あと ' + fmtDuration(diffToNext);
    } else if (diffToNext > 0) {
      badge   = '<span class="badge badge-warn">もうすぐ</span>';
      nextSub = 'あと ' + fmtDuration(diffToNext);
    } else {
      badge   = '<span class="badge badge-danger">授乳の時間です</span>';
      nextSub = fmtDuration(diffToNext) + ' 超過';
    }

    milkEl.innerHTML =
      '<div class="section-label">最終授乳</div>' +
      '<div class="time-display">' + fmt(lastMilkTime) + '</div>' +
      '<div class="sub-text">' + fmtDuration(elapsed) + '前</div>' +
      '<hr class="divider">' +
      '<div class="section-label">次の授乳予定</div>' +
      '<div class="time-display small">' + fmt(nextMilk) + '</div>' +
      '<div class="sub-text">' + nextSub + '</div>' +
      badge;
  } else {
    milkEl.innerHTML = '<div class="no-data">記録が見つかりません</div>';
  }

  // 睡眠カード
  const sleepEl = document.getElementById('sleep-content');
  if (isSleeping && lastSleepTime) {
    const elapsed = diffMin(lastSleepTime, now);
    sleepEl.innerHTML =
      '<div class="section-label">就寝時刻</div>' +
      '<div class="time-display">' + fmt(lastSleepTime) + '</div>' +
      '<div class="sub-text">' + fmtDuration(elapsed) + ' 経過</div>' +
      '<span class="badge badge-sleep">就寝中</span>';
  } else {
    sleepEl.innerHTML =
      '<div class="section-label">状態</div>' +
      '<div class="time-display small" style="color:var(--text-secondary);">起きています</div>';
  }
}

// 初回実行
updateClock();
fetchFromDrive();

// 時計は毎秒更新
setInterval(updateClock, 1000);

// 画面表示は1分おきに更新
setInterval(updateDisplay, DISPLAY_UPDATE_SEC * 1000);

// Driveからの取得は5分おき
setInterval(fetchFromDrive, FETCH_INTERVAL_MIN * 60 * 1000);
