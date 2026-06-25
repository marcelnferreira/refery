export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { transcricao, contato_nome, contato_tipo } = req.body ?? {};

  if (!transcricao?.trim()) {
    return res.status(400).json({ error: 'Transcrição vazia' });
  }

  const geminiKey = process.env.GEMINI_API_KEY;
  if (!geminiKey) return res.status(500).json({ error: 'GEMINI_API_KEY não configurada' });

  const prompt = `Você é um assistente especializado em análise de ligações de vendas de seguros de vida.

Analise a transcrição abaixo de uma ligação com ${contato_tipo === 'indicacao' ? 'um lead indicado' : 'um cliente'} chamado "${contato_nome}".

TRANSCRIÇÃO:
${transcricao}

Responda APENAS com JSON válido neste formato exato (sem markdown, sem explicações):
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
Para hora_agendamento: se detectado, extraia o horário mencionado.
Para interesse: avalie o nível de interesse do contato com base no tom e conteúdo da conversa.`;

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.3,
            responseMimeType: 'application/json',
          },
        }),
      }
    );

    if (!response.ok) {
      const err = await response.json();
      return res.status(500).json({ error: err?.error?.message ?? 'Erro Gemini API' });
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) return res.status(500).json({ error: 'Resposta vazia do Gemini' });

    const resultado = JSON.parse(text);
    return res.status(200).json(resultado);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
