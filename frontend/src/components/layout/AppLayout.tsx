import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { TopNavigation } from './TopNavigation';
import { Sidebar } from './Sidebar';
import { NotificationsPanel } from './NotificationsPanel';
import { WelcomeGuideProvider } from '../WelcomeGuide';
import { Footer } from '../Footer';

export function AppLayout() {
  const [notifOpen, setNotifOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  return (
    <WelcomeGuideProvider>
      <div className="min-h-screen bg-[#f7f9fb] text-[#191c1e] flex flex-col antialiased">
        <TopNavigation
          onOpenNotifications={() => setNotifOpen(true)}
          onToggleMobileNav={() => setMobileNavOpen((v) => !v)}
        />

        <div className="flex-1 flex max-w-7xl w-full mx-auto">
          <Sidebar mobileOpen={mobileNavOpen} onClose={() => setMobileNavOpen(false)} />
          <main className="flex-1 min-w-0 overflow-x-hidden flex flex-col">
            <div className="flex-1 p-4 md:p-6 lg:p-8">
              <Outlet />
            </div>
            <Footer />
          </main>
        </div>

        {notifOpen && <NotificationsPanel onClose={() => setNotifOpen(false)} />}
      </div>
    </WelcomeGuideProvider>
  );
}
