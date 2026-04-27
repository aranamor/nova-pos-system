import { Router, type IRouter } from "express";
import { db, settingsTable } from "@workspace/db";
import { sql } from "drizzle-orm";

const router: IRouter = Router();

router.get("/settings", async (req, res) => {
  try {
    const rows = await db.select().from(settingsTable);
    const obj: Record<string, string | number> = {};
    rows.forEach((r) => {
      if (r.settingValue !== null) obj[r.settingKey] = r.settingValue;
    });
    if (obj.lowStockThreshold !== undefined) obj.lowStockThreshold = Number(obj.lowStockThreshold);
    res.json(obj);
  } catch (err) {
    req.log?.error({ err }, "GET /settings failed");
    res.status(500).json({ error: "Failed to fetch settings" });
  }
});

router.post("/settings", async (req, res) => {
  try {
    const newSettings = (req.body?.settings ?? req.body) as Record<string, unknown>;
    for (const key of Object.keys(newSettings)) {
      const value = String(newSettings[key]);
      await db
        .insert(settingsTable)
        .values({ settingKey: key, settingValue: value })
        .onConflictDoUpdate({
          target: settingsTable.settingKey,
          set: { settingValue: sql`EXCLUDED.setting_value` },
        });
    }
    res.json({ message: "Settings saved" });
  } catch (err) {
    req.log?.error({ err }, "POST /settings failed");
    res.status(500).json({ error: "Failed to save settings" });
  }
});

export default router;
