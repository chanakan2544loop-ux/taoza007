// dashboard.js
const CAT_ICONS = {
  food: '🍜', drink: '🧋', transport: '🚌',
  shopping: '🛍️', health: '💊', entertainment: '🎮', other: '📦'
};
const CAT_LABELS = {
  food: 'อาหาร', drink: 'เครื่องดื่ม', transport: 'เดินทาง',
  shopping: 'ช้อปปิ้ง', health: 'สุขภาพ', entertainment: 'ความบันเทิง', other: 'อื่นๆ'
};
const DAY_TH = ['อา.','จ.','อ.','พ.','พฤ.','ศ.','ส.'];

let userData = {};

function fmt(n) {
  return '฿' + Number(n).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function today() {
  return new Date().toISOString().split('T')[0];
}
function thDate(iso) {
  const d = new Date(iso + 'T00:00:00');
  return `${DAY_TH[d.getDay()]} ${d.getDate()}/${d.getMonth()+1}`;
}

// ── Load summary ─────────────────────────────────────────────────────
async function loadMe() {
  const res = await fetch('/api/me');
  if (res.status === 401) { window.location.href = '/login'; return; }
  userData = await res.json();

  document.getElementById('nav-user').textContent = '👤 ' + userData.username;
  document.getElementById('settings-weekly').value = userData.weekly_budget;

  // Daily
  document.getElementById('daily-budget').textContent    = fmt(userData.daily_budget);
  document.getElementById('daily-spent').textContent     = fmt(userData.daily_spent);
  document.getElementById('daily-remaining').textContent = fmt(userData.daily_remaining);

  const pct = Math.min((userData.daily_spent / userData.daily_budget) * 100, 100);
  const fill = document.getElementById('progress-fill');
  fill.style.width = pct + '%';
  fill.className = 'progress-fill' + (userData.daily_remaining < 0 ? ' over' : '');
  document.getElementById('progress-pct').textContent = Math.round(pct) + '%';

  // Weekly
  document.getElementById('weekly-budget').textContent    = fmt(userData.weekly_budget);
  document.getElementById('weekly-spent').textContent     = fmt(userData.weekly_spent);
  document.getElementById('weekly-remaining').textContent = fmt(userData.weekly_remaining);

  // Monthly budget (4.3 weeks)
  const monthBudget = userData.weekly_budget * 4.3;
  document.getElementById('monthly-budget').textContent    = fmt(monthBudget);
  document.getElementById('monthly-spent').textContent     = fmt(userData.monthly_spent);
  document.getElementById('monthly-remaining').textContent = fmt(monthBudget - userData.monthly_spent);
}

// ── Load daily expenses ───────────────────────────────────────────────
async function loadExpenses() {
  const todayStr = today();
  const d = new Date();
  document.getElementById('today-label').textContent =
    `${DAY_TH[d.getDay()]} ${d.getDate()}/${d.getMonth()+1}/${d.getFullYear()+543}`;

  const res  = await fetch('/api/expenses?date=' + todayStr);
  const list = await res.json();
  const el   = document.getElementById('expense-list');

  if (!list.length) {
    el.innerHTML = '<div class="empty-state">ยังไม่มีรายการวันนี้ 🌸</div>';
    return;
  }
  el.innerHTML = list.map(item => `
    <div class="expense-item" id="exp-${item.id}">
      <div class="exp-icon">${CAT_ICONS[item.category] || '📦'}</div>
      <div class="exp-info">
        <div class="exp-name">${escHtml(item.item)}</div>
        <div class="exp-cat">${CAT_LABELS[item.category] || item.category}</div>
      </div>
      <div class="exp-amount">${fmt(item.amount)}</div>
      <button class="exp-delete" onclick="deleteExpense(${item.id})" title="ลบ">✕</button>
    </div>
  `).join('');
}

// ── Load week bar chart ───────────────────────────────────────────────
async function loadWeek() {
  const res  = await fetch('/api/expenses/week');
  const list = await res.json();
  const el   = document.getElementById('week-list');
  if (!list.length) { el.innerHTML = '<div class="empty-state">ยังไม่มีรายการสัปดาห์นี้ 🌿</div>'; return; }
  const max  = Math.max(...list.map(r => r.total), 1);
  const todayStr = today();
  el.innerHTML = list.map(r => `
    <div class="week-item ${r.date === todayStr ? 'today-row' : ''}">
      <span class="week-date">${thDate(r.date)}${r.date === todayStr ? ' (วันนี้)' : ''}</span>
      <div class="week-bar-wrap"><div class="week-bar" style="width:${(r.total/max)*100}%"></div></div>
      <span class="week-amount">${fmt(r.total)}</span>
    </div>
  `).join('');
}

// ── Load month bar chart ──────────────────────────────────────────────
async function loadMonth() {
  const res  = await fetch('/api/expenses/month');
  const list = await res.json();
  const el   = document.getElementById('month-list');
  if (!list.length) { el.innerHTML = '<div class="empty-state">ยังไม่มีรายการเดือนนี้ 🌙</div>'; return; }
  const max  = Math.max(...list.map(r => r.total), 1);
  const todayStr = today();
  el.innerHTML = list.map(r => `
    <div class="week-item ${r.date === todayStr ? 'today-row' : ''}">
      <span class="week-date">${thDate(r.date)}${r.date === todayStr ? ' (วันนี้)' : ''}</span>
      <div class="week-bar-wrap"><div class="week-bar" style="width:${(r.total/max)*100}%"></div></div>
      <span class="week-amount">${fmt(r.total)}</span>
    </div>
  `).join('');
}

// ── Add expense ───────────────────────────────────────────────────────
document.getElementById('add-btn').addEventListener('click', async () => {
  const item     = document.getElementById('item-name').value.trim();
  const amount   = parseFloat(document.getElementById('item-amount').value);
  const category = document.getElementById('item-category').value;
  if (!item || !amount || amount <= 0) { alert('กรุณากรอกชื่อรายการและจำนวนเงิน'); return; }
  await fetch('/api/expenses', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ item, amount, category })
  });
  document.getElementById('item-name').value   = '';
  document.getElementById('item-amount').value = '';
  await loadMe();
  await loadExpenses();
  await loadWeek();
  await loadMonth();
});

