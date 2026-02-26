let cachedConfig = null;
let lastFetch = 0;

const CACHE_TTL = 5000; // 5 seconds

const Config = require("../models/Config");

async function getActiveConfig() {
  const now = Date.now();

  if (!cachedConfig || now - lastFetch > CACHE_TTL) {
    cachedConfig = await Config.findOne({ isActive: true }).lean();
    lastFetch = now;
  }

  return cachedConfig;
}

module.exports = { getActiveConfig };