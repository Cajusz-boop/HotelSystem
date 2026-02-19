import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import path from "node:path";
import fs from "node:fs/promises";

const INSTALLER_FILES = [
  "server.mjs",
  "posnet-protocol.mjs",
  "bridge.env",
  "bridge-silent.vbs",
  "install-autostart.ps1",
  "URUCHOM-BRIDGE.bat",
  "ZAINSTALUJ-AUTOSTART.bat",
  "ODINSTALUJ-AUTOSTART.bat",
  "TEST-BRIDGE.bat",
  "INSTRUKCJA.md",
];

/**
 * Minimal ZIP file builder (no external dependencies).
 * Creates a valid ZIP archive with stored (uncompressed) files.
 * Sufficient for small text files like the bridge installer.
 */
function buildZip(files: { name: string; data: Buffer }[]): Buffer {
  const entries: { name: Buffer; data: Buffer; offset: number }[] = [];
  const parts: Buffer[] = [];
  let offset = 0;

  for (const file of files) {
    const nameBytes = Buffer.from(file.name, "utf-8");
    const data = file.data;

    const crc = crc32(data);
    const localHeader = Buffer.alloc(30 + nameBytes.length);
    localHeader.writeUInt32LE(0x04034b50, 0); // local file header signature
    localHeader.writeUInt16LE(20, 4);          // version needed
    localHeader.writeUInt16LE(0, 6);           // general purpose bit flag
    localHeader.writeUInt16LE(0, 8);           // compression method (stored)
    localHeader.writeUInt16LE(0, 10);          // last mod file time
    localHeader.writeUInt16LE(0, 12);          // last mod file date
    localHeader.writeUInt32LE(crc, 14);        // crc-32
    localHeader.writeUInt32LE(data.length, 18); // compressed size
    localHeader.writeUInt32LE(data.length, 22); // uncompressed size
    localHeader.writeUInt16LE(nameBytes.length, 26); // file name length
    localHeader.writeUInt16LE(0, 28);          // extra field length
    nameBytes.copy(localHeader, 30);

    entries.push({ name: nameBytes, data, offset });
    parts.push(localHeader, data);
    offset += localHeader.length + data.length;
  }

  const centralStart = offset;
  for (const entry of entries) {
    const centralHeader = Buffer.alloc(46 + entry.name.length);
    const crc = crc32(entry.data);
    centralHeader.writeUInt32LE(0x02014b50, 0); // central directory header signature
    centralHeader.writeUInt16LE(20, 4);          // version made by
    centralHeader.writeUInt16LE(20, 6);          // version needed
    centralHeader.writeUInt16LE(0, 8);           // general purpose bit flag
    centralHeader.writeUInt16LE(0, 10);          // compression method
    centralHeader.writeUInt16LE(0, 12);          // last mod file time
    centralHeader.writeUInt16LE(0, 14);          // last mod file date
    centralHeader.writeUInt32LE(crc, 16);        // crc-32
    centralHeader.writeUInt32LE(entry.data.length, 20); // compressed size
    centralHeader.writeUInt32LE(entry.data.length, 24); // uncompressed size
    centralHeader.writeUInt16LE(entry.name.length, 28); // file name length
    centralHeader.writeUInt16LE(0, 30);          // extra field length
    centralHeader.writeUInt16LE(0, 32);          // file comment length
    centralHeader.writeUInt16LE(0, 34);          // disk number start
    centralHeader.writeUInt16LE(0, 36);          // internal file attributes
    centralHeader.writeUInt32LE(0, 38);          // external file attributes
    centralHeader.writeUInt32LE(entry.offset, 42); // relative offset of local header
    entry.name.copy(centralHeader, 46);

    parts.push(centralHeader);
    offset += centralHeader.length;
  }

  const centralSize = offset - centralStart;
  const endRecord = Buffer.alloc(22);
  endRecord.writeUInt32LE(0x06054b50, 0);        // end of central directory signature
  endRecord.writeUInt16LE(0, 4);                  // number of this disk
  endRecord.writeUInt16LE(0, 6);                  // disk where central directory starts
  endRecord.writeUInt16LE(entries.length, 8);     // number of central directory records on this disk
  endRecord.writeUInt16LE(entries.length, 10);    // total number of central directory records
  endRecord.writeUInt32LE(centralSize, 12);       // size of central directory
  endRecord.writeUInt32LE(centralStart, 16);      // offset of start of central directory
  endRecord.writeUInt16LE(0, 20);                 // comment length
  parts.push(endRecord);

  return Buffer.concat(parts);
}

const CRC32_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) {
      c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    }
    table[i] = c;
  }
  return table;
})();

function crc32(buf: Buffer): number {
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) {
    crc = CRC32_TABLE[(crc ^ buf[i]) & 0xFF] ^ (crc >>> 8);
  }
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const installerDir = path.join(process.cwd(), "posnet-bridge-installer");

    const files: { name: string; data: Buffer }[] = [];
    for (const fileName of INSTALLER_FILES) {
      const filePath = path.join(installerDir, fileName);
      try {
        const data = await fs.readFile(filePath);
        files.push({ name: `posnet-bridge-installer/${fileName}`, data });
      } catch {
        // Skip missing files
      }
    }

    if (files.length === 0) {
      return NextResponse.json(
        { error: "Brak plików instalatora bridge" },
        { status: 500 }
      );
    }

    const zipBuffer = buildZip(files);

    return new Response(zipBuffer as unknown as BodyInit, {
      status: 200,
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": "attachment; filename=posnet-bridge-installer.zip",
        "Content-Length": String(zipBuffer.length),
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Błąd generowania ZIP";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
