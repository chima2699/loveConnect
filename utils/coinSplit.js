// utils/coinSplit.js

/**
 * Splits coins between admin and user
 * @param {Object} params
 * @param {number} params.amount - total coins
 * @param {number} params.adminPercent - admin percentage (0–100)
 */
function splitCoins({ amount, adminPercent }) {
  const total = Number(amount);
  const percent = Number(adminPercent);

  if (!Number.isFinite(total) || total <= 0) {
    return { adminCoins: 0, userCoins: 0 };
  }

  if (!Number.isFinite(percent) || percent <= 0) {
    return { adminCoins: 0, userCoins: total };
  }

  if (percent >= 100) {
    return { adminCoins: total, userCoins: 0 };
  }

  // Admin cut (rounded DOWN to avoid overcharging users)
  const adminCoins = Math.floor((total * percent) / 100);

  // User always gets the remainder
  const userCoins = total - adminCoins;

  return { adminCoins, userCoins };
}

module.exports = { splitCoins };