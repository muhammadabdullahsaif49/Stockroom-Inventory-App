const http = require('http');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');
const auth = require('./auth');
const backup = require('./backup');

const DATA_FILE = path.join(__dirname, 'inventory-db.json');
const PUBLIC_DIR = path.join(__dirname, 'public');
const PORT = process.env.PORT || 3000;
const DEFAULT_REORDER_LEVEL = 5;
const PUBLIC_PATHS = new Set(['/login.html', '/register.html', '/style.css', '/auth-client.js', '/favicon.ico']);

function parseCookies(req) {
  const header = req.headers.cookie;
  const cookies = {};
  if (!header) return cookies;
  header.split(';').forEach((pair) => {
    const idx = pair.indexOf('=');
    if (idx === -1) return;
    const key = pair.slice(0, idx).trim();
    const value = pair.slice(idx + 1).trim();
    cookies[key] = decodeURIComponent(value);
  });
  return cookies;
}

function setSessionCookie(res, token, ttlMs) {
  const maxAgeSeconds = Math.floor((ttlMs || 1000 * 60 * 60 * 12) / 1000);
  res.setHeader('Set-Cookie', `session_token=${token}; HttpOnly; Path=/; Max-Age=${maxAgeSeconds}; SameSite=Lax`);
}

function clearSessionCookie(res) {
  res.setHeader('Set-Cookie', 'session_token=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax');
}

const MIME_TYPES = {
  '.html': 'text/html; charset=UTF-8',
  '.js': 'application/javascript; charset=UTF-8',
  '.css': 'text/css; charset=UTF-8',
  '.json': 'application/json; charset=UTF-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};

function seedData() {
  return { items: [], transactions: [] };
}

function loadData() {
  try {
    if (!fs.existsSync(DATA_FILE)) {
      return seedData();
    }
    const raw = fs.readFileSync(DATA_FILE, 'utf8');
    return raw.trim() ? JSON.parse(raw) : seedData();
  } catch (error) {
    console.error('Failed to load data:', error.message);
    return seedData();
  }
}

function saveData(data) {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
    return true;
  } catch (error) {
    console.error('Failed to save data:', error.message);
    return false;
  }
}

function normalizeSku(value) {
  return value ? String(value).trim().toUpperCase() : '';
}

function sendJson(res, status, body) {
  const payload = JSON.stringify(body, null, 2);
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(payload);
}

function sendText(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'text/plain; charset=UTF-8' });
  res.end(body);
}

function sendStatic(res, filePath) {
  fs.readFile(filePath, (err, content) => {
    if (err) {
      sendText(res, 404, 'Not found');
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    const type = MIME_TYPES[ext] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': type });
    res.end(content);
  });
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk.toString();
      if (body.length > 25e6) {
        reject(new Error('Request body too large'));
        req.connection.destroy();
      }
    });
    req.on('end', () => {
      if (!body) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(body));
      } catch (error) {
        reject(new Error('Invalid JSON body'));
      }
    });
    req.on('error', reject);
  });
}

function getItem(data, sku) {
  return data.items.find((item) => item.sku === normalizeSku(sku));
}

function validateItemPayload(payload, isNew = true) {
  const sku = normalizeSku(payload.sku);
  const name = payload.name ? String(payload.name).trim() : '';
  const category = payload.category ? String(payload.category).trim() : '';
  const unit = payload.unit ? String(payload.unit).trim() : 'pcs';
  const unitCost = Number(payload.unitCost ?? payload.cost ?? 0);
  const reorderLevel = payload.reorderLevel !== undefined && payload.reorderLevel !== ''
    ? Number(payload.reorderLevel)
    : DEFAULT_REORDER_LEVEL;
  const quantity = Number(payload.quantity ?? 0);
  const imageUrl = payload.imageUrl ? String(payload.imageUrl) : '';

  if (!sku) return { error: 'SKU is required.' };
  if (isNew && !name) return { error: 'Name is required.' };
  if (Number.isNaN(unitCost) || unitCost < 0) return { error: 'Unit cost must be a non-negative number.' };
  if (Number.isNaN(reorderLevel) || reorderLevel < 0) return { error: 'Reorder level must be a non-negative integer.' };
  if (Number.isNaN(quantity) || quantity < 0) return { error: 'Quantity must be a non-negative number.' };
  if (imageUrl && imageUrl.length > 6e6) return { error: 'Image is too large. Please use a smaller picture.' };

  return { sku, name, category, unit, unitCost, reorderLevel, quantity, imageUrl };
}

