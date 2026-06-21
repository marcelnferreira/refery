import { useState, useEffect } from 'react';
import type { User } from 'firebase/auth';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as fbSignOut,
  updateProfile,
} from 'firebase/auth';
import { doc, setDoc, getDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '@/integrations/firebase/client';
import { toast } from 'sonner';

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    return onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
  }, []);

  const signUp = async (email: string, password: string, fullName: string) => {
    try {
      const { user: newUser } = await createUserWithEmailAndPassword(auth, email, password);
      await updateProfile(newUser, { displayName: fullName });

      // Verificar se existe um convite pendente para este e-mail
      const conviteSnap = await getDoc(doc(db, 'convites', email.toLowerCase()));

      if (conviteSnap.exists()) {
        // É uma assistente convidada — vincular à conta existente
        const { conta_id, role } = conviteSnap.data();

        await setDoc(doc(db, 'userConta', newUser.uid), { conta_id });

        await setDoc(doc(db, 'contas', conta_id, 'usuarios', newUser.uid), {
          user_id: newUser.uid,
          role,
          nome: fullName,
          email,
          ativo: true,
          created_at: serverTimestamp(),
        });

        // Remover convite usado
        await deleteDoc(doc(db, 'convites', email.toLowerCase()));

        toast.success('Conta criada! Você foi vinculada como assistente.');
        return { success: true };
      }

      // Fluxo normal: novo life planner criando sua própria conta
      await setDoc(doc(db, 'contas', newUser.uid), {
        owner_id: newUser.uid,
        nome_empresa: 'Minha Empresa',
        nome_life_planner: fullName,
        plano: 'starter',
        status: 'ativo',
        uazapi_subdomain: null,
        uazapi_token: null,
        google_calendar_config: null,
        created_at: serverTimestamp(),
        updated_at: serverTimestamp(),
      });

      await setDoc(doc(db, 'userConta', newUser.uid), { conta_id: newUser.uid });

      await setDoc(doc(db, 'contas', newUser.uid, 'usuarios', newUser.uid), {
        user_id: newUser.uid,
        role: 'life_planner',
        nome: fullName,
        email,
        ativo: true,
        created_at: serverTimestamp(),
      });

      await setDoc(doc(db, 'contas', newUser.uid, 'configuracoes', 'default'), {
        dia_montagem_agenda: 4,
        dia_execucao: 5,
        horario_lembrete: '09:00',
        dias_alerta_sem_atividade: 7,
        template_aviso_indicador:
          'Olá {nome_cliente}! Na próxima sexta entrarei em contato com {lista_indicados}, que você me indicou. Pode avisar que sou da {nome_empresa} e que ligarei? Muito obrigado!',
        updated_at: serverTimestamp(),
      });

      toast.success('Conta criada! Bem-vindo ao REFERY.');
      return { success: true };
    } catch (error: any) {
      const msg =
        error.code === 'auth/email-already-in-use'
          ? 'Este e-mail já está cadastrado.'
          : error.code === 'auth/weak-password'
          ? 'A senha deve ter pelo menos 6 caracteres.'
          : error.message;
      toast.error(msg);
      return { success: false, error };
    }
  };

  const signIn = async (email: string, password: string) => {
    try {
      await signInWithEmailAndPassword(auth, email, password);
      toast.success('Bem-vindo de volta!');
      return { success: true };
    } catch (error: any) {
      toast.error('E-mail ou senha incorretos.');
      return { success: false, error };
    }
  };

  const signOut = async () => {
    await fbSignOut(auth);
    toast.success('Até logo!');
  };

  return {
    user,
    loading,
    signIn,
    signUp,
    signOut,
    isAuthenticated: !!user,
    session: user ? { user } : null,
  };
}
