import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Toaster } from "sonner";
import { AppSidebar } from "@/components/app-sidebar";
import { CommandPalette } from "@/components/command-palette";
import { MainClickGuard } from "@/components/main-click-guard";
import { Providers } from "@/components/providers";
import { getSession } from "@/lib/auth";
import "./globals.css";

const inter = Inter({ subsets: ["latin", "latin-ext"] });

export const metadata: Metadata = {
  title: "Hotel PMS – System rezerwacji",
  description: "System zarządzania hotelem",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await getSession();
  return (
    <html lang="pl">
      <body className={inter.className}>
        {/* Wymusza klikalność: Radix zostawia pointer-events:none na body – co 50ms dodajemy klasę gdy żaden overlay nie jest otwarty; CSS z !important nadpisuje inline. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
(function(){
  function fix(){
    if(!document.body)return;
    var open=document.querySelector('[data-state="open"]');
    if(!open){
      document.body.classList.add('pms-allow-clicks');
      document.body.style.removeProperty('pointer-events');
      document.body.style.pointerEvents='auto';
      if(document.documentElement){ document.documentElement.style.removeProperty('pointer-events'); }
      var main=document.querySelector('main');
      if(main){ main.style.pointerEvents='auto'; main.style.zIndex='20'; main.style.position='relative'; }
    }else{
      document.body.classList.remove('pms-allow-clicks');
    }
  }
  fix();
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',fix);
  setInterval(fix,50);
})();
`,
          }}
        />
        <Providers>
          <div className="no-print">
            <AppSidebar session={session} />
          </div>
          <main
            className="min-h-screen bg-gray-50 pl-52 pms-main-content"
            style={{ position: "relative", zIndex: 20, pointerEvents: "auto" }}
          >
            <MainClickGuard>{children}</MainClickGuard>
          </main>
          <div className="no-print">
            <CommandPalette />
            <Toaster richColors position="top-right" />
          </div>
        </Providers>
      </body>
    </html>
  );
}
