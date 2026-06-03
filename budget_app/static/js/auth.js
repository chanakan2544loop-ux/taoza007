// auth.js
const errEl = document.getElementById('error-msg');
const okEl  = document.getElementById('success-msg');

function showErr(msg) {
  errEl.textContent = msg;
  errEl.classList.remove('hidden');
  okEl.classList.add('hidden');
}
function showOk(msg) {
  okEl.textContent = msg;
  okEl.classList.remove('hidden');
  errEl.classList.add('hidden');
}

// LOGIN
const loginForm = document.getElementById('login-form');
if (loginForm) {
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value;
    if (!username || !password) return showErr('กรุณากรอกข้อมูลให้ครบ');
    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      const data = await res.json();
      if (data.ok) {
        window.location.href = '/dashboard';
      } else {
        showErr(data.error || 'เกิดข้อผิดพลาด');
      }
    } catch {
      showErr('ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้');
    }
  });
}

// REGISTER
const regForm = document.getElementById('register-form');
if (regForm) {
  regForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value;
    const weekly_budget = document.getElementById('weekly_budget').value;
    if (!username || !password) return showErr('กรุณากรอกข้อมูลให้ครบ');
    if (password.length < 6) return showErr('รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร');
    try {
      const res = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password, weekly_budget: parseFloat(weekly_budget) })
      });
      const data = await res.json();
      if (data.ok) {
        showOk('สมัครสมาชิกสำเร็จ! กำลังพาไปหน้าเข้าสู่ระบบ...');
        setTimeout(() => window.location.href = '/login', 1400);
      } else {
        showErr(data.error || 'เกิดข้อผิดพลาด');
      }
    } catch {
      showErr('ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้');
    }
  });
}
