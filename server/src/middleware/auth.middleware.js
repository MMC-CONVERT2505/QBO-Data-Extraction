const authMiddleware = (
  req,
  res,
  next
) => {
  const {
    accessToken,
    realmId,
  } = req.session || {};

  if (
    !accessToken ||
    !realmId
  ) {
    return res
      .status(401)
      .json({
        error:
          "Not authenticated. Please connect to QBO.",
      });
  }

  req.accessToken =
    accessToken;

  req.realmId =
    realmId;

  next();
};

export default authMiddleware;