import { getQboToken } from "../config/database.js";

const authMiddleware = async (req, res, next) => {
  try {
    const sessionId = req.headers["x-qbo-session"];

    if (!sessionId) {
      return res.status(401).json({
        error: "Not authenticated. Please connect to QBO.",
      });
    }

    const tokenDoc = await getQboToken(sessionId);

    if (!tokenDoc?.accessToken || !tokenDoc?.realmId) {
      return res.status(401).json({
        error: "Not authenticated. Please connect to QBO.",
      });
    }

    req.accessToken = tokenDoc.accessToken;
    req.realmId      = tokenDoc.realmId;
    req.sessionId     = sessionId; // ✅ useful agar refresh logic add karna ho future mein

    next();
  } catch (err) {
    console.error("❌ authMiddleware error:", err.message);
    res.status(500).json({ error: "Auth check failed" });
  }
};

export default authMiddleware;