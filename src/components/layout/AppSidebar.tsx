import { Link, useLocation } from 'react-router-dom';
import {
  Sidebar, SidebarContent, SidebarFooter, SidebarGroup,
  SidebarGroupContent, SidebarGroupLabel, SidebarHeader,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem,
} from '@/components/ui/sidebar';
import { useAuth } from '@/hooks/useAuth';
import { useConta, useCurrentUserRole } from '@/hooks/useRefery';
import { Button } from '@/components/ui/button';
import {
  LayoutDashboard, Users, UserCheck, CalendarDays, GitBranch,
  Settings, LogOut, Crown, TrendingUp, MessageCircle,
} from 'lucide-react';

const menuPrincipal = [
  { title: 'Dashboard', url: '/dashboard', icon: LayoutDashboard, apenasOwner: true },
  { title: 'Indicações', url: '/indicacoes', icon: Users, apenasOwner: false },
  { title: 'Funil de Conversão', url: '/funil', icon: TrendingUp, apenasOwner: true },
  { title: 'Clientes Ativos', url: '/clientes', icon: UserCheck, apenasOwner: false },
  { title: 'WhatsApp CRM', url: '/whatsapp', icon: MessageCircle, apenasOwner: false },
  { title: 'Agenda de Ligações', url: '/agenda', icon: CalendarDays, apenasOwner: false },
  { title: 'Árvore de Indicações', url: '/arvore', icon: GitBranch, apenasOwner: true },
];

export function AppSidebar() {
  const location = useLocation();
  const { signOut, user } = useAuth();
  const { data: conta } = useConta();
  const role = useCurrentUserRole();
  const isOwner = role === 'life_planner';

  const menuFiltrado = menuPrincipal.filter(m => !m.apenasOwner || isOwner);

  return (
    <Sidebar>
      <SidebarHeader className="border-b border-sidebar-border p-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center shadow-sm">
            <GitBranch className="h-5 w-5 text-white" />
          </div>
          <div>
            <h2 className="font-bold text-sidebar-foreground text-base leading-tight">REFERY</h2>
            <p className="text-xs text-sidebar-foreground/50 leading-tight">
              {conta?.nome_empresa ?? 'CRM de Seguros'}
            </p>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Menu Principal</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuFiltrado.map(item => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild isActive={location.pathname === item.url}>
                    <Link to={item.url}>
                      <item.icon />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {isOwner && (
          <SidebarGroup>
            <SidebarGroupLabel>Conta</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={location.pathname === '/usuarios'}>
                    <Link to="/usuarios">
                      <Crown />
                      <span>Usuários</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={location.pathname === '/configuracoes'}>
                    <Link to="/configuracoes">
                      <Settings />
                      <span>Configurações</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border p-4">
        <div className="flex items-center justify-between">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-sidebar-foreground truncate">
              {conta?.nome_life_planner || user?.email}
            </p>
            <p className="text-xs text-sidebar-foreground/50 truncate">{user?.email}</p>
          </div>
          <Button
            variant="ghost" size="icon" onClick={signOut}
            className="text-sidebar-foreground hover:bg-sidebar-accent"
          >
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
