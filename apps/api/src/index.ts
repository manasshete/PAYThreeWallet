import { createApp } from "./app.js";
import { authBackend, databaseProvider } from "./auth-store.js";

const app = createApp();
const port = Number(process.env.PORT ?? 4000);

// Vercel sets VERCEL=1 — export the app for serverless; otherwise listen.
export default app;

if (!process.env.VERCEL) {
  app.listen(port, () => {
    const backend = authBackend();
    console.log(`pay3-api listening on http://localhost:${port}`);
    if (backend === "memory") {
      console.warn(
        "DATABASE_URL not configured — using in-memory auth. See docs/DATABASE.md for Neon setup."
      );
    } else {
      console.log(`database: ${databaseProvider() ?? "PostgreSQL"}`);
    }
  });
}
