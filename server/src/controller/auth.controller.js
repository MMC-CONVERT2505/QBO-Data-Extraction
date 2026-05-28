import OAuthClient from "intuit-oauth";
import config from "../config/qbo.config.js";

const oauthClient =
  new OAuthClient({
    clientId:
      config.clientId,

    clientSecret:
      config.clientSecret,

    environment:
      config.environment,

    redirectUri:
      config.redirectUri,
  });

const getAuthUrl = (
  req,
  res
) => {
  const authUri =
    oauthClient.authorizeUri({
      scope: [
        OAuthClient.scopes
          .Accounting,
      ],

      state:
        "qbo-auth-state",
    });

  res.json({
    url: authUri,
  });
};
const handleCallback = async (req, res) => {
  try {
    const authResponse = await oauthClient.createToken(
      `${config.redirectUri}?${new URLSearchParams(req.query).toString()}`
    );

    const tokens = authResponse.getJson();

    req.session.accessToken = tokens.access_token;
    req.session.refreshToken = tokens.refresh_token;  // ✅ Refresh token bhi save karo
    req.session.realmId = req.query.realmId;
    req.session.companyName = 'Sandbox Company';

    // Session explicitly save karo redirect se pehle
    req.session.save((err) => {
      if (err) {
        console.error('Session save error:', err);
        return res.status(500).json({ error: 'Session save failed' });
      }
      res.redirect(`${process.env.FRONTEND_URL}/dashboard`);
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const checkAuth = (req, res) => {
  const isAuth = !!(
    req.session?.accessToken &&
    req.session?.realmId
  );

  res.json({
    isAuthenticated: isAuth,
    // Frontend ko company info bhi do
    companyName: req.session?.companyName || 'Sandbox Company',
    realmId: req.session?.realmId || null,
  });
};

const logout = (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ error: 'Logout failed' });
    }
    res.clearCookie('connect.sid');
    res.json({ message: 'Logged out successfully' });
  });
};

export {
  getAuthUrl,
  handleCallback,
  checkAuth,
  logout,
};