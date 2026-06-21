import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useUsuariosConta, useCurrentUserRole, useConta } from '@/hooks/useRefery';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/integrations/firebase/client';
import { toast } from 'sonner';
import { UserPlus, Mail, Shield, User, Crown, Loader2, Info } from 'lucide-react';

export default function UsuariosPage() {
  const { data: usuarios = [] } = useUsuariosConta();
  const role = useCurrentUserRole();
  const { data: conta } = useConta();
  const [emailConvite, setEmailConvite] = useState('');
  const [enviando, setEnviando] = useState(false);

  const isOwner = role === 'life_planner';

  const convidarAssistente = async () => {
    if (!emailConvite.trim() || !conta) return;
    setEnviando(true);
    try {
      const email = emailConvite.trim().toLowerCase();

      // Salva convite no Firestore — quando a assistente criar conta com este e-mail
      // ela será vinculada automaticamente à sua conta
      await setDoc(doc(db, 'convites', email), {
        conta_id: conta.id,
        role: 'assistente',
        convidado_por: conta.nome_life_planner,
        created_at: serverTimestamp(),
      });

      toast.success(`Convite registrado para ${email}! Peça para ela criar a conta no REFERY usando este e-mail.`);
      setEmailConvite('');
    } catch (e: any) {
      toast.error('Erro ao registrar convite: ' + e.message);
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="space-y-5 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Usuários</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Gerencie o acesso ao REFERY da sua conta.
        </p>
      </div>

      {/* Lista de usuários */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Membros da conta</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {usuarios.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">Nenhum usuário encontrado.</p>
          ) : (
            usuarios.map(u => (
              <div key={u.id} className="flex items-center gap-3 p-3 rounded-lg bg-gray-50 border">
                <div className="h-9 w-9 rounded-full bg-blue-100 flex items-center justify-center">
                  {u.role === 'life_planner'
                    ? <Crown className="h-4 w-4 text-blue-600" />
                    : <User className="h-4 w-4 text-gray-500" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{u.nome || u.email || 'Usuário'}</p>
                  <p className="text-xs text-muted-foreground">{u.email}</p>
                </div>
                <div className="flex items-center gap-2">
                  {!u.ativo && <Badge variant="secondary" className="text-xs">Inativo</Badge>}
                  <Badge
                    className={`text-xs ${u.role === 'life_planner' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'}`}
                  >
                    {u.role === 'life_planner' ? 'Life Planner' : 'Assistente'}
                  </Badge>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {/* Convidar assistente */}
      {isOwner && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <UserPlus className="h-4 w-4" />
              Convidar Assistente
            </CardTitle>
            <CardDescription>
              A assistente terá acesso a cadastrar indicações, clientes e registrar resultados de ligações.
              Ela <strong>não</strong> verá métricas, disparos de WhatsApp ou configurações.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-start gap-2 bg-blue-50 rounded-lg p-3 text-xs text-blue-700">
              <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
              <span>
                Digite o e-mail da assistente abaixo e clique em Convidar. Depois peça para ela acessar o REFERY e criar uma conta com <strong>exatamente este e-mail</strong>. Ela será vinculada automaticamente à sua conta.
              </span>
            </div>

            <div className="space-y-2">
              <Label htmlFor="email-convite">E-mail da assistente</Label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="email-convite"
                    type="email"
                    value={emailConvite}
                    onChange={e => setEmailConvite(e.target.value)}
                    placeholder="assistente@email.com"
                    className="pl-9"
                    onKeyDown={e => e.key === 'Enter' && convidarAssistente()}
                  />
                </div>
                <Button onClick={convidarAssistente} disabled={enviando || !emailConvite.trim()}>
                  {enviando ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Convidar'}
                </Button>
              </div>
            </div>

            <div className="bg-gray-50 rounded-lg p-4 space-y-3">
              <p className="text-xs font-medium text-gray-600">Permissões por perfil:</p>
              <div className="space-y-1">
                {[
                  { acao: 'Cadastrar indicações', lifePlanner: true, assistente: true },
                  { acao: 'Ver pipeline kanban', lifePlanner: true, assistente: true },
                  { acao: 'Alterar status', lifePlanner: true, assistente: true },
                  { acao: 'Montar agenda', lifePlanner: true, assistente: true },
                  { acao: 'Registrar resultados', lifePlanner: true, assistente: true },
                  { acao: 'WhatsApp CRM', lifePlanner: true, assistente: true },
                  { acao: 'Ver dashboard/métricas', lifePlanner: true, assistente: false },
                  { acao: 'Funil de conversão', lifePlanner: true, assistente: false },
                  { acao: 'Árvore de indicações', lifePlanner: true, assistente: false },
                  { acao: 'Configurações da conta', lifePlanner: true, assistente: false },
                  { acao: 'Gerenciar usuários', lifePlanner: true, assistente: false },
                ].map(p => (
                  <div key={p.acao} className="flex items-center justify-between text-xs py-1 border-b border-gray-100 last:border-0">
                    <span className="text-gray-600">{p.acao}</span>
                    <div className="flex gap-4">
                      <span className="flex items-center gap-1 w-20">
                        <Crown className="h-3 w-3 text-blue-500" />
                        <span className={p.lifePlanner ? 'text-green-600' : 'text-gray-400'}>{p.lifePlanner ? '✓' : '—'}</span>
                      </span>
                      <span className="flex items-center gap-1 w-20">
                        <User className="h-3 w-3 text-gray-400" />
                        <span className={p.assistente ? 'text-green-600' : 'text-gray-400'}>{p.assistente ? '✓' : '—'}</span>
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
