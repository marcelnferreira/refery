// Formata o telefone para o padrão UAZAPI: só números, com código do Brasil (55)
export function formatarTelefoneUazapi(tel: string): string {
  const nums = tel.replace(/\D/g, '');
  // Se já começa com 55 e tem 12-13 dígitos, está ok
  if (nums.startsWith('55') && nums.length >= 12) return nums;
  // Adiciona 55 (Brasil)
  return '55' + nums;
}

// Payload e endpoint padrão UAZAPI para envio de texto
export async function uazapiEnviarTexto(
  subdomain: string,
  token: string,
  telefone: string,
  mensagem: string
): Promise<{ ok: boolean; status: number; erro?: string }> {
  const number = formatarTelefoneUazapi(telefone);

  const res = await fetch(`https://${subdomain}.uazapi.com/send/text`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'token': token,
    } as any,
    body: JSON.stringify({ number, text: mensagem }),
  });

  if (res.ok) return { ok: true, status: res.status };

  let erro = `HTTP ${res.status}`;
  try {
    const body = await res.json();
    erro = body?.message ?? body?.error ?? body?.msg ?? erro;
  } catch {}

  return { ok: false, status: res.status, erro };
}
