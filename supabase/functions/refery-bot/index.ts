import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Sessões em memória (por telefone do operador)
const sessoes: Record<string, {
  etapa: "aguardando_nome" | "aguardando_telefone" | "aguardando_indicador" | "aguardando_confirmacao";
  nome?: string;
  telefone?: string;
  indicadorId?: string;
  indicadorNome?: string;
  contaId?: string;
  operadorPhone?: string;
}> = {};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const body = await req.json();
  const mensagem = body.data?.text?.body?.trim() ?? body.message ?? "";
  const remetente = body.data?.key?.remoteJid ?? body.phone ?? "";

  if (!mensagem || !remetente) {
    return new Response("ok", { headers: corsHeaders });
  }

  // Identificar a conta pelo número do remetente (usuário da conta)
  const { data: usuario } = await supabase
    .from("usuarios_conta")
    .select("conta_id")
    .limit(1)
    .maybeSingle();

  const contaId = usuario?.conta_id;
  if (!contaId) {
    return new Response("Conta não encontrada", { headers: corsHeaders });
  }

  const sessao = sessoes[remetente] ?? null;
  const msg = mensagem.toLowerCase();

  // Enviar resposta via UAZAPI
  const { data: conta } = await supabase
    .from("contas")
    .select("uazapi_subdomain, uazapi_token, nome_empresa")
    .eq("id", contaId)
    .single();

  async function enviarMensagem(texto: string) {
    if (!conta?.uazapi_subdomain || !conta?.uazapi_token) return;
    await fetch(`https://${conta.uazapi_subdomain}.uazapi.com/send/text`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "token": conta.uazapi_token },
      body: JSON.stringify({ phone: remetente.replace("@s.whatsapp.net", ""), message: texto }),
    });
  }

  // Iniciar fluxo
  if (!sessao || msg === "nova indicação" || msg === "nova indicacao" || msg === "1") {
    sessoes[remetente] = { etapa: "aguardando_nome", contaId, operadorPhone: remetente };
    await enviarMensagem(
      "🤝 *Cadastro de Nova Indicação*\n\nQual é o *nome completo* do indicado?"
    );
    return new Response("ok", { headers: corsHeaders });
  }

  if (!sessao) {
    await enviarMensagem(
      "Olá! 👋 Envie *nova indicação* para cadastrar uma indicação pelo WhatsApp."
    );
    return new Response("ok", { headers: corsHeaders });
  }

  // Fluxo por etapa
  if (sessao.etapa === "aguardando_nome") {
    sessoes[remetente] = { ...sessao, etapa: "aguardando_telefone", nome: mensagem };
    await enviarMensagem(`Nome: *${mensagem}*\n\nQual é o *telefone* do indicado? (com DDD)`);
  } else if (sessao.etapa === "aguardando_telefone") {
    sessoes[remetente] = { ...sessao, etapa: "aguardando_indicador", telefone: mensagem };

    // Buscar clientes da conta
    const { data: clientes } = await supabase
      .from("clientes_ativos")
      .select("id, nome")
      .eq("conta_id", sessao.contaId!)
      .eq("ativo", true)
      .order("nome")
      .limit(10);

    if (!clientes || clientes.length === 0) {
      await enviarMensagem("Nenhum cliente ativo cadastrado ainda. Cadastre um cliente pelo sistema primeiro.");
      delete sessoes[remetente];
      return new Response("ok", { headers: corsHeaders });
    }

    const lista = clientes.map((c: any, i: number) => `${i + 1}. ${c.nome}`).join("\n");
    await enviarMensagem(
      `Quem indicou?\n\n${lista}\n\nResponda com o *número* da lista:`
    );

    // Guardar lista para referência
    (sessoes[remetente] as any)._clientes = clientes;
  } else if (sessao.etapa === "aguardando_indicador") {
    const clientes = (sessoes[remetente] as any)._clientes ?? [];
    const idx = parseInt(mensagem) - 1;
    if (isNaN(idx) || idx < 0 || idx >= clientes.length) {
      await enviarMensagem("Número inválido. Responda com o número da lista:");
      return new Response("ok", { headers: corsHeaders });
    }
    const cliente = clientes[idx];
    sessoes[remetente] = {
      ...sessao,
      etapa: "aguardando_confirmacao",
      indicadorId: cliente.id,
      indicadorNome: cliente.nome,
    };
    await enviarMensagem(
      `📋 *Confirme os dados:*\n\nNome: *${sessao.nome}*\nTelefone: *${sessao.telefone}*\nIndicado por: *${cliente.nome}*\n\nEstá correto? Responda *sim* para cadastrar ou *não* para recomeçar.`
    );
  } else if (sessao.etapa === "aguardando_confirmacao") {
    if (msg === "sim" || msg === "s") {
      await supabase.from("indicacoes").insert({
        conta_id: sessao.contaId,
        nome: sessao.nome,
        telefone: sessao.telefone,
        indicado_por_id: sessao.indicadorId,
        via_bot: true,
      });
      delete sessoes[remetente];
      await enviarMensagem(`✅ *Indicação cadastrada!*\n\n${sessao.nome} foi registrado com sucesso. Aparecerá no sistema em instantes.`);
    } else if (msg === "não" || msg === "nao" || msg === "n") {
      delete sessoes[remetente];
      await enviarMensagem("Ok! Envie *nova indicação* para recomeçar.");
    } else {
      await enviarMensagem("Responda *sim* para confirmar ou *não* para cancelar.");
    }
  }

  return new Response("ok", { headers: corsHeaders });
});
