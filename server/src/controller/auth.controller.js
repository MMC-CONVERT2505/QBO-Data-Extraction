import OAuthClient from "intuit-oauth";
import crypto from "crypto";
import config from "../config/qbo.config.js";
import {
  clearCacheForRealm,
  createQboToken,
  getQboToken,
  deleteQboToken,
} from "../config/database.js";

const oauthClient = new OAuthClient({
  clientId: config.clientId,
  clientSecret: config.clientSecret,
  environment: config.environment,
  redirectUri: config.redirectUri,
});

const getAuthUrl = (req, res) => {
  const authUri = oauthClient.authorizeUri({
    scope: [OAuthClient.scopes.Accounting],
    state: "qbo-auth-state",
  });

  res.json({ url: authUri });
};

const handleCallback = async (req, res) => {
  try {
    const authResponse = await oauthClient.createToken(
      `${config.redirectUri}?${new URLSearchParams(req.query).toString()}`
    );

    const tokens = authResponse.getJson();
    const realmId = req.query.realmId;

    // ✅ Naya opaque session id banao — yeh frontend ko diya jayega
    const sessionId = crypto.randomBytes(32).toString("hex");

    await createQboToken({
      sessionId,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      realmId,
      companyName: "Production Company",
    });

    // ✅ sessionId ko base64 mein pass karo (ab tokens raw nahi jaate URL mein)
    const tempToken = Buffer.from(
      JSON.stringify({ sessionId })
    ).toString("base64");

    res.redirect(`${process.env.FRONTEND_URL}/dashboard?auth=${tempToken}`);

  } catch (err) {
    console.error("❌ Callback error:", err.message);
    res.status(500).json({ error: err.message });
  }
};

const checkAuth = async (req, res) => {
  try {
    const sessionId = req.headers["x-qbo-session"];
    const tokenDoc = await getQboToken(sessionId);

    const isAuth = !!(tokenDoc?.accessToken && tokenDoc?.realmId);

    res.json({
      isAuthenticated: isAuth,
      companyName: tokenDoc?.companyName || "Production Company",
      realmId: tokenDoc?.realmId || null,
    });
  } catch (err) {
    console.error("❌ checkAuth error:", err.message);
    res.status(500).json({ isAuthenticated: false });
  }
};

const logout = async (req, res) => {
  try {
    const sessionId = req.headers["x-qbo-session"];
    const tokenDoc = await getQboToken(sessionId);

    if (tokenDoc?.realmId) {
      await clearCacheForRealm(tokenDoc.realmId).catch(console.error);
    }

    await deleteQboToken(sessionId);

    res.json({ message: "Logged out successfully" });
  } catch (err) {
    console.error("❌ logout error:", err.message);
    res.status(500).json({ error: "Logout failed" });
  }
};

// ✅ Replaces old setSession — ab sirf sessionId resolve karta hai
// taaki frontend ko realmId/companyName mil jaye (auth=... query se aane ke baad)
const setSession = async (req, res) => {
  try {
    const { sessionId } = req.body;

    if (!sessionId) {
      return res.status(400).json({ error: "Missing sessionId" });
    }

    const tokenDoc = await getQboToken(sessionId);

    if (!tokenDoc) {
      return res.status(401).json({ error: "Invalid or expired session" });
    }

    res.json({
      success: true,
      sessionId,
      realmId: tokenDoc.realmId,
      companyName: tokenDoc.companyName,
    });
  } catch (err) {
    console.error("❌ setSession error:", err.message);
    res.status(500).json({ error: "Session validation failed" });
  }
};

export {
  getAuthUrl,
  handleCallback,
  checkAuth,
  logout,
  setSession,
};