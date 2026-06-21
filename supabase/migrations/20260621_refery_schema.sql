-- REFERY: CRM para Life Planners de Seguros de Vida
-- Modelo SaaS multi-tenant com Row Level Security

-- ============================================================
-- TABELAS PRINCIPAIS
-- ============================================================

-- Contas (uma por life planner / organização)
create table if not exists contas (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references auth.users(id) not null,
  nome_empresa text not null default 'Minha Empresa',
  nome_life_planner text not null default '',
  plano text default 'starter',
  status text default 'ativo',
  uazapi_subdomain text,
  uazapi_token text,
  google_calendar_config jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Usuários por conta (life planner + assistentes)
create table if not exists usuarios_conta (
  id uuid primary key default gen_random_uuid(),
  conta_id uuid references contas(id) on delete cascade not null,
  user_id uuid references auth.users(id) not null,
  role text default 'assistente',
  nome text,
  email text,
  ativo boolean default true,
  created_at timestamptz default now(),
  unique(conta_id, user_id)
);

-- Configurações por conta
create table if not exists configuracoes_conta (
  id uuid primary key default gen_random_uuid(),
  conta_id uuid references contas(id) on delete cascade not null unique,
  dia_montagem_agenda integer default 4,
  dia_execucao integer default 5,
  horario_lembrete time default '09:00',
  dias_alerta_sem_atividade integer default 7,
  template_aviso_indicador text default 'Olá {nome_cliente}! Na próxima sexta entrarei em contato com {lista_indicados}, que você me indicou. Pode avisar que sou da {nome_empresa} e que ligarei? Muito obrigado!',
  updated_at timestamptz default now()
);

-- Clientes Ativos (quem pode gerar indicações)
create table if not exists clientes_ativos (
  id uuid primary key default gen_random_uuid(),
  conta_id uuid references contas(id) on delete cascade not null,
  nome text not null,
  telefone text not null,
  email text,
  indicacao_origem_id uuid,
  observacoes text,
  ativo boolean default true,
  ultimo_contato timestamptz,
  total_indicacoes integer default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Indicações
create table if not exists indicacoes (
  id uuid primary key default gen_random_uuid(),
  conta_id uuid references contas(id) on delete cascade not null,
  nome text not null,
  telefone text not null,
  email text,
  indicado_por_id uuid references clientes_ativos(id) not null,
  status text default 'novo',
  motivo_perda text,
  data_reuniao timestamptz,
  observacoes text,
  via_bot boolean default false,
  google_event_id text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- FK de clientes_ativos.indicacao_origem_id para indicacoes
alter table clientes_ativos
  add constraint if not exists clientes_ativos_indicacao_origem_fk
  foreign key (indicacao_origem_id) references indicacoes(id) on delete set null;

-- Histórico de Atividades
create table if not exists historico_atividades (
  id uuid primary key default gen_random_uuid(),
  conta_id uuid references contas(id) on delete cascade not null,
  indicacao_id uuid references indicacoes(id) on delete cascade,
  cliente_id uuid references clientes_ativos(id) on delete set null,
  tipo text not null,
  descricao text not null,
  dados jsonb,
  usuario_id uuid references auth.users(id),
  created_at timestamptz default now()
);

-- Agendas Semanais
create table if not exists agendas_semanais (
  id uuid primary key default gen_random_uuid(),
  conta_id uuid references contas(id) on delete cascade not null,
  semana_inicio date not null,
  status text default 'em_montagem',
  google_event_id text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Itens da Agenda
create table if not exists agenda_itens (
  id uuid primary key default gen_random_uuid(),
  agenda_id uuid references agendas_semanais(id) on delete cascade not null,
  indicacao_id uuid references indicacoes(id) not null,
  ordem integer default 0,
  resultado text,
  observacoes text,
  executado_at timestamptz,
  created_at timestamptz default now()
);

-- Disparos de Mensagem (histórico de envios WhatsApp)
create table if not exists disparos_mensagem (
  id uuid primary key default gen_random_uuid(),
  conta_id uuid references contas(id) on delete cascade not null,
  tipo text not null,
  destinatario_id uuid references clientes_ativos(id) on delete set null,
  destinatario_nome text,
  destinatario_telefone text,
  mensagem text not null,
  status text default 'pendente',
  agenda_id uuid references agendas_semanais(id) on delete set null,
  error_message text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

alter table contas enable row level security;
alter table usuarios_conta enable row level security;
alter table configuracoes_conta enable row level security;
alter table clientes_ativos enable row level security;
alter table indicacoes enable row level security;
alter table historico_atividades enable row level security;
alter table agendas_semanais enable row level security;
alter table agenda_itens enable row level security;
alter table disparos_mensagem enable row level security;

-- Função auxiliar: retorna o conta_id do usuário atual
create or replace function get_my_conta_id()
returns uuid
language sql
security definer
stable
as $$
  select conta_id from usuarios_conta
  where user_id = auth.uid() and ativo = true
  limit 1;
$$;

-- Função auxiliar: verifica se usuário é life_planner (dono)
create or replace function is_life_planner()
returns boolean
language sql
security definer
stable
as $$
  select exists(
    select 1 from usuarios_conta
    where user_id = auth.uid() and role = 'life_planner' and ativo = true
  );
$$;

-- RLS: contas
create policy "Membros podem ver sua conta" on contas
  for select using (
    id in (select conta_id from usuarios_conta where user_id = auth.uid() and ativo = true)
  );

create policy "Usuário pode criar conta ao registrar" on contas
  for insert with check (owner_id = auth.uid());

create policy "Life planner pode atualizar conta" on contas
  for update using (owner_id = auth.uid());

-- RLS: usuarios_conta
create policy "Membros podem ver usuários da conta" on usuarios_conta
  for select using (conta_id = get_my_conta_id());

create policy "Membros podem inserir-se (trigger)" on usuarios_conta
  for insert with check (
    conta_id in (select id from contas where owner_id = auth.uid())
    or user_id = auth.uid()
  );

create policy "Life planner pode gerenciar usuários" on usuarios_conta
  for update using (
    conta_id in (select id from contas where owner_id = auth.uid())
  );

create policy "Life planner pode remover usuários" on usuarios_conta
  for delete using (
    conta_id in (select id from contas where owner_id = auth.uid())
  );

-- RLS: configuracoes_conta
create policy "Membros podem ver configs" on configuracoes_conta
  for select using (conta_id = get_my_conta_id());

create policy "Life planner pode gerenciar configs" on configuracoes_conta
  for all using (
    conta_id in (select id from contas where owner_id = auth.uid())
  );

-- RLS: clientes_ativos
create policy "Membros podem ver clientes" on clientes_ativos
  for select using (conta_id = get_my_conta_id());

create policy "Membros podem inserir clientes" on clientes_ativos
  for insert with check (conta_id = get_my_conta_id());

create policy "Membros podem atualizar clientes" on clientes_ativos
  for update using (conta_id = get_my_conta_id());

create policy "Life planner pode deletar clientes" on clientes_ativos
  for delete using (
    conta_id in (select id from contas where owner_id = auth.uid())
  );

-- RLS: indicacoes
create policy "Membros podem ver indicações" on indicacoes
  for select using (conta_id = get_my_conta_id());

create policy "Membros podem inserir indicações" on indicacoes
  for insert with check (conta_id = get_my_conta_id());

create policy "Membros podem atualizar indicações" on indicacoes
  for update using (conta_id = get_my_conta_id());

create policy "Life planner pode deletar indicações" on indicacoes
  for delete using (
    conta_id in (select id from contas where owner_id = auth.uid())
  );

-- RLS: historico_atividades
create policy "Membros podem ver histórico" on historico_atividades
  for select using (conta_id = get_my_conta_id());

create policy "Membros podem inserir histórico" on historico_atividades
  for insert with check (conta_id = get_my_conta_id());

-- RLS: agendas_semanais
create policy "Membros podem ver agendas" on agendas_semanais
  for select using (conta_id = get_my_conta_id());

create policy "Membros podem gerenciar agendas" on agendas_semanais
  for all using (conta_id = get_my_conta_id());

-- RLS: agenda_itens
create policy "Membros podem ver itens" on agenda_itens
  for select using (
    agenda_id in (select id from agendas_semanais where conta_id = get_my_conta_id())
  );

create policy "Membros podem gerenciar itens" on agenda_itens
  for all using (
    agenda_id in (select id from agendas_semanais where conta_id = get_my_conta_id())
  );

-- RLS: disparos_mensagem
create policy "Membros podem ver disparos" on disparos_mensagem
  for select using (conta_id = get_my_conta_id());

create policy "Membros podem gerenciar disparos" on disparos_mensagem
  for all using (conta_id = get_my_conta_id());

-- ============================================================
-- TRIGGERS AUTOMÁTICOS
-- ============================================================

-- Trigger: criar conta + usuario_conta ao registrar novo usuário
create or replace function handle_new_user_refery()
returns trigger
language plpgsql
security definer
as $$
declare
  new_conta_id uuid;
begin
  insert into contas (owner_id, nome_empresa, nome_life_planner)
  values (
    new.id,
    'Minha Empresa',
    coalesce(new.raw_user_meta_data->>'full_name', '')
  )
  returning id into new_conta_id;

  insert into usuarios_conta (conta_id, user_id, role, nome, email)
  values (
    new_conta_id,
    new.id,
    'life_planner',
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    new.email
  );

  insert into configuracoes_conta (conta_id)
  values (new_conta_id);

  return new;
end;
$$;

drop trigger if exists on_auth_user_created_refery on auth.users;
create trigger on_auth_user_created_refery
  after insert on auth.users
  for each row execute function handle_new_user_refery();

-- Trigger: atualizar total_indicacoes ao criar/deletar indicação
create or replace function update_total_indicacoes()
returns trigger
language plpgsql
as $$
begin
  if TG_OP = 'INSERT' then
    update clientes_ativos
    set total_indicacoes = total_indicacoes + 1,
        updated_at = now()
    where id = new.indicado_por_id;
  elsif TG_OP = 'DELETE' then
    update clientes_ativos
    set total_indicacoes = greatest(0, total_indicacoes - 1),
        updated_at = now()
    where id = old.indicado_por_id;
  end if;
  return null;
end;
$$;

drop trigger if exists indicacoes_count_trigger on indicacoes;
create trigger indicacoes_count_trigger
  after insert or delete on indicacoes
  for each row execute function update_total_indicacoes();

-- Trigger: registrar mudança de status no histórico automaticamente
create or replace function log_status_change()
returns trigger
language plpgsql
as $$
begin
  if OLD.status is distinct from NEW.status then
    insert into historico_atividades (
      conta_id, indicacao_id, tipo, descricao, dados, usuario_id
    ) values (
      NEW.conta_id,
      NEW.id,
      'mudanca_status',
      'Status alterado de "' || OLD.status || '" para "' || NEW.status || '"',
      jsonb_build_object('status_anterior', OLD.status, 'status_novo', NEW.status),
      auth.uid()
    );
  end if;
  return NEW;
end;
$$;

drop trigger if exists indicacoes_status_log on indicacoes;
create trigger indicacoes_status_log
  after update on indicacoes
  for each row execute function log_status_change();

-- Trigger: registrar criação de indicação no histórico
create or replace function log_indicacao_criada()
returns trigger
language plpgsql
as $$
begin
  insert into historico_atividades (
    conta_id, indicacao_id, tipo, descricao, usuario_id
  ) values (
    NEW.conta_id,
    NEW.id,
    'criacao',
    'Indicação criada' || case when NEW.via_bot then ' via bot WhatsApp' else '' end,
    auth.uid()
  );
  return NEW;
end;
$$;

drop trigger if exists indicacoes_criacao_log on indicacoes;
create trigger indicacoes_criacao_log
  after insert on indicacoes
  for each row execute function log_indicacao_criada();
