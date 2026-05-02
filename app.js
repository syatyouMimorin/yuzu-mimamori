// =============================
// 設定（変更する場合はここを編集）
// =============================
const NEXT_MILK_HOURS    = 3;   // 次の授乳までの目安時間（時間）
const DISPLAY_UPDATE_SEC = 60;  // 画面更新間隔（秒）
// =============================

let lastMilkTime  = null;
let lastSleepTime = null;
let isSleeping    = false;

// ページ読み込み時にLocalStorageから復元
function loadFromStorage() {
  const milk  = localStorage.getItem('lastMilkTime');
  const sleep = localStorage.getItem('lastSleepTime');
  const sleeping = localStorage.getItem('isSleeping');

  if (milk)    lastMilkTime  = new Date(milk);
  if (sleep)   lastSleepTime = new Date(sleep);
  if (sleeping) isSleeping   = sleeping === 'true';
}

// LocalStorageに保存
function saveToStorage() {
  localStorage.setItem('lastMilkTime',  lastMilkTime  ? lastMilkTime.toISOString()  : '');
  localStorage.setItem('lastSleepTime', lastSleepTime ? lastSleepTime.toISOString() : '');
  localStorage.setItem('isSleeping',    isSleeping.toString());
}

// 入力欄を現在時刻で初期化
function initInputs() {
  setInputToNow('milk-input');
  setInputToNow('sleep-input');
}

function setInputToNow(id) {
  const now = new Date();
  const h   = String(now.getHours()).padStart(2, '0');
  const m   = String(now.getMinutes()).padStart(2, '0');
  document.getElementById(id).value = h + ':' + m;
}

// 入力欄の時刻をDateオブジェクトに変換
function inputToDate(id) {
  const val = document.getElementById(id).value;
  if (!val) return new Date();
  const [h, m] = val.split(':').map(Number);
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d;
}

// 授乳を記録
function recordMilk() {
  lastMilkTime = inputToDate('milk-input');
  saveToStorage();
  updateDisplay();
  setInputToNow('milk-input');
}

// 就寝を記録
function recordSleep() {
  lastSleepTime = inputToDate('sleep-input');
  isSleeping    = true;
  saveToStorage();
  updateDisplay();
  setInputToNow('sleep-input');
}

// 起床を記録
function recordWake() {
  isSleeping = false;
  saveToStorage();
  updateDisplay();
}

// 時計を更新
function updateClock() {
  const now  = new Date();
  const h    = String(now.getHours()).padStart(2, '0');
  const m    = String(now.getMinutes()).padStart(2, '0');
  const days = ['日', '月', '火', '水', '木', '金', '土'];
  const day  = days[now.getDay()];

  document.getElementById('clock-time').textContent = h + ':' + m;
  document.getElementById('clock-date').textContent =
    now.getFullYear() + '年' +
    (now.getMonth() + 1) + '月' +
    now.getDate() + '日（' + day + '）';
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
      '<div class="time-display">'  + fmt(lastMilkTime) + '</div>' +
      '<div class="sub-text">'      + fmtDuration(elapsed) + '前</div>' +
      '<hr class="divider">' +
      '<div class="section-label">次の授乳予定</div>' +
      '<div class="time-display small">' + fmt(nextMilk) + '</div>' +
      '<div class="sub-text">' + nextSub + '</div>' +
      badge;
  } else {
    milkEl.innerHTML = '<div class="no-data">記録なし</div>';
  }

  // 睡眠カード
  const sleepEl = document.getElementById('sleep-content');
  if (isSleeping && lastSleepTime) {
    const elapsed = diffMin(lastSleepTime, now);
    sleepEl.innerHTML =
      '<div class="section-label">就寝時刻</div>' +
      '<div class="time-display">' + fmt(lastSleepTime) + '</div>' +
      '<div class="sub-text">'     + fmtDuration(elapsed) + ' 経過</div>' +
      '<span class="badge badge-sleep">就寝中</span>';
  } else {
    sleepEl.innerHTML =
      '<div class="section-label">状態</div>' +
      '<div class="time-display small" style="color:var(--text-secondary);">起きてるよ</div>';
  }
}

// 初回実行
loadFromStorage();
initInputs();
updateClock();
updateDisplay();

// 時計は毎秒更新
setInterval(updateClock, 1000);

// 画面表示は1分おきに更新
setInterval(updateDisplay, DISPLAY_UPDATE_SEC * 1000);
