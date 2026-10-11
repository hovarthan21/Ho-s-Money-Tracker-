import { useState, useEffect, useMemo } from 'react';
import { api, setToken } from './api';
import { today, fmt, sum, cats, applyF, pdfReport, answer } from './utils';

const QUOTES = [
  'Money matters, but the habit of tracking it matters more.',
  'A rupee noted today is a rupee saved tomorrow.',
  'Spend with a plan, save without a reason.',
  'Small spends, written down, become big savings.'
];

function Coins() {
  const coins = useMemo(() => Array.from({ length: 44 }, () => ({
    left: Math.random() * 96, delay: Math.random() * 1.6, dur: 2.2 + Math.random() * 1.6, size: 22 + Math.random() * 20
  })), []);
  return (
    <div className="coins" aria-hidden="true">
      {coins.map((c, i) => (
        <span key={i} className="coin" style={{ left: c.left + '%', width: c.size, height: c.size, fontSize: c.size * 0.6, animationDelay: c.delay + 's', animationDuration: c.dur + 's' }}>₹</span>
      ))}
    </div>
  );
}

function Login({ onLogin }) {
  const [u, setU] = useState(''), [p, setP] = useState(''), [err, setErr] = useState(''), [busy, setBusy] = useState(false);
  const go = async (e) => {
    e.preventDefault(); setBusy(true); setErr('');
    try {
      const d = await api('/login', 'POST', { username: u, password: p });
      setToken(d.token); localStorage.setItem('ho_user', d.username); onLogin(d.username);
    } catch (x) { setErr(x.message); }
    setBusy(false);
  };
  return (
    <div className="login">
      <form className="card login-card" onSubmit={go}>
        <div className="logo">H</div>
        <h1>Ho's Money Tracker</h1>
        <input placeholder="Username" value={u} onChange={(e) => setU(e.target.value)} autoCapitalize="none" autoComplete="username" />
        <input placeholder="Password" type="password" value={p} onChange={(e) => setP(e.target.value)} autoComplete="current-password" />
        {err && <p className="err">{err}</p>}
        <button className="btn" disabled={busy}>{busy ? 'Checking…' : 'Login'}</button>
        <p className="muted">A new username is created on its first login. After that, the same password is needed every time.</p>
      </form>
    </div>
  );
}

function Seg({ v, on, o }) {
  return <div className="seg">{o.map(([k, l]) => <button type="button" key={k} className={v === k ? 'on' : ''} onClick={() => on(k)}>{l}</button>)}</div>;
}

function Stats({ s }) {
  return (
    <div className="stats">
      <div><small>Income</small><b className="pos">{fmt(s.inc)}</b></div>
      <div><small>Spent</small><b className="neg">{fmt(s.sp)}</b></div>
      <div><small>Balance</small><b className={s.bal < 0 ? 'neg' : ''}>{fmt(s.bal)}</b></div>
    </div>
  );
}

function List({ list, onDel, limit }) {
  if (!list.length) return <p className="muted">No records yet.</p>;
  return (
    <ul className="list">
      {list.slice(0, limit || 500).map((t) => (
        <li key={t.id}>
          <div><b>{t.label}</b><small>{t.date}</small></div>
          <span className={t.type === 'income' ? 'pos' : 'neg'}>{t.type === 'income' ? '+' : '−'}{fmt(t.amount)}</span>
          {onDel && <button className="x" aria-label="Delete" onClick={() => confirm('Delete this record?') && onDel(t.id)}>×</button>}
        </li>
      ))}
    </ul>
  );
}

