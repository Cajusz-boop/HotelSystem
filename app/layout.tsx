import type { Metadata } from "next";
import { Toaster } from "sonner";
import { AppSidebar } from "@/components/app-sidebar";
import { CommandPalette } from "@/components/command-palette";
import { MainClickGuard } from "@/components/main-click-guard";
import { Providers } from "@/components/providers";
import { StatusBar } from "@/components/status-bar";
import { OnboardingGuide } from "@/components/onboarding-guide";
import { KeyboardShortcutsHelp } from "@/components/keyboard-shortcuts-help";
import { FiscalRelay } from "@/components/fiscal-relay";
import { ConnectionMonitor } from "@/components/connection-monitor";
import { SessionGuard } from "@/components/session-guard";
import { getSession } from "@/lib/auth";
import { getMyPermissions } from "@/app/actions/permissions";
import "./globals.css";

// Czcionka systemowa zamiast next/font (Inter) – unikamy zawieszania przy starcie przy wolnym/braku sieci
const fontClass = "font-sans";

export const metadata: Metadata = {
  title: "Hotel Łabędź – System rezerwacji",
  description: "System zarządzania Hotelem Łabędź w Iławie",
};

// Nie prerenderuj stron przy buildzie – unikamy błędów useSearchParams() i brakującej bazy
export const dynamic = "force-dynamic";

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await getSession();
  const permissions = session ? await getMyPermissions() : null;
  return (
    <html lang="pl" suppressHydrationWarning>
      <head>
        <meta charSet="utf-8" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Source+Sans+3:ital,wght@0,400;0,500;0,600;0,700;0,800;0,900;1,400&display=swap" rel="stylesheet" />
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#8B6914" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="Hotel Łabędź" />
        <link rel="apple-touch-icon" href="/icons/icon-192.png" />
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){var t=localStorage.getItem('pms-theme');if(t==='dark')document.documentElement.classList.add('dark');else document.documentElement.classList.remove('dark');})();`,
          }}
        />
        <script
          dangerouslySetInnerHTML={{
            __html: `
if('serviceWorker' in navigator){
  window.addEventListener('load',function(){
    navigator.serviceWorker.register('/sw.js').then(function(reg){
      console.log('[SW] Registered:',reg.scope);
    }).catch(function(err){
      console.log('[SW] Registration failed:',err);
    });
  });
}
`,
          }}
        />
      </head>
      <body className={`${fontClass} pms-allow-clicks`} suppressHydrationWarning>
        {process.env.NEXT_PUBLIC_APP_URL?.includes("/training") && (
          <>
            <div
              style={{
                position: "fixed",
                top: 0,
                left: 0,
                right: 0,
                zIndex: 9999,
                background: "#BA7517",
                color: "#FAEEDA",
                textAlign: "center",
                fontSize: "13px",
                fontWeight: 500,
                padding: "6px",
              }}
            >
              TRYB TRENINGOWY — żadne zmiany nie wpływają na prawdziwy system
            </div>
            <style>{`body { padding-top: 36px; }`}</style>
          </>
        )}
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
  setInterval(fix,200);
})();
`,
          }}
        />
        <Providers>
          <div className="no-print print-preview-hide">
            <ConnectionMonitor />
            <SessionGuard session={session} />
          </div>
          <a href="#main-content" className="skip-link print-preview-hide">
            Przejdź do treści
          </a>
          <div className="no-print print-preview-hide">
            <AppSidebar session={session} permissions={permissions} />
          </div>
          <main
            id="main-content"
            role="main"
            className="flex flex-col min-h-screen max-h-screen bg-background pt-11 md:pt-0 md:pl-12 pms-main-content overflow-hidden print-preview-main"
            style={{ position: "relative", zIndex: 20, pointerEvents: "auto" }}
          >
            <div className="no-print print-preview-hide">
              <StatusBar session={session} />
            </div>
            <div className="flex flex-col flex-1 min-h-0 overflow-auto">
              <MainClickGuard>{children}</MainClickGuard>
            </div>
          </main>
          <div className="no-print print-preview-hide">
            <CommandPalette />
            <KeyboardShortcutsHelp />
            <OnboardingGuide />
            <FiscalRelay />
            <Toaster richColors position="top-right" />
          </div>
        </Providers>
      </body>
    </html>
  );
}
