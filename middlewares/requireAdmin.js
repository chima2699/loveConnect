const jwt = require("jsonwebtoken");

module.exports = function requireAdminToken(req, res, next) {
  const token = req.headers["x-admin-token"];

  if (!token) {
    return res.status(401).json({ error: "Admin token required" });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    if (!decoded.admin) {
      return res.status(403).json({ error: "Admin only" });
    }

    req.admin = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: "Invalid admin token" });
  }
};