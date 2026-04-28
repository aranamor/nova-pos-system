import type { Request, Response, NextFunction } from "express";
import { db } from "@workspace/db";
import { userSessionsTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";

// Blocks requests if the current session id has been revoked admin-side
// or via /sessions/:id/revoke.
export async function sessionRevocationGuard(req: Request, res: Response, next: NextFunction) {
  const sid = req.sessionID;
  if (!sid) return next();
  try {
    const [row] = await db
      .select({ revokedAt: userSessionsTable.revokedAt })
      .from(userSessionsTable)
      .where(eq(userSessionsTable.id, sid))
      .limit(1);
    if (row?.revokedAt) {
      req.session.destroy(() => {});
      return res.status(401).json({ error: "Session revoked" });
    }
  } catch {
    // on db error, fail open (do not lock everyone out)
  }
  next();
}
