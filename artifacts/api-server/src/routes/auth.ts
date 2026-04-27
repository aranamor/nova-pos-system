import { Router, type IRouter } from "express";
import { USERNAME, PASSWORD } from "../lib/auth";

const router: IRouter = Router();

router.post("/login", (req, res) => {
  const { username, password } = req.body ?? {};
  if (username === USERNAME && password === PASSWORD) {
    req.session.loggedIn = true;
    req.session.username = username;
    return res.json({ success: true, message: "Login successful", username });
  }
  res.status(401).json({ success: false, message: "Invalid username or password" });
});

router.post("/logout", (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      req.log?.error({ err }, "logout failed");
      return res.status(500).json({ message: "Could not log out." });
    }
    res.clearCookie("apexrx.sid");
    res.json({ success: true, message: "Logged out successfully" });
  });
});

router.get("/me", (req, res) => {
  if (req.session && req.session.loggedIn) {
    return res.json({ loggedIn: true, username: req.session.username ?? null });
  }
  res.json({ loggedIn: false });
});

export default router;
