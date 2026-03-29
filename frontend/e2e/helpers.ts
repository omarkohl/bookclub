import { execSync, spawn, type ChildProcess } from "child_process";
import { mkdtempSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, "../..");

export interface TestServer {
  url: string;
  clubUrl: string;
  adminUrl: string;
  apiBase: string;
  adminApiBase: string;
  process: ChildProcess;
  cleanup: () => void;
}

export async function startServer(
  opts: {
    clubSecret?: string;
    adminSecret?: string;
    port?: number;
  } = {},
): Promise<TestServer> {
  const clubSecret = opts.clubSecret ?? "testclub";
  const adminSecret = opts.adminSecret ?? "testadmin";
  const port = opts.port ?? 18081 + Math.floor(Math.random() * 1000);

  // Build the binary
  execSync("make build", { cwd: PROJECT_ROOT, stdio: "pipe" });

  const tmpDir = mkdtempSync(join(tmpdir(), "bookclub-e2e-"));
  const dbPath = join(tmpDir, "test.db");

  const proc = spawn(join(PROJECT_ROOT, "bin/bookclub"), [], {
    env: {
      ...process.env,
      BOOKCLUB_PORT: String(port),
      BOOKCLUB_CLUB_SECRET: clubSecret,
      BOOKCLUB_ADMIN_SECRET: adminSecret,
      BOOKCLUB_DB_PATH: dbPath,
    },
    stdio: "pipe",
  });

  const url = `http://localhost:${port}`;

  // Wait for server to be ready
  await waitForServer(`${url}/api/${clubSecret}/health`, 5000);

  return {
    url,
    clubUrl: `${url}/${clubSecret}/`,
    adminUrl: `${url}/${clubSecret}/admin/${adminSecret}/`,
    apiBase: `${url}/api/${clubSecret}`,
    adminApiBase: `${url}/api/${clubSecret}/admin/${adminSecret}`,
    process: proc,
    cleanup: () => {
      proc.kill();
      rmSync(tmpDir, { recursive: true, force: true });
    },
  };
}

async function waitForServer(url: string, timeoutMs: number): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.ok) return;
    } catch {
      // Server not ready yet
    }
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error(`Server at ${url} did not start within ${timeoutMs}ms`);
}
