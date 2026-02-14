import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import { existsSync } from "fs";
import path from "path";

function parseDatabaseUrl(url: string): { host: string; port: number; user: string; password: string; database: string } | null {
  try {
    const u = new URL(url.replace(/^mysql:\/\//, "http://"));
    const host = u.hostname || "localhost";
    const port = u.port ? parseInt(u.port, 10) : 3306;
    const user = decodeURIComponent(u.username || "root");
    const password = decodeURIComponent(u.password || "");
    const database = u.pathname?.replace(/^\//, "") || "hotel_pms";
    return { host, port, user, password, database };
  } catch {
    return null;
  }
}

/**
 * GET/POST /api/cron/backup
 * Automatyczna kopia zapasowa bazy (wywołane przez crona).
 * Wymaga: CRON_SECRET (Bearer), BACKUP_DIR (katalog do zapisu plików .sql).
 */
export async function GET(request: NextRequest) {
  return runBackup(request);
}

export async function POST(request: NextRequest) {
  return runBackup(request);
}

async function runBackup(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = request.headers.get("authorization");
    const token = auth?.startsWith("Bearer ") ? auth.slice(7) : "";
    if (token !== cronSecret) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const backupDir = process.env.BACKUP_DIR;
  if (!backupDir?.trim()) {
    return NextResponse.json({ error: "BACKUP_DIR not configured" }, { status: 503 });
  }

  const raw = process.env.DATABASE_URL;
  if (!raw) return NextResponse.json({ error: "DATABASE_URL not configured" }, { status: 500 });
  const params = parseDatabaseUrl(raw);
  if (!params) return NextResponse.json({ error: "Invalid DATABASE_URL" }, { status: 500 });

  const { spawn } = await import("child_process");
  const isWin = process.platform === "win32";
  const mysqldump = isWin ? "mysqldump.exe" : "mysqldump";

  const env = { ...process.env };
  if (params.password) env.MYSQL_PWD = params.password;

  const sql = await new Promise<string>((resolve, reject) => {
    const child = spawn(
      mysqldump,
      [
        "-h", params.host,
        "-P", String(params.port),
        "-u", params.user,
        "--single-transaction",
        "--routines",
        "--triggers",
        params.database,
      ],
      { env, stdio: ["ignore", "pipe", "pipe"] }
    );

    const outChunks: Buffer[] = [];
    const errChunks: Buffer[] = [];
    child.stdout?.on("data", (chunk: Buffer) => outChunks.push(chunk));
    child.stderr?.on("data", (chunk: Buffer) => errChunks.push(chunk));

    child.on("error", (err) => reject(err));
    child.on("close", (code) => {
      if (code !== 0) reject(new Error(Buffer.concat(errChunks).toString("utf8") || "mysqldump failed"));
      else resolve(Buffer.concat(outChunks).toString("utf8"));
    });
  });

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const filename = `backup_${params.database}_${timestamp}.sql`;
  const dir = path.resolve(backupDir);
  if (!existsSync(dir)) {
    await mkdir(dir, { recursive: true });
  }
  const filepath = path.join(dir, filename);
  await writeFile(filepath, sql, "utf8");

  return NextResponse.json({ success: true, file: filename, path: filepath });
}