function createTransaction(data, sku, type, quantity, reference, note, party) {
  const item = getItem(data, sku);
  if (!item) return { error: 'Item not found.' };
  const qty = Number(quantity);
  if (Number.isNaN(qty) || qty <= 0) return { error: 'Quantity must be a positive number.' };
  const beforeQuantity = item.quantity;
  const afterQuantity = type === 'IN' ? beforeQuantity + qty : beforeQuantity - qty;
  if (type === 'OUT' && afterQuantity < 0) {
    return { error: `Cannot remove ${qty} from ${sku}; only ${beforeQuantity} available.` };
  }
  item.quantity = afterQuantity;
  item.updatedAt = new Date().toISOString();
  const transaction = {
    id: String(data.transactions.length + 1),
    sku,
    type,
    quantity: qty,
    date: new Date().toISOString(),
    reference: reference ? String(reference).trim() : '',
    note: note ? String(note).trim() : '',
    party: party ? String(party).trim() : '',
    beforeQuantity,
    afterQuantity,
  };
  data.transactions.push(transaction);
  return { item, transaction };
}

function buildReport(data, query) {
  const type = query.type || 'inventory';
  if (type === 'inventory') {
    const detailed = data.items.map((item) => {
      const itemTxns = data.transactions.filter((txn) => txn.sku === item.sku);
      const totalIn = itemTxns.filter((txn) => txn.type === 'IN').reduce((sum, txn) => sum + txn.quantity, 0);
      const totalOut = itemTxns.filter((txn) => txn.type === 'OUT').reduce((sum, txn) => sum + txn.quantity, 0);
      let status = 'in-stock';
      if (item.quantity <= 0) status = 'out-of-stock';
      else if (item.quantity <= item.reorderLevel) status = 'low-stock';
      return {
        sku: item.sku,
        name: item.name,
        category: item.category,
        unit: item.unit,
        unitCost: item.unitCost,
        reorderLevel: item.reorderLevel,
        remaining: item.quantity,
        totalReceived: totalIn,
        totalSold: totalOut,
        status,
        stockValue: Math.round(item.unitCost * item.quantity * 100) / 100,
      };
    });
    return { inventory: detailed };
  }
  if (type === 'low-stock') {
    return { lowStock: data.items.filter((item) => item.quantity <= item.reorderLevel) };
  }
  if (type === 'transactions') {
    const from = query.from ? new Date(query.from) : null;
    const to = query.to ? new Date(query.to) : null;
    if (from && Number.isNaN(from.getTime())) return { error: 'Invalid from date.' };
    if (to && Number.isNaN(to.getTime())) return { error: 'Invalid to date.' };
    if (to) {
      to.setHours(23, 59, 59, 999);
    }
    const filtered = data.transactions.filter((txn) => {
      const date = new Date(txn.date);
      if (from && date < from) return false;
      if (to && date > to) return false;
      return true;
    });
    return { transactions: filtered };
  }
  return { error: 'Unknown report type.' };
}

