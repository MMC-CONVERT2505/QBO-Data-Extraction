import express from "express";

import {
  getAuthUrl,
  handleCallback,
  checkAuth,
  logout,
} from "../controller/auth.controller.js";

const router =
  express.Router();

router.get(
  "/url",
  getAuthUrl
);

router.get(
  "/callback",
  handleCallback
);

router.get(
  "/check",
  checkAuth
);

router.post(
  "/logout",
  logout
);

export default router;