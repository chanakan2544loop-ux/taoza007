from flask import Flask, render_template, request, jsonify, session, redirect, url_for
from werkzeug.security import generate_password_hash, check_password_hash
import sqlite3, os
from datetime import date, timedelta
from functools import wraps

app = Flask(__name__)
app.secret_key = "budget_secret_key_2024"
DB = "budget.db"

def get_db():
    conn = sqlite3.connect(DB)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    with get_db() as db:
        db.executescript("""
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT UNIQUE NOT NULL,
                password TEXT NOT NULL,
                weekly_budget REAL DEFAULT 1000
            );
            CREATE TABLE IF NOT EXISTS expenses (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                date TEXT NOT NULL,
                item TEXT NOT NULL,
                amount REAL NOT NULL,
                category TEXT DEFAULT 'other',
                FOREIGN KEY (user_id) REFERENCES users(id)
            );
        """)

def login_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        if "user_id" not in session:
            return redirect(url_for("login_page"))
        return f(*args, **kwargs)
    return decorated

# ─── Pages ───────────────────────────────────────────────────────────────
@app.route("/")
def index():
    if "user_id" in session:
        return redirect(url_for("dashboard"))
    return redirect(url_for("login_page"))

@app.route("/login")
def login_page():
    return render_template("auth.html", mode="login")

@app.route("/register")
def register_page():
    return render_template("auth.html", mode="register")

@app.route("/dashboard")
@login_required
def dashboard():
    return render_template("dashboard.html")

# ─── Auth API ─────────────────────────────────────────────────────────────
@app.route("/api/register", methods=["POST"])
def register():
    data = request.json
    username = data.get("username", "").strip()
    password = data.get("password", "")
    weekly = float(data.get("weekly_budget", 1000))
    if not username or not password:
        return jsonify({"error": "กรุณากรอกข้อมูลให้ครบ"}), 400
    try:
        with get_db() as db:
            db.execute(
                "INSERT INTO users (username, password, weekly_budget) VALUES (?,?,?)",
                (username, generate_password_hash(password), weekly)
            )
        return jsonify({"ok": True})
    except sqlite3.IntegrityError:
        return jsonify({"error": "ชื่อผู้ใช้นี้มีอยู่แล้ว"}), 409

@app.route("/api/login", methods=["POST"])
def login():
    data = request.json
    db = get_db()
    user = db.execute("SELECT * FROM users WHERE username=?", (data.get("username"),)).fetchone()
    if user and check_password_hash(user["password"], data.get("password", "")):
        session["user_id"] = user["id"]
        session["username"] = user["username"]
        return jsonify({"ok": True})
    return jsonify({"error": "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง"}), 401

@app.route("/api/logout", methods=["POST"])
def logout():
    session.clear()
    return jsonify({"ok": True})

# ─── Budget API ───────────────────────────────────────────────────────────
@app.route("/api/me")
@login_required
def me():
    db = get_db()
    user = db.execute("SELECT username, weekly_budget FROM users WHERE id=?", (session["user_id"],)).fetchone()
    today = date.today().isoformat()
    # week start = Monday
    today_dt = date.today()
    week_start = (today_dt - timedelta(days=today_dt.weekday())).isoformat()
    month_start = today_dt.replace(day=1).isoformat()

    daily = db.execute(
        "SELECT COALESCE(SUM(amount),0) as total FROM expenses WHERE user_id=? AND date=?",
        (session["user_id"], today)
    ).fetchone()["total"]

    weekly = db.execute(
        "SELECT COALESCE(SUM(amount),0) as total FROM expenses WHERE user_id=? AND date>=?",
        (session["user_id"], week_start)
    ).fetchone()["total"]

    monthly = db.execute(
        "SELECT COALESCE(SUM(amount),0) as total FROM expenses WHERE user_id=? AND date>=?",
        (session["user_id"], month_start)
    ).fetchone()["total"]

    days_in_week = today_dt.weekday() + 1
    daily_budget = user["weekly_budget"] / 7
    return jsonify({
        "username": user["username"],
        "weekly_budget": user["weekly_budget"],
        "daily_budget": round(daily_budget, 2),
        "daily_spent": daily,
        "weekly_spent": weekly,
        "monthly_spent": monthly,
        "daily_remaining": round(daily_budget - daily, 2),
        "weekly_remaining": round(user["weekly_budget"] - weekly, 2),
    })

@app.route("/api/expenses", methods=["GET"])
@login_required
def get_expenses():
    date_filter = request.args.get("date", date.today().isoformat())
    db = get_db()
    rows = db.execute(
        "SELECT * FROM expenses WHERE user_id=? AND date=? ORDER BY id DESC",
        (session["user_id"], date_filter)
    ).fetchall()
    return jsonify([dict(r) for r in rows])

@app.route("/api/expenses/week")
@login_required
def get_week_expenses():
    today_dt = date.today()
    week_start = (today_dt - timedelta(days=today_dt.weekday())).isoformat()
    db = get_db()
    rows = db.execute(
        "SELECT date, COALESCE(SUM(amount),0) as total FROM expenses WHERE user_id=? AND date>=? GROUP BY date ORDER BY date",
        (session["user_id"], week_start)
    ).fetchall()
    return jsonify([dict(r) for r in rows])

@app.route("/api/expenses/month")
@login_required
def get_month_expenses():
    today_dt = date.today()
    month_start = today_dt.replace(day=1).isoformat()
    db = get_db()
    rows = db.execute(
        "SELECT date, COALESCE(SUM(amount),0) as total FROM expenses WHERE user_id=? AND date>=? GROUP BY date ORDER BY date",
        (session["user_id"], month_start)
    ).fetchall()
    return jsonify([dict(r) for r in rows])

@app.route("/api/expenses", methods=["POST"])
@login_required
def add_expense():
    data = request.json
    item = data.get("item", "").strip()
    amount = float(data.get("amount", 0))
    category = data.get("category", "other")
    today = date.today().isoformat()
    if not item or amount <= 0:
        return jsonify({"error": "ข้อมูลไม่ถูกต้อง"}), 400
    with get_db() as db:
        db.execute(
            "INSERT INTO expenses (user_id, date, item, amount, category) VALUES (?,?,?,?,?)",
            (session["user_id"], today, item, amount, category)
        )
    return jsonify({"ok": True})

@app.route("/api/expenses/<int:eid>", methods=["DELETE"])
@login_required
def delete_expense(eid):
    with get_db() as db:
        db.execute("DELETE FROM expenses WHERE id=? AND user_id=?", (eid, session["user_id"]))
    return jsonify({"ok": True})

@app.route("/api/settings", methods=["POST"])
@login_required
def update_settings():
    data = request.json
    weekly = float(data.get("weekly_budget", 1000))
    with get_db() as db:
        db.execute("UPDATE users SET weekly_budget=? WHERE id=?", (weekly, session["user_id"]))
    return jsonify({"ok": True})

if __name__ == "__main__":
    init_db()
    app.run(debug=True, port=5000)
