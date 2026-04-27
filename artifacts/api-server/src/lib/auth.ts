import type { Request, Response, NextFunction } from "express";

declare module "express-session" {
  interface SessionData {
    loggedIn?: boolean;
    username?: string;
  }
}

export const USERNAME = "gmtr004";
export const PASSWORD = "art123";

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (req.session && req.session.loggedIn) {
    return next();
  }
  res.status(401).json({ error: "Not authenticated" });
}
