import express from "express";
import cors from "cors";
import compression from "compression";
import cookieParser from "cookie-parser";
import { env } from "./config/env";
import routes from "./routes";
import { notFoundMiddleware, errorMiddleware } from "./middleware/errorMiddleware";

export function createApp() {
  const app = express();

  // Gzips REST responses (history/scoreboard payloads especially) - cheap
  // CPU cost, meaningfully smaller transfers on slow mobile connections.
  app.use(compression());
  app.use(
    cors({
      origin: env.clientOrigin,
      credentials: true,
    })
  );
  app.use(express.json());
  app.use(cookieParser());

  app.get("/health", (_req, res) => res.status(200).json({ status: "ok" }));

  app.use("/api", routes);

  app.use(notFoundMiddleware);
  app.use(errorMiddleware);

  return app;
}
