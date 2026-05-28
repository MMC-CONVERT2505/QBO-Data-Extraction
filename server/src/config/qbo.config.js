import dotenv from "dotenv";

dotenv.config();

const qboConfig = {
  clientId: process.env.QBO_CLIENT_ID,

  clientSecret: process.env.QBO_CLIENT_SECRET,

  redirectUri: process.env.QBO_REDIRECT_URI,

  environment: process.env.QBO_ENVIRONMENT || "sandbox",

  scopes: ["com.intuit.quickbooks.accounting"],

  baseUrl:
    process.env.QBO_ENVIRONMENT === "production"
      ? "https://quickbooks.api.intuit.com"
      : "https://sandbox-quickbooks.api.intuit.com",
};

export default qboConfig;