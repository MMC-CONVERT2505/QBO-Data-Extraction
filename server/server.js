import dotenv from "dotenv";
import express from "express";
import cors from "cors";
import session from "express-session";
import sessionFileStore from "session-file-store";

import authRoutes from "./src/routes/auth.routes.js";
import allocationRoutes from "./src/routes/allocation.routes.js";

dotenv.config();

const app = express();
const FileStore = sessionFileStore(session);

app.use(
  cors({
    origin: process.env.FRONTEND_URL,
    credentials: true,
  })
);

app.use(express.json());

app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    // ✅ File store — refresh pe logout nahi hoga
    store: new FileStore({
      path: './sessions',        // sessions folder mein save hoga
      ttl: 86400,                // 24 hours
      retries: 1,
    }),
    cookie: {
      secure: false,
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000,  // 24 hours
    },
  })
);

app.use("/api/auth", authRoutes);
app.use("/api/allocation", allocationRoutes);

app.get("/health", (req, res) => res.json({ status: "OK" }));

const PORT = process.env.PORT || 7002;

app.listen(PORT, () =>
  console.log(`✅ Server running on port ${PORT}`)
);