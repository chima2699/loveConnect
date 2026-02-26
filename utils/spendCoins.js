const User = require("../models/User");

/**
 * Spend coins from a user's wallet
 * - Bonus coins are spent first
 * - Purchased coins are spent last
 */
async function spendCoinsMongo(username, amount) {
  if (!username || amount <= 0) {
    return { ok: false, error: "Invalid spend request" };
  }

  const user = await User.findOne({ username });
  if (!user) {
    return { ok: false, error: "User not found" };
  }

  const balance =
    (user.bonusCoins || 0) +
    (user.purchasedCoins || 0);

  if (balance < amount) {
    return { ok: false, error: "Not enough coins" };
  }

  let remaining = amount;

  // Spend bonus coins first (OLD LOGIC KEPT)
  if ((user.bonusCoins || 0) >= remaining) {
    user.bonusCoins -= remaining;
    remaining = 0;
  } else {
  remaining -= user.bonusCoins || 0;
  user.bonusCoins = 0;

  user.purchasedCoins = (user.purchasedCoins || 0) - remaining;
}

  await user.save();

  return { ok: true };
}

/**
 * Credit coins to a user (used for earnings, tips, unlock income, etc.)
 */
async function creditCoinsMongo(username, amount) {
  if (!username || amount <= 0) {
    return { ok: false, error: "Invalid credit request" };
  }

  const user = await User.findOne({ username });
  if (!user) {
    return { ok: false, error: "User not found" };
  }

  user.purchasedCoins = (user.purchasedCoins || 0) + amount;

  await user.save();

  return { ok: true };
}

module.exports = {
  spendCoinsMongo,
  creditCoinsMongo
};