// Enter key shortcut
document.getElementById('item-amount').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') document.getElementById('add-btn').click();
});

// ── Delete expense ────────────────────────────────────────────────────
async function deleteExpense(id) {
  if (!confirm('ลบรายการนี้?')) return;
  await fetch('/api/expenses/' + id, { method: 'DELETE' });
  await loadMe();
  await loadExpenses();
  await loadWeek();
  await loadMonth();
}

// ── Tabs ──────────────────────────────────────────────────────────────
document.querySelectorAll('.tab').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-section').forEach(s => s.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('tab-' + btn.dataset.tab).classList.add('active');
  });
});

// ── Logout ────────────────────────────────────────────────────────────
document.getElementById('logout-btn').addEventListener('click', async () => {
  await fetch('/api/logout', { method: 'POST' });
  window.location.href = '/login';
});

// ── Settings ──────────────────────────────────────────────────────────
document.getElementById('settings-btn').addEventListener('click', () => {
  document.getElementById('settings-modal').classList.remove('hidden');
});
document.getElementById('close-settings').addEventListener('click', () => {
  document.getElementById('settings-modal').classList.add('hidden');
});
document.getElementById('save-settings').addEventListener('click', async () => {
  const weekly = parseFloat(document.getElementById('settings-weekly').value);
  if (!weekly || weekly <= 0) { alert('กรุณากรอกงบประมาณที่ถูกต้อง'); return; }
  await fetch('/api/settings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ weekly_budget: weekly })
  });
  document.getElementById('settings-modal').classList.add('hidden');
  await loadMe();
});

// ── Helper ────────────────────────────────────────────────────────────
function escHtml(str) {
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

// ── Init ──────────────────────────────────────────────────────────────
(async () => {
  await loadMe();
  await loadExpenses();
  await loadWeek();
  await loadMonth();
})();
