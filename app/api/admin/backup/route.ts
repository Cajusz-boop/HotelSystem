import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { can } from "@/lib/permissions";

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

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const allowed = await can(session.role, "admin.settings");
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const raw = process.env.DATABASE_URL;
  if (!raw) return NextResponse.json({ error: "DATABASE_URL not configured" }, { status: 500 });
  const params = parseDatabaseUrl(raw);
  if (!params) return NextResponse.json({ error: "Invalid DATABASE_URL" }, { status: 500 });

  const { spawn } = await import("child_process");
  const isWin = process.platform === "win32";
  const mysqldump = isWin ? "mysqldump.exe" : "mysqldump";

  return new Promise<NextResponse>((resolve) => {
    const env = { ...process.env };
    if (params.password) env.MYSQL_PWD = params.password;

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

    child.on("error", (err) => {
      resolve(
        NextResponse.json(
          { error: "mysqldump not available: " + (err.message || "install MySQL/MariaDB client") },
          { status: 503 }
        )
      );
    });

    child.on("close", (code) => {
      if (code !== 0) {
        const stderr = Buffer.concat(errChunks).toString("utf8");
        resolve(NextResponse.json({ error: "Backup failed", detail: stderr || "non-zero exit" }, { status: 500 }));
        return;
      }
      const sql = Buffer.concat(outChunks).toString("utf8");
      const filename = `backup_${params.database}_${new Date().toISOString().slice(0, 10)}.sql`;
      resolve(
        new NextResponse(sql, {
          status: 200,
          headers: {
            "Content-Type": "application/sql",
            "Content-Disposition": `attachment; filename="${filename}"`,
          },
        })
      );
    });
  });
}
