import { NextRequest, NextResponse } from "next/server";
import * as fs from "fs";
import * as path from "path";

/**
 * GET /api/ksef/upo-file?path=FILENAME
 * Serwuje plik UPO z katalogu KSEF_UPO_STORAGE_DIR (tylko nazwa pliku, bez path traversal).
 */
export async function GET(request: NextRequest) {
  const pathParam = request.nextUrl.searchParams.get("path");
  if (!pathParam || pathParam.includes("..") || pathParam.includes("/") || pathParam.includes("\\")) {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }
  const storageDir = process.env.KSEF_UPO_STORAGE_DIR?.trim();
  if (!storageDir) {
    return NextResponse.json({ error: "Storage not configured" }, { status: 503 });
  }
  const dir = path.resolve(process.cwd(), storageDir);
  const filePath = path.join(dir, path.basename(pathParam));
  if (!filePath.startsWith(dir)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  try {
    if (!fs.existsSync(filePath)) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    const buf = fs.readFileSync(filePath);
    const ext = path.extname(pathParam).toLowerCase();
    const contentType =
      ext === ".xml" ? "application/xml" : ext === ".pdf" ? "application/pdf" : "application/octet-stream";
    return new NextResponse(buf, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `inline; filename="${path.basename(pathParam)}"`,
      },
    });
  } catch {
    return NextResponse.json({ error: "Error reading file" }, { status: 500 });
  }
}