function routeApi(req, res, parsedUrl) {
  const segments = parsedUrl.pathname.split('/').filter(Boolean);
  const method = req.method.toUpperCase();
  const apiSegments = segments.slice(1);

  if (apiSegments.length === 0) {
    sendJson(res, 404, { error: 'API route not found.' });
    return;
  }

  const collection = apiSegments[0];
  const resourceId = apiSegments[1] ? normalizeSku(apiSegments[1]) : null;

  // ---------- public auth routes (no login required) ----------

  if (collection === 'register' && method === 'POST') {
    parseBody(req).then((payload) => {
      const result = auth.registerUser(payload.email, payload.password);
      if (result.error) {
        sendJson(res, 400, { error: result.error });
        return;
      }
      sendJson(res, 201, { user: result.user });
    }).catch((error) => sendJson(res, 400, { error: error.message }));
    return;
  }

  if (collection === 'login' && method === 'POST') {
    parseBody(req).then((payload) => {
      const result = auth.verifyLogin(payload.email, payload.password);
      if (result.error) {
        sendJson(res, 401, { error: result.error });
        return;
      }
      const remember = payload.remember === true || payload.remember === 'true';
      const { token, ttl } = auth.createSession(result.user.email, remember);
      setSessionCookie(res, token, ttl);
      sendJson(res, 200, { user: result.user });
    }).catch((error) => sendJson(res, 400, { error: error.message }));
    return;
  }

  if (collection === 'logout' && method === 'POST') {
    const cookies = parseCookies(req);
    auth.destroySession(cookies.session_token);
    clearSessionCookie(res);
    sendJson(res, 200, { message: 'Logged out.' });
    return;
  }

  // ---------- everything below requires a logged-in session ----------

  const cookies = parseCookies(req);
  const session = auth.getSession(cookies.session_token);

  if (collection === 'me' && method === 'GET') {
    if (!session) {
      sendJson(res, 401, { error: 'Not authenticated.' });
      return;
    }
    sendJson(res, 200, { email: session.email });
    return;
  }

  if (!session) {
    sendJson(res, 401, { error: 'Please log in to continue.' });
    return;
  }
  auth.touchSession(cookies.session_token);

  const data = loadData();

  if (collection === 'items') {
    if (method === 'GET' && !resourceId) {
      sendJson(res, 200, { items: data.items });
      return;
    }
    if (method === 'GET' && resourceId) {
      const item = getItem(data, resourceId);
      if (!item) {
        sendJson(res, 404, { error: 'Item not found.' });
        return;
      }
      const transactions = data.transactions.filter((txn) => txn.sku === item.sku);
      sendJson(res, 200, { item, transactions });
      return;
    }
    if (method === 'POST') {
      parseBody(req).then((payload) => {
        const validated = validateItemPayload(payload, true);
        if (validated.error) {
          sendJson(res, 400, { error: validated.error });
          return;
        }
        if (getItem(data, validated.sku)) {
          sendJson(res, 409, { error: 'Item with this SKU already exists.' });
          return;
        }
        const item = {
          sku: validated.sku,
          name: validated.name,
          category: validated.category,
          unit: validated.unit,
          unitCost: validated.unitCost,
          reorderLevel: validated.reorderLevel,
          quantity: validated.quantity,
          imageUrl: validated.imageUrl || '',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        data.items.push(item);
        if (!saveData(data)) {
          sendJson(res, 500, { error: 'Failed to save item.' });
          return;
        }
        sendJson(res, 201, { item });
      }).catch((error) => sendJson(res, 400, { error: error.message }));
      return;
    }
    if (method === 'PUT' && resourceId) {
      parseBody(req).then((payload) => {
        const item = getItem(data, resourceId);
        if (!item) {
          sendJson(res, 404, { error: 'Item not found.' });
          return;
        }
        const merged = {
          sku: resourceId,
          name: payload.name ?? item.name,
          category: payload.category ?? item.category,
          unit: payload.unit ?? item.unit,
          unitCost: payload.unitCost ?? item.unitCost,
          reorderLevel: payload.reorderLevel ?? item.reorderLevel,
          quantity: payload.quantity ?? item.quantity,
          imageUrl: payload.imageUrl,
        };
        const validated = validateItemPayload(merged, false);
        if (validated.error) {
          sendJson(res, 400, { error: validated.error });
          return;
        }
        item.name = validated.name || item.name;
        item.category = validated.category;
        item.unit = validated.unit || item.unit;
        item.unitCost = validated.unitCost;
        item.reorderLevel = validated.reorderLevel;
        item.quantity = validated.quantity;
        if (validated.imageUrl) {
          item.imageUrl = validated.imageUrl;
        }
        item.updatedAt = new Date().toISOString();
        if (!saveData(data)) {
          sendJson(res, 500, { error: 'Failed to save item update.' });
          return;
        }
        sendJson(res, 200, { item });
      }).catch((error) => sendJson(res, 400, { error: error.message }));
      return;
    }
    if (method === 'DELETE' && resourceId) {
      const index = data.items.findIndex((item) => item.sku === resourceId);
      if (index === -1) {
        sendJson(res, 404, { error: 'Item not found.' });
        return;
      }
      data.items.splice(index, 1);
      saveData(data);
      sendJson(res, 200, { message: 'Item deleted.' });
      return;
    }
  }

  if (collection === 'stock-in' && method === 'POST') {
    parseBody(req).then((payload) => {
      const result = createTransaction(data, payload.sku, 'IN', payload.qty, payload.reference, payload.note, payload.party);
      if (result.error) {
        sendJson(res, 400, { error: result.error });
        return;
      }
      if (!saveData(data)) {
        sendJson(res, 500, { error: 'Failed to save stock transaction.' });
        return;
      }
      sendJson(res, 201, { transaction: result.transaction, item: result.item });
    }).catch((error) => sendJson(res, 400, { error: error.message }));
    return;
  }

  if (collection === 'stock-out' && method === 'POST') {
    parseBody(req).then((payload) => {
      const result = createTransaction(data, payload.sku, 'OUT', payload.qty, payload.reference, payload.note, payload.party);
      if (result.error) {
        sendJson(res, 400, { error: result.error });
        return;
      }
      if (!saveData(data)) {
        sendJson(res, 500, { error: 'Failed to save stock transaction.' });
        return;
      }
      sendJson(res, 201, { transaction: result.transaction, item: result.item });
    }).catch((error) => sendJson(res, 400, { error: error.message }));
    return;
  }

  if (collection === 'backup') {
    if (apiSegments[1] === 'export' && method === 'GET') {
      res.writeHead(200, {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="stockroom-backup-${new Date().toISOString().slice(0, 10)}.json"`,
      });
      res.end(JSON.stringify(data, null, 2));
      return;
    }
    if (apiSegments[1] === 'import' && method === 'POST') {
      parseBody(req).then((payload) => {
        if (!payload || !Array.isArray(payload.items) || !Array.isArray(payload.transactions)) {
          sendJson(res, 400, { error: 'Invalid backup file. Expected items and transactions arrays.' });
          return;
        }
        const restored = { items: payload.items, transactions: payload.transactions };
        if (!saveData(restored)) {
          sendJson(res, 500, { error: 'Failed to restore backup.' });
          return;
        }
        sendJson(res, 200, { message: `Restored ${restored.items.length} items and ${restored.transactions.length} transactions.` });
      }).catch((error) => sendJson(res, 400, { error: error.message }));
      return;
    }
    if (apiSegments[1] === 'list' && method === 'GET') {
      sendJson(res, 200, { backups: backup.listBackups() });
      return;
    }
    if (!apiSegments[1] && method === 'POST') {
      backup.runBackup();
      sendJson(res, 200, { message: 'Backup created.', backups: backup.listBackups() });
      return;
    }
  }

  if (collection === 'low-stock' && method === 'GET') {
    const lowStock = data.items.filter((item) => item.quantity <= item.reorderLevel);
    sendJson(res, 200, { lowStock });
    return;
  }

  if (collection === 'report' && method === 'GET') {
    const reportData = buildReport(data, parsedUrl.query);
    if (reportData.error) {
      sendJson(res, 400, { error: reportData.error });
      return;
    }
    sendJson(res, 200, reportData);
    return;
  }

  sendJson(res, 404, { error: 'API route not found.' });
}

function handleRequest(req, res) {
  const requestUrl = new URL(req.url, `http://${req.headers.host}`);
  const parsedUrl = { pathname: requestUrl.pathname, query: Object.fromEntries(requestUrl.searchParams.entries()) };
  const pathname = parsedUrl.pathname;

  if (pathname.startsWith('/api/')) {
    routeApi(req, res, parsedUrl);
    return;
  }

  const isDashboardPage = pathname === '/' || pathname === '/index.html';
  if (isDashboardPage && !PUBLIC_PATHS.has(pathname)) {
    const cookies = parseCookies(req);
    const session = auth.getSession(cookies.session_token);
    if (!session) {
      res.writeHead(302, { Location: '/login.html' });
      res.end();
      return;
    }
  }

  let filePath = path.join(PUBLIC_DIR, pathname === '/' ? 'index.html' : pathname.replace(/^\//, ''));
  if (!filePath.startsWith(PUBLIC_DIR)) {
    sendText(res, 403, 'Access denied');
    return;
  }
  fs.stat(filePath, (err, stats) => {
    if (err) {
      if (pathname === '/' || pathname === '/index.html') {
        sendStatic(res, path.join(PUBLIC_DIR, 'index.html'));
        return;
      }
      if (pathname.endsWith('/')) {
        sendStatic(res, path.join(PUBLIC_DIR, pathname, 'index.html'));
        return;
      }
      sendText(res, 404, 'Not found');
      return;
    }
    if (stats.isDirectory()) {
      filePath = path.join(filePath, 'index.html');
    }
    sendStatic(res, filePath);
  });
}

const server = http.createServer(handleRequest);
server.listen(PORT, () => {
  console.log(`Inventory web server is running at http://localhost:${PORT}`);
  backup.startDailyBackupSchedule();
});
