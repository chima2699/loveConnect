module.exports = async (req, res, next) => {
  if (!req.user.phoneVerified) {
    return res
      .status(403)
      .json({ error: "Verify phone to access wallet" });
  }
  next();
};
