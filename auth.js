const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const USERS_FILE = path.join(__dirname, 'users.json');
const SHORT_SESSION_TTL_MS = 1000 * 60 * 60 * 12; // 12 hours (default)
const LONG_SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30; // 30 days (remember me)

// In-memory session store: token -> { username, expiresAt }
const sessions = new Map();

function loadUsers() {
  try {
    if (!fs.existsSync(USERS_FILE)) return { users: [] };
    const raw = fs.readFileSync(USERS_FILE, 'utf8');
    return raw.trim() ? JSON.parse(raw) : { users: [] };
  } catch (error) {
    console.error('Failed to load users:', error.message);
    return { users: [] };
  }
}

function saveUsers(data) {
  try {
    fs.writeFileSync(USERS_FILE, JSON.stringify(data, null, 2), 'utf8');
    return true;
  } catch (error) {
    console.error('Failed to save users:', error.message);
    return false;
  }
}

function normalizeEmail(email) {
  return email ? String(email).trim().toLowerCase() : '';
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function hashPassword(password, salt) {
  return crypto.scryptSync(String(password), salt, 64).toString('hex');
}

function registerUser(email, password) {
  const normalizedEmail = normalizeEmail(email);

  if (!normalizedEmail || !isValidEmail(normalizedEmail)) {
    return { error: 'Please enter a valid email address.' };
  }
  if (!password || String(password).length < 6) {
    return { error: 'Password must be at least 6 characters.' };
  }

  const data = loadUsers();
  if (data.users.some((user) => user.email === normalizedEmail)) {
    return { error: 'That email is already registered. Try logging in instead.' };
  }

  const salt = crypto.randomBytes(16).toString('hex');
  const passwordHash = hashPassword(password, salt);
  const user = {
    email: normalizedEmail,
    salt,
    passwordHash,
    createdAt: new Date().toISOString(),
  };
  data.users.push(user);
  if (!saveUsers(data)) {
    return { error: 'Failed to save your account. Please try again.' };
  }
  return { user: { email: user.email } };
}

function verifyLogin(email, password) {
  const normalizedEmail = normalizeEmail(email);
  const data = loadUsers();
  const user = data.users.find((entry) => entry.email === normalizedEmail);
  if (!user) {
    return { error: 'Incorrect email or password.' };
  }
  const hash = hashPassword(password, user.salt);
  if (hash !== user.passwordHash) {
    return { error: 'Incorrect email or password.' };
  }
  return { user: { email: user.email } };
}

function createSession(email, remember) {
  const token = crypto.randomBytes(32).toString('hex');
  const ttl = remember ? LONG_SESSION_TTL_MS : SHORT_SESSION_TTL_MS;
  sessions.set(token, { email, expiresAt: Date.now() + ttl, ttl });
  return { token, ttl };
}

function touchSession(token) {
  const session = sessions.get(token);
  if (session) {
    session.expiresAt = Date.now() + session.ttl;
  }
}

function getSession(token) {
  if (!token) return null;
  const session = sessions.get(token);
  if (!session) return null;
  if (session.expiresAt < Date.now()) {
    sessions.delete(token);
    return null;
  }
  return session;
}

function destroySession(token) {
  if (token) sessions.delete(token);
}

module.exports = {
  registerUser,
  verifyLogin,
  createSession,
  getSession,
  destroySession,
  touchSession,
};
