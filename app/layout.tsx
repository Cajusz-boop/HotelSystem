import type { Metadata } from "next";
import { Toaster } from "sonner";
import { AppSidebar } from "@/components/app-sidebar";
import { CommandPalette } from "@/components/command-palette";
import { MainClickGuard } from "@/components/main-click-guard";
import { Providers } from "@/components/providers";
import { StatusBar } from "@/components/status-bar";
import { OnboardingGuide } from "@/components/onboarding-guide";
import { KeyboardShortcutsHelp } from "@/components/keyboard-shortcuts-help";
import { getSession } from "@/lib/auth";
import { getMyPermissions } from "@/app/actions/permissions";
import "./globals.css";

// Czcionka systemowa zamiast next/font (Inter) – unikamy zawieszania przy starcie przy wolnym/braku sieci
const fontClass = "font-sans";

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
  const permissions = session ? await getMyPermissions() : null;
  return (
    <html lang="pl" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){var t=localStorage.getItem('pms-theme');var d=window.matchMedia('(prefers-color-scheme: dark)').matches;if(t==='dark'||(t!=='light'&&d))document.documentElement.classList.add('dark');else document.documentElement.classList.remove('dark');})();`,
          }}
        />
      </head>
      <body className={`${fontClass} pms-allow-clicks`} suppressHydrationWarning>
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
          <a href="#main-content" className="skip-link">
            Przejdź do treści
          </a>
          <div className="no-print">
            <AppSidebar session={session} permissions={permissions} />
          </div>
          <main
            id="main-content"
            role="main"
            className="min-h-screen bg-gray-50 pl-0 pt-14 md:pl-52 md:pt-0 pms-main-content"
            style={{ position: "relative", zIndex: 20, pointerEvents: "auto" }}
          >
            <StatusBar session={session} />
            <MainClickGuard>{children}</MainClickGuard>
          </main>
          <div className="no-print">
            <CommandPalette />
            <KeyboardShortcutsHelp />
            <OnboardingGuide />
            <Toaster richColors position="top-right" />
          </div>
        </Providers>
      </body>
    </html>
  );
}
