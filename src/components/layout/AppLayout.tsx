import { SidebarProvider, SidebarTrigger, SidebarInset } from '@/components/ui/sidebar';
import { AppSidebar } from './AppSidebar';
import { CentralTelefonica } from '@/components/refery/CentralTelefonica';

interface AppLayoutProps {
  children: React.ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <header className="flex h-14 items-center gap-4 border-b bg-card px-6">
          <SidebarTrigger />
          <div className="flex-1" />
        </header>
        <main className="flex-1 overflow-auto p-6">
          {children}
        </main>
      </SidebarInset>
      <CentralTelefonica />
    </SidebarProvider>
  );
}
