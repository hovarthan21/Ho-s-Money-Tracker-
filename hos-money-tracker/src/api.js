let token = localStorage.getItem('ho_token') || '';
export const setToken = (t) => {
  token = t;
  t ? localStorage.setItem('ho_token', t) : localStorage.removeItem('ho_token');
};
export async function api(path, method = 'GET', body) {
  const r = await fetch('/api' + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token && { Authorization: 'Bearer ' + token }) },
    body: body ? JSON.stringify(body) : undefined
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw Object.assign(new Error(d.error || 'Something went wrong'), { status: r.status });
  return d;
}
