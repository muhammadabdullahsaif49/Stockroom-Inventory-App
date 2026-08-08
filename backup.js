const fs = require('fs');
const path = require('path');

const BACKUP_DIR = path.join(__dirname, 'backups');
const KEEP_BACKUPS = 14; // keep the last 14 daily backups
const FILES_TO_BACKUP = ['inventory-db.json', 'users.json'];

function ensureBackupDir() {
  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
  }
}

function todayStamp() {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD
}

function runBackup() {
  ensureBackupDir();
  const stamp = todayStamp();
  const dayDir = path.join(BACKUP_DIR, stamp);
  if (fs.existsSync(dayDir)) {
    // Already backed up today
    return;
  }
  fs.mkdirSync(dayDir, { recursive: true });
  FILES_TO_BACKUP.forEach((fileName) => {
    const source = path.join(__dirname, fileName);
    if (fs.existsSync(source)) {
      fs.copyFileSync(source, path.join(dayDir, fileName));
    }
  });
  pruneOldBackups();
  console.log(`Backup created: backups/${stamp}`);
}

function pruneOldBackups() {
  ensureBackupDir();
  const entries = fs.readdirSync(BACKUP_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
  while (entries.length > KEEP_BACKUPS) {
    const oldest = entries.shift();
    fs.rmSync(path.join(BACKUP_DIR, oldest), { recursive: true, force: true });
  }
}

function listBackups() {
  ensureBackupDir();
  return fs.readdirSync(BACKUP_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort()
    .reverse();
}

function startDailyBackupSchedule() {
  ensureBackupDir();
  runBackup(); // back up immediately on startup
  const ONE_DAY_MS = 1000 * 60 * 60 * 24;
  setInterval(runBackup, ONE_DAY_MS);
}

module.exports = {
  runBackup,
  listBackups,
  startDailyBackupSchedule,
  BACKUP_DIR,
};
