// Load .env FIRST — must be before any module that reads process.env
import "./env.js";
import { createEditorApp } from "./createApp.js";

const app = await createEditorApp();

// PORT=0 → OS assigns an ephemeral port at bind time. Otherwise, use the requested port.
const requestedPort = parseInt(process.env.PORT || "3001", 10);

const server = app.listen(requestedPort, "127.0.0.1", () => {
  const { port } = server.address();
  console.log(`Server is running on http://127.0.0.1:${port}`);
  console.log(`Environment: ${process.env.NODE_ENV || "development"}`);

  // When spawned by Electron's utilityProcess.fork(), report the actual bound
  // port back to the parent so it can build the renderer URL without guessing.
  if (process.parentPort) {
    process.parentPort.postMessage({ type: "server-ready", port });
  }
});

server.on("error", (err) => {
  console.error(`Server failed to start on port ${requestedPort}: ${err.message}`);
  process.exit(1);
});
