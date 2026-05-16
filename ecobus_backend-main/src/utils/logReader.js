// Reads recent lines from the rotating log files in LOG_DIR.
// Files are JSON-per-line (Winston). We expose tail + filter helpers.
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import { LOG_DIR } from './logger.js';

export const listLogFiles = () => {
  if (!fs.existsSync(LOG_DIR)) return [];
  return fs
    .readdirSync(LOG_DIR)
    .filter((f) => f.startsWith('ecobus-') && f.endsWith('.log'))
    .sort()
    .map((name) => {
      const full = path.join(LOG_DIR, name);
      const stat = fs.statSync(full);
      return { name, path: full, size: stat.size, mtime: stat.mtime };
    });
};

const parseLine = (line) => {
  try {
    return JSON.parse(line);
  } catch {
    return { level: 'info', message: line, timestamp: null, raw: true };
  }
};

// Tail across the most-recent N files, returning up to `limit` parsed entries
// (newest first), optionally filtered by level + substring.
export const tail = ({ limit = 200, level, search, file } = {}) => {
  const files = listLogFiles();
  if (!files.length) return [];

  const targets = file
    ? files.filter((f) => f.name === file)
    : files.slice(-3); // last 3 days max

  const all = [];
  for (const f of targets) {
    const lines = fs.readFileSync(f.path, 'utf8').split('\n').filter(Boolean);
    for (const l of lines) all.push(parseLine(l));
  }

  let filtered = all;
  if (level && level !== 'all') {
    filtered = filtered.filter((e) => (e.level || '').toLowerCase() === level.toLowerCase());
  }
  if (search) {
    const q = search.toLowerCase();
    filtered = filtered.filter((e) =>
      JSON.stringify(e).toLowerCase().includes(q),
    );
  }

  // Newest first
  filtered.reverse();
  return filtered.slice(0, Math.min(Math.max(limit, 1), 2000));
};

// Stream new lines from the *current* log file as they are appended.
// Returns an async iterator-like helper using fs.watch + tail-by-position.
export const followCurrentFile = (onLine) => {
  const files = listLogFiles();
  if (!files.length) return () => {};
  const current = files[files.length - 1].path;
  let position = fs.statSync(current).size;

  const readNew = () => {
    fs.stat(current, (err, stat) => {
      if (err || stat.size <= position) return;
      const stream = fs.createReadStream(current, { start: position, end: stat.size });
      const rl = readline.createInterface({ input: stream });
      rl.on('line', (line) => {
        if (line.trim()) onLine(parseLine(line));
      });
      rl.on('close', () => { position = stat.size; });
    });
  };

  const watcher = fs.watch(current, { persistent: false }, () => readNew());
  return () => watcher.close();
};
