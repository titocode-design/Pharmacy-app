/* =====================================================
 *  Phone database layer: SQLite (sql.js) kept inside the
 *  phone's IndexedDB. Every change is saved straight away.
 * ===================================================== */
(function () {
  'use strict';

  const IDB_NAME = 'pharmacy-data', IDB_STORE = 'kv', IDB_KEY = 'db';
  let SQL = null, db = null;
  let saveChain = Promise.resolve();
  let saveError = null;
  let idbPromise = null;

  function idbOpen() {
    if (!idbPromise) {
      idbPromise = new Promise((resolve, reject) => {
        const req = indexedDB.open(IDB_NAME, 1);
        req.onupgradeneeded = () => req.result.createObjectStore(IDB_STORE);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
    }
    return idbPromise;
  }
  async function idbGet(key) {
    const d = await idbOpen();
    return new Promise((resolve, reject) => {
      const r = d.transaction(IDB_STORE, 'readonly').objectStore(IDB_STORE).get(key);
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => reject(r.error);
    });
  }
  async function idbSet(key, val) {
    const d = await idbOpen();
    return new Promise((resolve, reject) => {
      const t = d.transaction(IDB_STORE, 'readwrite');
      t.objectStore(IDB_STORE).put(val, key);
      t.oncomplete = () => resolve();
      t.onerror = () => reject(t.error);
      t.onabort = () => reject(t.error);
    });
  }

  async function init() {
    const res = await fetch('vendor/sql-wasm.wasm');
    const wasm = await res.arrayBuffer();
    SQL = await initSqlJs({ wasmBinary: wasm });

    const saved = await idbGet(IDB_KEY);
    db = saved ? new SQL.Database(new Uint8Array(saved)) : new SQL.Database();
    db.run('PRAGMA foreign_keys = ON');
    createSchema();
    persist();
    await flush();
  }

  function createSchema() {
    db.run(`CREATE TABLE IF NOT EXISTS items (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      name        TEXT NOT NULL UNIQUE COLLATE NOCASE,
      price       REAL NOT NULL DEFAULT 0,
      qty         INTEGER NOT NULL DEFAULT 0,
      min_qty     INTEGER NOT NULL DEFAULT 10,
      expiry      TEXT,
      warn_days   INTEGER NOT NULL DEFAULT 90,
      created_at  TEXT NOT NULL
    )`);
    db.run(`CREATE TABLE IF NOT EXISTS stock_in (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      item_id     INTEGER NOT NULL REFERENCES items(id) ON DELETE CASCADE,
      qty         INTEGER NOT NULL,
      price       REAL NOT NULL DEFAULT 0,
      expiry      TEXT,
      created_at  TEXT NOT NULL
    )`);
    db.run(`CREATE TABLE IF NOT EXISTS sales (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      total       REAL NOT NULL DEFAULT 0,
      created_at  TEXT NOT NULL
    )`);
    db.run(`CREATE TABLE IF NOT EXISTS sale_items (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      sale_id     INTEGER NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
      item_id     INTEGER REFERENCES items(id) ON DELETE SET NULL,
      name        TEXT NOT NULL,
      qty         INTEGER NOT NULL,
      price       REAL NOT NULL,
      line_total  REAL NOT NULL
    )`);
    db.run('CREATE INDEX IF NOT EXISTS idx_sales_created ON sales(created_at)');
    db.run('CREATE INDEX IF NOT EXISTS idx_sale_items_sale ON sale_items(sale_id)');
    db.run('CREATE INDEX IF NOT EXISTS idx_stock_in_item ON stock_in(item_id)');
  }

  /* ---- query helpers ---- */
  function all(sql, params) {
    params = params || [];
    const st = db.prepare(sql);
    try {
      if (params.length) st.bind(params);
      const rows = [];
      while (st.step()) rows.push(st.getAsObject());
      return rows;
    } finally {
      st.free();
    }
  }
  const get = (sql, params) => all(sql, params)[0];
  const run = (sql, params) => db.run(sql, params || []);
  const lastId = () => get('SELECT last_insert_rowid() AS id').id;

  function tx(fn) {
    db.run('BEGIN');
    try {
      const result = fn();
      db.run('COMMIT');
      persist();
      return result;
    } catch (e) {
      try { db.run('ROLLBACK'); } catch (_) { /* already rolled back */ }
      throw e;
    }
  }

  /** Takes a snapshot of the database and queues it to be saved. */
  function persist() {
    const data = db.export();
    db.run('PRAGMA foreign_keys = ON'); // export() resets pragmas
    saveChain = saveChain
      .then(() => idbSet(IDB_KEY, data))
      .then(() => { saveError = null; }, e => { saveError = e; });
  }

  /** Waits until the last change is written. Throws if saving failed. */
  async function flush() {
    await saveChain;
    if (saveError) throw new Error('Could not save data on this phone: ' + (saveError.message || saveError));
  }

  /** Returns the whole database as a file (for backup). */
  function exportBytes() {
    const data = db.export();
    db.run('PRAGMA foreign_keys = ON');
    return data;
  }

  /** Replaces the whole database with a backup file. */
  async function importBytes(bytes) {
    let test;
    try {
      test = new SQL.Database(bytes);
      const r = test.exec("SELECT name FROM sqlite_master WHERE type='table' AND name IN ('items','sales','sale_items')");
      if (!r.length || r[0].values.length < 3) throw new Error('not a pharmacy file');
    } catch (e) {
      if (test) test.close();
      throw new Error('This file is not a valid Pharmacy backup.');
    }
    test.close();
    db.close();
    db = new SQL.Database(bytes);
    db.run('PRAGMA foreign_keys = ON');
    createSchema();
    persist();
    await flush();
  }

  window.Store = { init, all, get, run, lastId, tx, flush, exportBytes, importBytes };
})();