function AddForm({ tx, onAdd }) {
  const [type, setType] = useState('expense'), [label, setLabel] = useState(''), [custom, setCustom] = useState(false);
  const [amount, setAmount] = useState(''), [date, setDate] = useState(today()), [msg, setMsg] = useState(''), [busy, setBusy] = useState(false);
  const chips = cats(tx, type);
  const submit = async () => {
    const l = label.trim();
    if (!l || !(+amount > 0)) return setMsg('Choose a label and enter an amount.');
    setBusy(true);
    try {
      await onAdd({ type, label: chips.find((c) => c.toLowerCase() === l.toLowerCase()) || l, amount: +amount, date });
      setAmount(''); setLabel(''); setCustom(false); setMsg('Added.');
    } catch (e) { setMsg(e.message); }
    setBusy(false);
  };
  return (
    <div className="card">
      <Seg v={type} on={(v) => { setType(v); setLabel(''); setCustom(false); }} o={[['expense', 'Spent'], ['income', 'Income']]} />
      <div className="chips">
        {chips.map((c) => <button key={c} type="button" className={'chip' + (label === c && !custom ? ' on' : '')} onClick={() => { setLabel(c); setCustom(false); }}>{c}</button>)}
        <button type="button" className={'chip plus' + (custom ? ' on' : '')} onClick={() => { setCustom(true); setLabel(''); }} aria-label="Add new label">+</button>
      </div>
      {custom && <input placeholder="Type a new label (e.g. Movie)" value={label} onChange={(e) => setLabel(e.target.value)} autoFocus />}
      <div className="row">
        <label>Amount<input type="number" inputMode="decimal" min="0" placeholder="0" value={amount} onChange={(e) => setAmount(e.target.value)} /></label>
        <label>Date<input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></label>
      </div>
      <button className="btn" onClick={submit} disabled={busy}>{busy ? 'Saving…' : `Add ${type === 'income' ? 'income' : 'spending'}`}</button>
      {msg && <p className="muted">{msg}</p>}
    </div>
  );
}

function FilterBar({ f, setF, tx }) {
  const set = (o) => setF({ ...f, ...o });
  return (
    <div className="card">
      <Seg v={f.type} on={(v) => set({ type: v, cat: 'all' })} o={[['all', 'Both'], ['income', 'Income'], ['expense', 'Spent']]} />
      <Seg v={f.period} on={(v) => set({ period: v })} o={[['all', 'All time'], ['month', '1 Month'], ['year', '1 Year'], ['custom', 'Custom']]} />
      {f.period === 'custom' && (
        <div className="row">
          <label>From<input type="date" value={f.from} onChange={(e) => set({ from: e.target.value })} /></label>
          <label>To<input type="date" value={f.to} onChange={(e) => set({ to: e.target.value })} /></label>
        </div>
      )}
      <label>Category
        <select value={f.cat} onChange={(e) => set({ cat: e.target.value })}>
          <option value="all">All categories</option>
          {cats(tx, f.type).map((c) => <option key={c}>{c}</option>)}
        </select>
      </label>
    </div>
  );
}

function Chat({ tx }) {
  const [open, setOpen] = useState(false), [q, setQ] = useState('');
  const [msgs, setMsgs] = useState([{ me: false, t: "Hi, I'm Ho's AI agent. Ask me about your money, like “how much did I spend on food this month?”" }]);
  const ask = (text) => {
    if (!text.trim()) return;
    setMsgs((m) => [...m, { me: true, t: text }, { me: false, t: answer(text, tx) }]); setQ('');
  };
  return (
    <>
      {open && (
        <div className="chat">
          <div className="chat-head"><b>Ho's AI agent</b><button className="x" onClick={() => setOpen(false)} aria-label="Close">×</button></div>
          <div className="chat-body" ref={(el) => el && (el.scrollTop = el.scrollHeight)}>
            {msgs.map((m, i) => <div key={i} className={'bub ' + (m.me ? 'me' : '')}>{m.t}</div>)}
          </div>
          <div className="chat-sug">
            {['spent this month', 'spent on food', 'income this year', 'balance'].map((s) => <button key={s} className="chip" onClick={() => ask(s)}>{s}</button>)}
          </div>
          <form className="chat-in" onSubmit={(e) => { e.preventDefault(); ask(q); }}>
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Ask about your money…" />
            <button className="btn">Send</button>
          </form>
        </div>
      )}
      <button className="hbtn" data-tip="Ho's AI agent" title="Ho's AI agent" onClick={() => setOpen(!open)} aria-label="Open Ho's AI agent">H</button>
    </>
  );
}

