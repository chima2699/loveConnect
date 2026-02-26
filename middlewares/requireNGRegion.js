if (req.user.paymentRegion !== "NG") {
  return res
    .status(403)
    .json({ error: "Payments not available in your region yet" });
}
