// middlewares/requireWalletAccess.js
module.exports = async (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  if (req.user.banned) {
    return res.status(403).json({ error: "Account is banned" });
  }

  next();
};