function Main({ user, logout }) {
  const [tab, setTab] = useState('home'), [tx, setTx] = useState([]), [set, setSet] = useState({ email: '', threshold: 0 });
  const [f, setF] = useState({ type: 'all', period: 'all', from: '', to: '', cat: 'all' });
  const [th, setTh] = useState(''), [em, setEm] = useState(''), [note, setNote] = useState(''), [err, setErr] = useState('');
  const load = async () => {
    try {
      const d = await api('/data'); setTx(d.tx); setSet(d.settings); setTh(d.settings.threshold || ''); setEm(d.settings.email);
    } catch (e) { e.status === 401 ? logout() : setErr(e.message); }
  };
  useEffect(() => { load(); }, []);
  const all = sum(tx), low = set.threshold > 0 && all.bal < set.threshold;
  const fl = useMemo(() => applyF(tx, f), [tx, f]), fs = sum(fl);
  const quote = useMemo(() => QUOTES[Math.floor(Math.random() * QUOTES.length)], []);
  const add = async (b) => { await api('/tx', 'POST', b); await load(); };
  const del = async (id) => { await api('/tx/' + id, 'DELETE'); await load(); };
  const saveAlert = async () => {
    try { await api('/settings', 'POST', { threshold: th, email: em }); await load(); setNote('Alert saved.'); }
    catch (e) { setNote(e.message); }
  };
  const byCat = {};
  tx.filter((t) => t.type === 'expense').forEach((t) => (byCat[t.label] = (byCat[t.label] || 0) + t.amount));
  const max = Math.max(1, ...Object.values(byCat));
  const Banner = () => low && <div className="alert">Balance {fmt(all.bal)} is below your alert level of {fmt(set.threshold)}.</div>;

  return (
    <div className="wrap">
      <header><h1>Ho's Money Tracker</h1><button className="link" onClick={logout}>Logout ({user})</button></header>
      {err && <p className="err">{err}</p>}
      {tab === 'home' && (<>
        <Banner />
        <Stats s={all} />
        <AddForm tx={tx} onAdd={add} />
        <div className="card">
          <h2>Spent by category</h2>
          {Object.keys(byCat).length === 0 && <p className="muted">Nothing spent yet.</p>}
          {Object.entries(byCat).sort((a, b) => b[1] - a[1]).map(([k, v]) => (
            <div key={k} className="bar"><span>{k}</span><div><i style={{ width: (v / max) * 100 + '%' }} /></div><b>{fmt(v)}</b></div>
          ))}
        </div>
        <div className="card"><h2>Recent</h2><List list={tx} onDel={del} limit={8} /></div>
      </>)}
      {tab === 'filter' && (<>
        <FilterBar f={f} setF={setF} tx={tx} />
        <Stats s={fs} />
        <div className="card"><h2>{fl.length} record{fl.length === 1 ? '' : 's'}</h2><List list={fl} onDel={del} /></div>
      </>)}
      {tab === 'report' && (<>
        <FilterBar f={f} setF={setF} tx={tx} />
        <Stats s={fs} />
        <div className="card">
          <p>Balance in hand (all time): <b>{fmt(all.bal)}</b></p>
          <p className="muted">The PDF includes date, category, income, spent, and balance for the records selected above ({fl.length}).</p>
          <button className="btn" disabled={!fl.length} onClick={() => pdfReport(fl, f, user, all.bal)}>Download PDF report</button>
        </div>
      </>)}
      {tab === 'alert' && (<>
        <Banner />
        <div className="card">
          <h2>Low balance alert</h2>
          <label>Alert me when balance falls below (₹)<input type="number" inputMode="decimal" value={th} onChange={(e) => setTh(e.target.value)} placeholder="e.g. 2000" /></label>
          <label>Email for alerts (optional)<input type="email" value={em} onChange={(e) => setEm(e.target.value)} placeholder="you@gmail.com" /></label>
          <button className="btn" onClick={saveAlert}>Save alert</button>
          {note && <p className="muted">{note}</p>}
          <p className="muted">Current balance: {fmt(all.bal)}. {set.threshold > 0 ? (low ? 'You are below the level.' : 'You are above the level.') : 'No alert level set.'}</p>
        </div>
      </>)}
      <footer><p>“{quote}”</p><small>Developed by Ho</small></footer>
      <nav>
        {[['home', 'Home'], ['filter', 'Filter'], ['report', 'Report'], ['alert', 'Alerts']].map(([k, l]) => (
          <button key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{l}{k === 'alert' && low && <i className="dot" />}</button>
        ))}
      </nav>
      <Chat tx={tx} />
    </div>
  );
}

export default function App() {
  const [user, setUser] = useState(localStorage.getItem('ho_user')), [coins, setCoins] = useState(false);
  const onLogin = (u) => { setUser(u); setCoins(true); setTimeout(() => setCoins(false), 4800); };
  const logout = () => { setToken(''); localStorage.removeItem('ho_user'); setUser(null); };
  return <>{coins && <Coins />}{user ? <Main user={user} logout={logout} /> : <Login onLogin={onLogin} />}</>;
}
