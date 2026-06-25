export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { transcricao, contato_nome, contato_tipo } = req.body ?? {};

  if (!transcricao?.trim()) {
    return res.status(400).json({ error: 'Transcrição vazia' });
  }

  const openaiKey = process.env.OPENAI_API_KEY;
  if (!openaiKey) return res.status(500).json({ error: 'OPENAI_API_KEY não configurada' });

  const prompt = `Você é um assistente especializado em análise de ligações de vendas de seguros de vida.

Analise a transcrição abaixo de uma ligação com ${contato_tipo === 'indicacao' ? 'um lead indicado' : 'um cliente'} chamado "${contato_nome}".

TRANSCRIÇÃO:
${transcricao}

Responda APENAS com JSON válido neste formato exato:
{
  "resumo": "resumo em 2-3 frases do que foi conversado",
  "pontos_chave": ["ponto 1", "ponto 2", "ponto 3"],
  "proxima_acao": "próxima ação recomendada em uma frase",
  "agendamento_detectado": false,
  "data_agendamento": null,
  "hora_agendamento": null,
  "interesse": "alto|medio|baixo|nao_avaliado"
}

Para agendamento_detectado: coloque true se o cliente aceitou marcar uma reunião ou encontro.
Para data_agendamento: se detectado, extraia a data mencionada (formato YYYY-MM-DD se possível, senão texto livre).
Para hora_agendamento: se detectado, extraia o horário mencionado.`;

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${openaiKey}` },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        response_format: { type: 'json_object' },
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      const err = await response.json();
      return res.status(500).json({ error: err?.error?.message ?? 'Erro OpenAI' });
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    const resultado = JSON.parse(content);

    return res.status(200).json(resultado);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
