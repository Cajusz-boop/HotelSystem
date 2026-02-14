import { NextRequest, NextResponse } from "next/server";
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

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const allowed = await can(session.role, "admin.settings");
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const confirm = request.nextUrl.searchParams.get("confirm");
  if (confirm !== "restore") {
    return NextResponse.json(
      { error: "Add ?confirm=restore to confirm restore. This will replace the current database." },
      { status: 400 }
    );
  }

  const raw = process.env.DATABASE_URL;
  if (!raw) return NextResponse.json({ error: "DATABASE_URL not configured" }, { status: 500 });
  const params = parseDatabaseUrl(raw);
  if (!params) return NextResponse.json({ error: "Invalid DATABASE_URL" }, { status: 500 });

  let sql: string;
  const contentType = request.headers.get("content-type") ?? "";
  if (contentType.includes("multipart/form-data")) {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    if (!file) return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    sql = await file.text();
  } else {
    sql = await request.text();
  }

  if (!sql || sql.length < 100) {
    return NextResponse.json({ error: "Invalid or empty SQL dump" }, { status: 400 });
  }
  if (!sql.includes("CREATE TABLE") && !sql.includes("INSERT INTO")) {
    return NextResponse.json({ error: "File does not look like a MySQL dump" }, { status: 400 });
  }

  const { spawn } = await import("child_process");
  const isWin = process.platform === "win32";
  const mysql = isWin ? "mysql.exe" : "mysql";

  const env = { ...process.env };
  if (params.password) env.MYSQL_PWD = params.password;

  return new Promise<NextResponse>((resolve) => {
    const child = spawn(
      mysql,
      ["-h", params.host, "-P", String(params.port), "-u", params.user, params.database],
      { env, stdio: ["pipe", "pipe", "pipe"] }
    );

    const errChunks: Buffer[] = [];
    child.stderr?.on("data", (chunk: Buffer) => errChunks.push(chunk));

    child.on("error", (err) => {
      resolve(
        NextResponse.json(
          { error: "mysql client not available: " + (err.message || "install MySQL/MariaDB client") },
          { status: 503 }
        )
      );
    });

    child.stdin?.write(sql, "utf8", () => {
      child.stdin?.end();
    });

    child.on("close", (code) => {
      if (code !== 0) {
        const stderr = Buffer.concat(errChunks).toString("utf8");
        resolve(NextResponse.json({ error: "Restore failed", detail: stderr || "non-zero exit" }, { status: 500 }));
        return;
      }
      resolve(NextResponse.json({ success: true, message: "Restore completed" }));
    });
  });
}
