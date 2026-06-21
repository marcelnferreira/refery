import { useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useConta, useUpdateConta, useConfiguracoes, useUpdateConfiguracoes } from '@/hooks/useRefery';
import { Loader2, Building2, MessageCircle, CalendarDays, Bell, CheckCircle2, XCircle, FlaskConical, Copy, Link } from 'lucide-react';
import { toast } from 'sonner';
import { uazapiEnviarTexto } from '@/lib/uazapi';

const DIAS_SEMANA = [
  { value: '0', label: 'Domingo' },
  { value: '1', label: 'Segunda' },
  { value: '2', label: 'Terça' },
  { value: '3', label: 'Quarta' },
  { value: '4', label: 'Quinta' },
  { value: '5', label: 'Sexta' },
  { value: '6', label: 'Sábado' },
];

export default function ConfiguracoesPage() {
  const { data: conta } = useConta();
  const { data: config } = useConfiguracoes();
  const updateConta = useUpdateConta();
  const updateConfig = useUpdateConfiguracoes();

  const [empresa, setEmpresa] = useState('');
  const [lifePlanner, setLifePlanner] = useState('');
  const [uazapiSubdomain, setUazapiSubdomain] = useState('');
  const [uazapiToken, setUazapiToken] = useState('');

  const [testeTelefone, setTesteTelefone] = useState('');
  const [testandoUazapi, setTestandoUazapi] = useState(false);
  const [statusTeste, setStatusTeste] = useState<'idle' | 'ok' | 'erro'>('idle');
  const [erroTeste, setErroTeste] = useState('');

  const testarUazapi = async () => {
    if (!testeTelefone.trim()) { toast.error('Informe um telefone para o teste.'); return; }
    if (!uazapiSubdomain || !uazapiToken) { toast.error('Preencha o subdomínio e o token antes de testar.'); return; }

    setTestandoUazapi(true);
    setStatusTeste('idle');
    setErroTeste('');

    try {
      const result = await uazapiEnviarTexto(
        uazapiSubdomain,
        uazapiToken,
        testeTelefone,
        '✅ Teste de integração REFERY — sua conexão com o WhatsApp está funcionando!'
      );
      if (result.ok) {
        setStatusTeste('ok');
        toast.success('Mensagem enviada! Integração funcionando.');
      } else {
        setStatusTeste('erro');
        setErroTeste(result.erro ?? 'Erro desconhecido');
        toast.error('Falha: ' + result.erro);
      }
    } catch (e: any) {
      setStatusTeste('erro');
      setErroTeste(e.message ?? 'Erro de rede — verifique o subdomínio');
      toast.error('Erro de conexão: ' + (e.message ?? 'verifique o subdomínio'));
    } finally {
      setTestandoUazapi(false);
    }
  };

  const [diaMontagem, setDiaMontagem] = useState('4');
  const [diaExecucao, setDiaExecucao] = useState('5');
  const [horaLembrete, setHoraLembrete] = useState('09:00');
  const [diasAlerta, setDiasAlerta] = useState('7');
  const [template, setTemplate] = useState('');

  useEffect(() => {
    if (conta) {
      setEmpresa(conta.nome_empresa);
      setLifePlanner(conta.nome_life_planner);
      setUazapiSubdomain(conta.uazapi_subdomain ?? '');
      setUazapiToken(conta.uazapi_token ?? '');
    }
  }, [conta]);

  useEffect(() => {
    if (config) {
      setDiaMontagem(String(config.dia_montagem_agenda));
      setDiaExecucao(String(config.dia_execucao));
      setHoraLembrete(config.horario_lembrete ?? '09:00');
      setDiasAlerta(String(config.dias_alerta_sem_atividade));
      setTemplate(config.template_aviso_indicador);
    }
  }, [config]);

  const salvarConta = () => {
    updateConta.mutate({
      nome_empresa: empresa,
      nome_life_planner: lifePlanner,
      uazapi_subdomain: uazapiSubdomain || null,
      uazapi_token: uazapiToken || null,
    });
  };

  const salvarConfig = () => {
    updateConfig.mutate({
      dia_montagem_agenda: parseInt(diaMontagem),
      dia_execucao: parseInt(diaExecucao),
      horario_lembrete: horaLembrete,
      dias_alerta_sem_atividade: parseInt(diasAlerta),
      template_aviso_indicador: template,
    });
  };

  return (
    <div className="space-y-5 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Configurações</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Personalize o comportamento da Aplicação</p>
      </div>

      <Tabs defaultValue="geral">
        <TabsList>
          <TabsTrigger value="geral">Geral</TabsTrigger>
          <TabsTrigger value="whatsapp">WhatsApp</TabsTrigger>
          <TabsTrigger value="agenda">Ciclo Semanal</TabsTrigger>
          <TabsTrigger value="templates">Templates</TabsTrigger>
        </TabsList>

        <TabsContent value="geral" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Building2 className="h-4 w-4" />
                Dados da Empresa
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Nome da Empresa</Label>
                <Input value={empresa} onChange={e => setEmpresa(e.target.value)} placeholder="Ex: Seguros ABC" />
                <p className="text-xs text-muted-foreground">Aparece nas mensagens enviadas aos clientes.</p>
              </div>
              <div className="space-y-2">
                <Label>Seu nome (Life Planner)</Label>
                <Input value={lifePlanner} onChange={e => setLifePlanner(e.target.value)} placeholder="Seu nome completo" />
              </div>
              <Button onClick={salvarConta} disabled={updateConta.isPending}>
                {updateConta.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Salvar
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="whatsapp" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <MessageCircle className="h-4 w-4 text-green-600" />
                Integração UAZAPI (WhatsApp)
              </CardTitle>
              <CardDescription>
                Configure sua conta UAZAPI para enviar avisos automáticos via WhatsApp.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Subdomínio UAZAPI</Label>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">https://</span>
                  <Input
                    value={uazapiSubdomain}
                    onChange={e => setUazapiSubdomain(e.target.value)}
                    placeholder="seusubdominio"
                    className="flex-1"
                  />
                  <span className="text-sm text-muted-foreground">.uazapi.com</span>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Token de API</Label>
                <Input
                  value={uazapiToken}
                  onChange={e => setUazapiToken(e.target.value)}
                  type="password"
                  placeholder="Token do painel UAZAPI"
                />
              </div>
              <div className="bg-blue-50 rounded-lg p-3 text-xs text-blue-700 space-y-1">
                <p className="font-medium">Como configurar:</p>
                <ol className="list-decimal list-inside space-y-0.5">
                  <li>Crie uma conta em uazapi.com</li>
                  <li>Crie uma instância e conecte seu WhatsApp</li>
                  <li>Copie o subdomínio e o token de API</li>
                  <li>Cole aqui e salve</li>
                </ol>
              </div>
              <div className="flex gap-2">
                <Button onClick={salvarConta} disabled={updateConta.isPending}>
                  {updateConta.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Salvar
                </Button>
              </div>

              {/* URL do Webhook */}
              <div className="border-t pt-4 space-y-2">
                <p className="text-sm font-medium flex items-center gap-2">
                  <Link className="h-4 w-4 text-gray-500" />
                  URL do Webhook (mensagens recebidas)
                </p>
                <p className="text-xs text-muted-foreground">
                  Configure essa URL no painel UAZAPI para receber mensagens no REFERY.
                </p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 bg-gray-100 rounded-lg px-3 py-2 text-xs text-gray-800 break-all select-all">
                    https://refery-pi.vercel.app/api/whatsapp-webhook
                  </code>
                  <Button
                    variant="outline"
                    size="sm"
                    className="shrink-0"
                    onClick={() => {
                      navigator.clipboard.writeText('https://refery-pi.vercel.app/api/whatsapp-webhook');
                      toast.success('URL copiada!');
                    }}
                  >
                    <Copy className="h-3.5 w-3.5" />
                  </Button>
                </div>
                <div className="bg-amber-50 rounded-lg p-3 text-xs text-amber-700 space-y-1">
                  <p className="font-medium">Como configurar no UAZAPI:</p>
                  <ol className="list-decimal list-inside space-y-0.5">
                    <li>No painel UAZAPI, abra sua instância</li>
                    <li>Vá em <strong>Webhook</strong> ou <strong>Configurações</strong></li>
                    <li>Cole a URL acima no campo de webhook</li>
                    <li>Em eventos, selecione <strong>messages</strong></li>
                    <li>Salve e reconecte seu WhatsApp</li>
                  </ol>
                </div>
              </div>

              {/* Teste de integração */}
              <div className="border-t pt-4 space-y-3">
                <p className="text-sm font-medium flex items-center gap-2">
                  <FlaskConical className="h-4 w-4 text-blue-500" />
                  Testar integração
                </p>
                <p className="text-xs text-muted-foreground">
                  Envia uma mensagem de teste para confirmar que o token e subdomínio estão corretos.
                </p>
                <div className="flex gap-2">
                  <Input
                    value={testeTelefone}
                    onChange={e => setTesteTelefone(e.target.value)}
                    placeholder="Telefone com DDD (ex: 11999999999)"
                    className="flex-1"
                  />
                  <Button
                    variant="outline"
                    onClick={testarUazapi}
                    disabled={testandoUazapi}
                    className="shrink-0"
                  >
                    {testandoUazapi
                      ? <Loader2 className="h-4 w-4 animate-spin" />
                      : <FlaskConical className="h-4 w-4 mr-1" />}
                    {testandoUazapi ? 'Enviando...' : 'Testar'}
                  </Button>
                </div>

                {statusTeste === 'ok' && (
                  <div className="flex items-center gap-2 text-sm text-green-600 bg-green-50 rounded-lg px-3 py-2">
                    <CheckCircle2 className="h-4 w-4 shrink-0" />
                    Mensagem enviada com sucesso! Integração funcionando.
                  </div>
                )}
                {statusTeste === 'erro' && (
                  <div className="flex items-start gap-2 text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">
                    <XCircle className="h-4 w-4 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-medium">Falha na integração</p>
                      <p className="text-xs mt-0.5 text-red-500">{erroTeste}</p>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="agenda" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <CalendarDays className="h-4 w-4" />
                Ciclo Semanal de Ligações
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Dia de montar a agenda</Label>
                  <Select value={diaMontagem} onValueChange={setDiaMontagem}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {DIAS_SEMANA.map(d => <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Dia de fazer as ligações</Label>
                  <Select value={diaExecucao} onValueChange={setDiaExecucao}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {DIAS_SEMANA.map(d => <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Horário do lembrete de montar a agenda</Label>
                <Input type="time" value={horaLembrete} onChange={e => setHoraLembrete(e.target.value)} className="max-w-[140px]" />
              </div>
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Bell className="h-3.5 w-3.5" />
                  Alerta de inatividade (dias)
                </Label>
                <Input
                  type="number" min={1} max={90}
                  value={diasAlerta} onChange={e => setDiasAlerta(e.target.value)}
                  className="max-w-[120px]"
                />
                <p className="text-xs text-muted-foreground">
                  Indicações sem atividade por mais de {diasAlerta} dias serão destacadas no dashboard.
                </p>
              </div>
              <Button onClick={salvarConfig} disabled={updateConfig.isPending}>
                {updateConfig.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Salvar
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="templates" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Template de Aviso ao Indicador</CardTitle>
              <CardDescription>
                Mensagem enviada para o cliente antes das ligações aos seus indicados.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Textarea
                value={template}
                onChange={e => setTemplate(e.target.value)}
                rows={5}
                className="font-mono text-sm"
              />
              <div className="bg-gray-50 rounded-lg p-3 text-xs space-y-1">
                <p className="font-medium text-gray-600">Variáveis disponíveis:</p>
                <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-muted-foreground">
                  <span><code>{'{nome_cliente}'}</code> — Nome do cliente</span>
                  <span><code>{'{lista_indicados}'}</code> — Nomes dos indicados</span>
                  <span><code>{'{nome_empresa}'}</code> — Nome da empresa</span>
                  <span><code>{'{nome_life_planner}'}</code> — Seu nome</span>
                  <span><code>{'{data_ligacao}'}</code> — Data da ligação</span>
                </div>
              </div>
              <div className="bg-blue-50 rounded-lg p-3 text-sm">
                <p className="text-xs text-blue-600 font-medium mb-1">Prévia:</p>
                <p className="text-xs text-blue-800">
                  {template
                    .replace('{nome_cliente}', 'João Silva')
                    .replace('{lista_indicados}', 'Maria Santos, Pedro Oliveira')
                    .replace('{nome_empresa}', conta?.nome_empresa ?? 'Minha Empresa')
                    .replace('{nome_life_planner}', conta?.nome_life_planner ?? 'Life Planner')
                    .replace('{data_ligacao}', 'sexta-feira, 27/06')}
                </p>
              </div>
              <Button onClick={salvarConfig} disabled={updateConfig.isPending}>
                {updateConfig.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Salvar template
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
