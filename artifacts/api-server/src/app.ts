import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import session from "express-session";
import createMemoryStore from "memorystore";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();

const MemoryStore = createMemoryStore(session);

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);

app.use(
  cors({
    origin: true,
    credentials: true,
  }),
);
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

app.use(
  session({
    name: "apexrx.sid",
    secret: process.env["SESSION_SECRET"] ?? "apexrx-pharmacy-dev-session-secret",
    resave: false,
    rolling: true,
    saveUninitialized: false,
    store: new MemoryStore({ checkPeriod: 24 * 60 * 60 * 1000 }),
    cookie: {
      httpOnly: true,
      secure: process.env["NODE_ENV"] === "production",
      sameSite: "lax",
      maxAge: 1000 * 60 * 60 * 12,
    },
  }),
);

app.use("/api", router);

export default app;
