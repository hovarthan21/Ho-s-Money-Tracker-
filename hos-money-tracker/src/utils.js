import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export const EXP = ['Hostel Rent', 'Travel', 'Food', 'House'];
export const INC = ['Salary'];
export const ld = (d) => new Date(d - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 10);
export const today = () => ld(new Date());
export const fmt = (n) => '₹' + Number(n).toLocaleString('en-IN', { maximumFractionDigits: 2 });

export const sum = (l) => {
  const inc = l.filter((t) => t.type === 'income').reduce((a, t) => a + t.amount, 0);
  const sp = l.filter((t) => t.type === 'expense').reduce((a, t) => a + t.amount, 0);
  return { inc, sp, bal: inc - sp };
};

// category list: fixed ones + any custom label already used
export const cats = (tx, type) => {
  const base = type === 'income' ? INC : type === 'expense' ? EXP : [...EXP, ...INC];
  const used = tx.filter((t) => type === 'all' || t.type === type).map((t) => t.label);
  return [...new Set([...base, ...used])];
};

export function range(f) {
  const now = new Date(), to = ld(now);
  if (f.period === 'month') { const d = new Date(now); d.setMonth(d.getMonth() - 1); return [ld(d), to]; }
  if (f.period === 'year') { const d = new Date(now); d.setFullYear(d.getFullYear() - 1); return [ld(d), to]; }
  if (f.period === 'custom') return [f.from || '', f.to || ''];
  return ['', ''];
}

export function applyF(tx, f) {
  const [a, b] = range(f);
  return tx.filter((t) =>
    (f.type === 'all' || t.type === f.type) && (f.cat === 'all' || t.label === f.cat) &&
    (!a || t.date >= a) && (!b || t.date <= b));
}

export function pdfReport(list, f, user, overall) {
  const d = new jsPDF(), [a, b] = range(f), s = sum(list), n = (v) => v.toFixed(2);
  d.setFontSize(18); d.text("Ho's Money Tracker - Report", 14, 18);
  d.setFontSize(10);
  d.text(`User: ${user}     Generated: ${today()}`, 14, 25);
  d.text(`Period: ${a || 'Beginning'} to ${b || 'Today'}     Showing: ${f.type === 'all' ? 'Income + Spent' : f.type === 'income' ? 'Income' : 'Spent'}     Category: ${f.cat === 'all' ? 'All' : f.cat}`, 14, 31);
  const rows = [...list].sort((x, y) => x.date.localeCompare(y.date)).map((t) =>
    [t.date, t.label, t.type === 'income' ? 'Income' : 'Spent', t.type === 'income' ? n(t.amount) : '', t.type === 'expense' ? n(t.amount) : '']);
  autoTable(d, { startY: 36, head: [['Date', 'Category', 'Type', 'Income (Rs)', 'Spent (Rs)']], body: rows,
    headStyles: { fillColor: [245, 197, 24], textColor: 20 }, alternateRowStyles: { fillColor: [255, 251, 230] } });
  let y = d.lastAutoTable.finalY + 10;
  if (y > 260) { d.addPage(); y = 20; }
  d.setFontSize(11);
  d.text(`Total income: Rs ${n(s.inc)}`, 14, y);
  d.text(`Total spent: Rs ${n(s.sp)}`, 14, y + 7);
  d.text(`Balance for this report: Rs ${n(s.bal)}`, 14, y + 14);
  d.setFontSize(12); d.text(`Balance in hand (all time): Rs ${n(overall)}`, 14, y + 23);
  d.save(`ho-report-${today()}.pdf`);
}

// ---------- chatbot (rule based, reads your own data) ----------
const MN = 'january february march april may june july august september october november december'.split(' ');
const MON = '(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sept|sep|oct|nov|dec)';
const mi = (s) => MN.findIndex((m) => m.startsWith(s.slice(0, 3)));

function parseRange(q) {
  const n = new Date(), y = n.getFullYear(), m = n.getMonth();
  const yr = +((q.match(/\b(20\d\d)\b/) || [])[1] || y);
  const mr = (yy, mm) => [ld(new Date(yy, mm, 1)), ld(new Date(yy, mm + 1, 0))];
  const one = (dd, mm) => { const d = ld(new Date(yr, mm, dd)); return [d, d, 'on ' + d]; };
  let x;
  if ((x = q.match(/(\d{4})-(\d{2})-(\d{2})/))) return [x[0], x[0], 'on ' + x[0]];
  if ((x = q.match(new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+(?:of\\s+)?${MON}\\b`)))) return one(+x[1], mi(x[2]));
  if ((x = q.match(new RegExp(`\\b${MON}\\s+(\\d{1,2})(?:st|nd|rd|th)?\\b`)))) return one(+x[2], mi(x[1]));
  if ((x = q.match(new RegExp(`\\b${MON}\\b`)))) return [...mr(yr, mi(x[1])), `in ${MN[mi(x[1])]} ${yr}`];
  if (/yesterday/.test(q)) { const d = ld(new Date(n - 864e5)); return [d, d, 'yesterday']; }
  if (/today/.test(q)) return [today(), today(), 'today'];
  if (/last month/.test(q)) return [...mr(y, m - 1), 'last month'];
  if (/this month/.test(q)) return [...mr(y, m), 'this month'];
  if (/last year/.test(q)) return [`${y - 1}-01-01`, `${y - 1}-12-31`, 'last year'];
  if (/this year/.test(q)) return [`${y}-01-01`, `${y}-12-31`, 'this year'];
  return ['', '', ''];
}

export function answer(q, tx) {
  q = q.toLowerCase();
  const [a, b, lab] = parseRange(q);
  const hit = [...new Set(tx.map((t) => t.label))].filter((c) =>
    c.toLowerCase().split(' ').some((w) => w.length > 2 && q.includes(w)));
  const list = tx.filter((t) => (!a || t.date >= a) && (!b || t.date <= b) && (!hit.length || hit.includes(t.label)));
  const s = sum(list), when = lab || 'in total', what = hit.length ? ` on ${hit.join(', ')}` : '';
  if (!list.length) return `I found no records${what} ${lab || ''}.`.replace(/\s+\./, '.');
  if (/balance|left|remain|saving/.test(q)) return `Balance ${when}: ${fmt(s.bal)} (income ${fmt(s.inc)}, spent ${fmt(s.sp)}).`;
  if (/income|earn|receiv|salary/.test(q) && !/spen|spent|expens/.test(q)) return `Income${what} ${when}: ${fmt(s.inc)}.`;
  if (/spen|spent|expens|cost|paid|pay|total/.test(q) || hit.length) {
    let r = `Spent${what} ${when}: ${fmt(s.sp)}.`;
    if (!hit.length && s.sp) {
      const by = {};
      list.filter((t) => t.type === 'expense').forEach((t) => (by[t.label] = (by[t.label] || 0) + t.amount));
      r += '\n' + Object.entries(by).sort((p, z) => z[1] - p[1]).map(([k, v]) => `${k}: ${fmt(v)}`).join('\n');
    }
    return r;
  }
  return `Income ${when}: ${fmt(s.inc)}. Spent: ${fmt(s.sp)}. Balance: ${fmt(s.bal)}.`;
}
