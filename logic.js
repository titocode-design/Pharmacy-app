(function () {
'use strict';
/* =====================================================
 *  Pharmacy logic (same rules as the PHP version)
 * ===================================================== */
const db = window.Store;

class ApiError extends Error {}

/* ---- dates (always the computer's local time) ---- */
const pad = n => String(n).padStart(2, '0');
const dateOf = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const todayStr = () => dateOf(new Date());
const nowStamp = () => {
  const d = new Date();
  return `${dateOf(d)} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
};

function validDate(s) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const [y, m, d] = s.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

function daysLeft(expiry) {
  if (!expiry) return null;
  const [y, m, d] = expiry.split('-').map(Number);
  const t = new Date();
  const a = Date.UTC(y, m - 1, d);
  const b = Date.UTC(t.getFullYear(), t.getMonth(), t.getDate());
  return Math.round((a - b) / 86400000);
}

const money = n => Math.round(n * 100) / 100;

function normItem(r) {
  return {
    id: r.id,
    name: r.name,
    price: Number(r.price),
    qty: r.qty,
    min_qty: r.min_qty,
    expiry: r.expiry || null,
    warn_days: r.warn_days,
    days_left: daysLeft(r.expiry)
  };
}

const ITEM_COLS = 'id, name, price, qty, min_qty, expiry, warn_days';

function itemsAll() {
  return db.all(`SELECT ${ITEM_COLS} FROM items ORDER BY name COLLATE NOCASE`).map(normItem);
}

function salesList(limit, date) {
  limit = Math.max(1, Math.min(500, parseInt(limit, 10) || 100));
  let sql = 'SELECT id, total, created_at FROM sales';
  const args = [];
  if (date) {
    sql += ' WHERE substr(created_at, 1, 10) = ?';
    args.push(date);
  }
  sql += ` ORDER BY id DESC LIMIT ${limit}`;
  const sales = db.all(sql, args);
  if (!sales.length) return [];

  const ids = sales.map(s => s.id);
  const lines = db.all(
    `SELECT sale_id, name, qty, price, line_total FROM sale_items
     WHERE sale_id IN (${ids.map(() => '?').join(',')}) ORDER BY id`,
    ids
  );
  const byId = {};
  lines.forEach(l => {
    (byId[l.sale_id] = byId[l.sale_id] || []).push({
      name: l.name, qty: l.qty, price: Number(l.price), line_total: Number(l.line_total)
    });
  });
  return sales.map(s => ({
    id: s.id, total: Number(s.total), created_at: s.created_at, lines: byId[s.id] || []
  }));
}

/* ---------------- Actions ---------------- */
const actions = {
  dashboard() {
    const all = itemsAll();

    const low = all.filter(i => i.qty <= i.min_qty)
      .sort((a, b) => a.qty / Math.max(1, a.min_qty) - b.qty / Math.max(1, b.min_qty));

    const expiring = all.filter(i => i.qty > 0 && i.days_left !== null && i.days_left <= i.warn_days)
      .sort((a, b) => a.days_left - b.days_left);

    const t = db.get(
      'SELECT COALESCE(SUM(total), 0) AS t, COUNT(*) AS c FROM sales WHERE substr(created_at, 1, 10) = ?',
      [todayStr()]
    );

    return {
      stats: {
        medicines: all.length,
        today_total: Number(t.t),
        today_count: t.c,
        low_count: low.length,
        exp_count: expiring.length
      },
      low,
      expiring,
      recent: salesList(6)
    };
  },

  items() {
    return { items: itemsAll() };
  },

  register(params, b) {
    const name = String(b.name == null ? '' : b.name).trim();
    const qty = parseInt(b.qty, 10) || 0;
    let min = parseInt(b.min_qty, 10);
    if (!(min >= 1)) min = 10;
    let warn = parseInt(b.warn_days, 10);
    if (!(warn >= 1)) warn = 90;
    const exp = String(b.expiry == null ? '' : b.expiry).trim();
    const price = (b.price === null || b.price === undefined || b.price === '') ? null : Number(b.price);

    if (!name || name.length > 150) throw new ApiError('Enter the medicine name (max 150 characters).');
    if (qty < 1) throw new ApiError('Enter the quantity received.');
    if (!exp || !validDate(exp)) throw new ApiError('Enter a valid expiry date.');
    if (price !== null && (!Number.isFinite(price) || price < 0)) throw new ApiError('Enter a valid price.');

    return db.tx(() => {
      const now = nowStamp();
      const row = db.get('SELECT id, price FROM items WHERE name = ?', [name]);
      let id, created, finalPrice;

      if (row) {
        id = row.id;
        finalPrice = price !== null ? price : Number(row.price);
        db.run(
          'UPDATE items SET qty = qty + ?, price = ?, min_qty = ?, expiry = ?, warn_days = ? WHERE id = ?',
          [qty, finalPrice, min, exp, warn, id]
        );
        created = false;
      } else {
        if (price === null) throw new ApiError('Enter the selling price for a new medicine.');
        finalPrice = price;
        db.run(
          'INSERT INTO items (name, price, qty, min_qty, expiry, warn_days, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
          [name, price, qty, min, exp, warn, now]
        );
        id = db.lastId();
        created = true;
      }

      db.run(
        'INSERT INTO stock_in (item_id, qty, price, expiry, created_at) VALUES (?, ?, ?, ?, ?)',
        [id, qty, finalPrice, exp, now]
      );
      const item = normItem(db.get(`SELECT ${ITEM_COLS} FROM items WHERE id = ?`, [id]));
      return { ok: true, created, item };
    });
  },

  sell(params, b) {
    const lines = Array.isArray(b.lines) ? b.lines : [];
    if (!lines.length) throw new ApiError('The sale is empty.');

    // Merge duplicate lines
    const want = new Map();
    for (const l of lines) {
      const id = parseInt(l && l.id, 10) || 0;
      const q = parseInt(l && l.qty, 10) || 0;
      if (id < 1 || q < 1) throw new ApiError('Invalid sale line.');
      want.set(id, (want.get(id) || 0) + q);
    }

    return db.tx(() => {
      let total = 0;
      const rows = [];
      const newlyLow = [];

      for (const [id, q] of want) {
        const it = db.get('SELECT id, name, price, qty, min_qty, expiry FROM items WHERE id = ?', [id]);
        if (!it) throw new ApiError('A medicine in this sale no longer exists.');
        const dl = daysLeft(it.expiry);
        if (dl !== null && dl <= 0) throw new ApiError(`${it.name} has expired and cannot be sold.`);
        if (q > it.qty) throw new ApiError(`Only ${it.qty} left of ${it.name}.`);

        const price = Number(it.price); // price always comes from the database
        const line = money(q * price);
        total += line;
        rows.push({ id: it.id, name: it.name, q, price, line });
        if (it.qty > it.min_qty && it.qty - q <= it.min_qty) newlyLow.push(it.name);
      }
      total = money(total);

      db.run('INSERT INTO sales (total, created_at) VALUES (?, ?)', [total, nowStamp()]);
      const saleId = db.lastId();
      for (const r of rows) {
        db.run(
          'INSERT INTO sale_items (sale_id, item_id, name, qty, price, line_total) VALUES (?, ?, ?, ?, ?, ?)',
          [saleId, r.id, r.name, r.q, r.price, r.line]
        );
        db.run('UPDATE items SET qty = qty - ? WHERE id = ?', [r.q, r.id]);
      }
      return { ok: true, sale_id: saleId, total, newly_low: newlyLow };
    });
  },

  sales(params) {
    const date = params && params.date ? String(params.date) : null;
    if (date && !validDate(date)) throw new ApiError('Invalid date.');
    return { sales: salesList(params && params.limit, date) };
  },

  delete_item(params, b) {
    const id = parseInt(b.id, 10) || 0;
    if (id < 1) throw new ApiError('Invalid medicine.');
    db.tx(() => db.run('DELETE FROM items WHERE id = ?', [id]));
    return { ok: true };
  }
};

/** Called from the window. Always returns {ok, data} or {ok:false, error}. */
function handle(req) {
  try {
    const fn = actions[req && req.action];
    if (!fn || !Object.prototype.hasOwnProperty.call(actions, req.action)) {
      throw new ApiError('Unknown action.');
    }
    return { ok: true, data: fn(req.params || {}, req.body || {}) };
  } catch (e) {
    if (e instanceof ApiError) return { ok: false, error: e.message };
    return { ok: false, error: 'Unexpected error: ' + (e && e.message ? e.message : e) };
  }
}

window.PharmacyApi = { handle };

})();
