const jwt = require("jsonwebtoken");

module.exports = (req, res, next) => {
  const auth = req.headers.authorization;

  if (!auth || !auth.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const token = auth.split(" ")[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // ✅ user stored correctly
  } catch (err) {
    return res.status(401).json({ error: "Invalid token" });
  }

  // 🔒 Account checks
  if (req.user.banned) {
    return res.status(403).json({ error: "Account banned" });
  }

  if (
    req.user.suspendedUntil &&
    new Date(req.user.suspendedUntil) > new Date()
  ) {
    return res.status(403).json({
      error: `Account suspended until ${new Date(
        req.user.suspendedUntil
      ).toLocaleString()}`
    });
  }

  next(); // ✅ MUST be last
};