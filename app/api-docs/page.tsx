"use client";

import { useEffect, useRef } from "react";

export default function ApiDocsPage() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const base = typeof window !== "undefined" ? window.location.origin : "";
    const specUrl = `${base}/api/openapi`;
    containerRef.current.innerHTML = `
      <iframe
        src="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5.9.0/index.html?url=${encodeURIComponent(specUrl)}"
        style="width:100%;height:calc(100vh - 2rem);border:0;"
        title="Swagger UI"
      />
    `;
  }, []);

  return (
    <div className="p-4">
      <h1 className="mb-2 text-xl font-semibold">Dokumentacja API (OpenAPI / Swagger)</h1>
      <p className="mb-4 text-sm text-muted-foreground">
        API zewnętrzne dla integracji: dostępność pokoi, obciążenia. Autoryzacja: nagłówek <code>X-API-Key</code> lub <code>Authorization: Bearer &lt;key&gt;</code>.
      </p>
      <div ref={containerRef} />
    </div>
  );
}
