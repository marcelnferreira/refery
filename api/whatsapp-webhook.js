import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

function getDb() {
  if (!getApps().length) {
    const sa = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    initializeApp({ credential: cert(sa) });
  }
  return getFirestore();
}

function extrairTelefone(str) {
  if (!str) return null;
  const nums = str.replace(/\D/g, '');
  if (nums.length < 8) return null;
  // Remove código do Brasil (55)
  let phone = (nums.startsWith('55') && nums.length >= 12) ? nums.slice(2) : nums;
  // WhatsApp omite o 9 de números móveis brasileiros: DDD(2) + 8 dígitos = 10 → insere o 9
  if (phone.length === 10) phone = phone.slice(0, 2) + '9' + phone.slice(2);
  return phone;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const payload = req.body;

  try {
    const msg = payload?.message;
    const chat = payload?.chat;

    if (!msg) {
      console.log('Sem campo message no payload');
      return res.status(200).json({ ok: true, skipped: 'no message field' });
    }

    // Ignora mensagens enviadas por nós
    if (msg.fromMe === true) {
      console.log('Ignorando fromMe');
      return res.status(200).json({ ok: true, skipped: 'fromMe' });
    }

    // Ignora grupos
    if (msg.isGroup === true) {
      return res.status(200).json({ ok: true, skipped: 'group' });
    }

    // Extrai telefone — uazapiGO usa sender_pn ou chatid
    const telefoneRaw = msg.sender_pn ?? msg.chatid ?? chat?.wa_chatid ?? chat?.phone ?? '';
    const phone = extrairTelefone(telefoneRaw);

    if (!phone) {
      console.log('Telefone inválido:', telefoneRaw);
      return res.status(200).json({ ok: true, skipped: 'invalid phone' });
    }

    // Extrai texto
    const texto = msg.text ?? msg.content ?? msg.caption ?? '';
    if (!texto.trim()) {
      console.log('Mensagem sem texto (mídia?)');
      return res.status(200).json({ ok: true, skipped: 'no text' });
    }

    // Nome do contato
    const nomeContato = chat?.name ?? chat?.wa_contactName ?? msg.senderName ?? phone;

    console.log(`Salvando: ${phone} (${nomeContato}) → "${texto}"`);

    // Salva no Firestore — busca a primeira conta
    const db = getDb();
    const contasSnap = await db.collection('contas').get();
    if (contasSnap.empty) {
      console.log('Nenhuma conta encontrada');
      return res.status(200).json({ ok: true, skipped: 'no contas' });
    }
    const contaId = contasSnap.docs[0].id;

    await db.collection('contas').doc(contaId).collection('whatsapp_msgs').add({
      phone,
      contact_name: nomeContato,
      contact_id: phone,
      contact_type: 'externo',
      message: texto,
      direction: 'inbound',
      created_at: new Date(),
    });

    console.log(`Mensagem salva! Conta: ${contaId}, Telefone: ${phone}`);
    return res.status(200).json({ ok: true, phone, contaId });

  } catch (err) {
    console.error('Erro:', err.message);
    return res.status(500).json({ error: err.message });
  }
}
