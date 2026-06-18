import dotenv from "dotenv";
import express from "express";
import cors from "cors";
import connectDB from './src/config/database.js';

import authRoutes from "./src/routes/auth.routes.js";
import allocationRoutes from "./src/routes/allocation.routes.js";

dotenv.config();
await connectDB();

const app = express();

app.use(
  cors({
    origin: [
      process.env.FRONTEND_URL,
      'https://unartistic-extroversively-cornell.ngrok-free.dev',
    ],
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization', 'x-qbo-session'], // ✅ custom header allow karo
  })
);

app.use(express.json());

app.use("/api/auth", authRoutes);
app.use("/api/allocation", allocationRoutes);

app.get("/health", (req, res) => res.json({ status: "OK" }));

const PORT = process.env.PORT || 7002;

app.listen(PORT, () =>
  console.log(`✅ Server running on port ${PORT}`)
);