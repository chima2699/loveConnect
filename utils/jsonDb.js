// utils/jsonDb.js
const fs = require('fs');
const path = require('path');

function ensureFile(filePath, defaultValue) {
  if (!fs.existsSync(path.dirname(filePath))) {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
  }
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, JSON.stringify(defaultValue, null, 2));
  }
}

function loadJson(filePath) {
  ensureFile(filePath, Array.isArray(filePath) ? [] : []);
  const raw = fs.readFileSync(filePath, 'utf8') || '[]';
  try {
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function saveJson(filePath, data) {
  ensureFile(filePath, []);
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

module.exports = { ensureFile, loadJson, saveJson };
