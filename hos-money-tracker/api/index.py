import os, smtplib, datetime as dt
from functools import wraps
from email.message import EmailMessage
import jwt
from flask import Flask, request, jsonify, send_from_directory
from sqlalchemy import create_engine, text
from werkzeug.security import generate_password_hash, check_password_hash

url = os.environ.get('DATABASE_URL', 'sqlite:///ho.db')
if url.startswith('postgres://'):
    url = url.replace('postgres://', 'postgresql+psycopg2://', 1)
elif url.startswith('postgresql://'):
    url = url.replace('postgresql://', 'postgresql+psycopg2://', 1)
eng = create_engine(url, pool_pre_ping=True)
PK = 'SERIAL PRIMARY KEY' if eng.dialect.name == 'postgresql' else 'INTEGER PRIMARY KEY AUTOINCREMENT'
SECRET = os.environ.get('SECRET_KEY', 'change-me')
ALLOWED = [u.strip().lower() for u in os.environ.get('ALLOWED_USERS', '').split(',') if u.strip()]

with eng.begin() as c:
    c.execute(text(f"CREATE TABLE IF NOT EXISTS users(id {PK}, username TEXT UNIQUE NOT NULL, pw TEXT NOT NULL, email TEXT DEFAULT '', threshold REAL DEFAULT 0, alerted INTEGER DEFAULT 0)"))
    c.execute(text(f"CREATE TABLE IF NOT EXISTS tx(id {PK}, uid INTEGER NOT NULL, type TEXT NOT NULL, label TEXT NOT NULL, amount REAL NOT NULL, date TEXT NOT NULL)"))

app = Flask(__name__)


def auth(f):
    @wraps(f)
    def w(*a, **k):
        try:
            uid = jwt.decode(request.headers.get('Authorization', '')[7:], SECRET, algorithms=['HS256'])['uid']
        except Exception:
            return jsonify(error='Please login again'), 401
        return f(uid, *a, **k)
    return w


def mail(to, bal, th):
    usr, pw = os.environ.get('SMTP_USER'), os.environ.get('SMTP_PASS')
    if not (usr and pw):
        return False
    try:
        m = EmailMessage()
        m['Subject'] = "Ho's Money Tracker: balance is low"
        m['From'], m['To'] = usr, to
        m.set_content(f'Your balance is Rs {bal:.2f}, below your alert level of Rs {th:.2f}.')
        with smtplib.SMTP_SSL('smtp.gmail.com', 465, timeout=10) as s:
            s.login(usr, pw)
            s.send_message(m)
        return True
    except Exception:
        return False


def check(c, uid):
    """Send the email once when balance drops below the alert level. Reset when it recovers."""
    u = c.execute(text('SELECT email,threshold,alerted FROM users WHERE id=:i'), {'i': uid}).first()
    b = c.execute(text("SELECT COALESCE(SUM(CASE WHEN type='income' THEN amount ELSE -amount END),0) FROM tx WHERE uid=:i"), {'i': uid}).scalar()
    th = u.threshold or 0
    if th > 0 and b < th:
        if u.email and not u.alerted and mail(u.email, b, th):
            c.execute(text('UPDATE users SET alerted=1 WHERE id=:i'), {'i': uid})
    elif u.alerted:
        c.execute(text('UPDATE users SET alerted=0 WHERE id=:i'), {'i': uid})


@app.post('/api/login')
def login():
    d = request.get_json(force=True, silent=True) or {}
    u, p = (d.get('username') or '').strip().lower(), d.get('password') or ''
    if len(u) < 2 or len(p) < 4:
        return jsonify(error='Username needs 2+ characters, password 4+'), 400
    with eng.begin() as c:
        r = c.execute(text('SELECT id,pw FROM users WHERE username=:u'), {'u': u}).first()
        if r:
            if not check_password_hash(r.pw, p):
                return jsonify(error='Wrong password'), 401
            uid = r.id
        else:  # first login with a new username creates it
            if ALLOWED and u not in ALLOWED:
                return jsonify(error='This username is not allowed'), 403
            c.execute(text('INSERT INTO users(username,pw) VALUES(:u,:p)'), {'u': u, 'p': generate_password_hash(p)})
            uid = c.execute(text('SELECT id FROM users WHERE username=:u'), {'u': u}).scalar()
    tok = jwt.encode({'uid': uid, 'exp': dt.datetime.utcnow() + dt.timedelta(days=30)}, SECRET, algorithm='HS256')
    return jsonify(token=tok, username=u)


@app.get('/api/data')
@auth
def data(uid):
    with eng.begin() as c:
        tx = [dict(r._mapping) for r in c.execute(text('SELECT id,type,label,amount,date FROM tx WHERE uid=:i ORDER BY date DESC,id DESC'), {'i': uid})]
        u = c.execute(text('SELECT email,threshold FROM users WHERE id=:i'), {'i': uid}).first()
    return jsonify(tx=tx, settings={'email': u.email or '', 'threshold': u.threshold or 0})


@app.post('/api/tx')
@auth
def add(uid):
    d = request.get_json(force=True, silent=True) or {}
    try:
        amt, label, date = float(d['amount']), d['label'].strip(), d['date']
        assert amt > 0 and label and d['type'] in ('income', 'expense')
        dt.date.fromisoformat(date)
    except Exception:
        return jsonify(error='Check label, amount and date'), 400
    with eng.begin() as c:
        c.execute(text('INSERT INTO tx(uid,type,label,amount,date) VALUES(:u,:t,:l,:a,:d)'),
                  {'u': uid, 't': d['type'], 'l': label, 'a': amt, 'd': date})
        check(c, uid)
    return jsonify(ok=True)


@app.delete('/api/tx/<int:i>')
@auth
def delete(uid, i):
    with eng.begin() as c:
        c.execute(text('DELETE FROM tx WHERE id=:i AND uid=:u'), {'i': i, 'u': uid})
        check(c, uid)
    return jsonify(ok=True)


@app.post('/api/settings')
@auth
def settings(uid):
    d = request.get_json(force=True, silent=True) or {}
    try:
        th = max(0.0, float(d.get('threshold') or 0))
    except ValueError:
        return jsonify(error='Enter a valid amount'), 400
    with eng.begin() as c:
        c.execute(text('UPDATE users SET email=:e,threshold=:t,alerted=0 WHERE id=:i'),
                  {'e': (d.get('email') or '').strip(), 't': th, 'i': uid})
        check(c, uid)
    return jsonify(ok=True)


# Serves the built website when you run locally (Vercel serves it by itself)
DIST = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'dist')


@app.get('/', defaults={'p': ''})
@app.get('/<path:p>')
def site(p):
    if p and os.path.isfile(os.path.join(DIST, p)):
        return send_from_directory(DIST, p)
    return send_from_directory(DIST, 'index.html')


if __name__ == '__main__':
    print('Open http://localhost:5000'); app.run(port=5000)
