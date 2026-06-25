import { useState, useCallback, useRef, useEffect } from 'react';
import { toast } from 'sonner';

export type CallStatus =
  | 'idle'
  | 'connecting'
  | 'ringing'
  | 'connected'
  | 'ended'
  | 'rejected'
  | 'unanswered'
  | 'error';

interface UseReferyWavoipReturn {
  status: CallStatus;
  isConnected: boolean;
  isCalling: boolean;
  startCall: (phoneNumber: string, wavoipToken: string) => void;
  endCall: () => void;
  toggleMute: () => void;
  isMuted: boolean;
  error: string | null;
  callDuration: number;
  peerInfo: { name: string | null; phone: string } | null;
}

export function useReferyWavoip(): UseReferyWavoipReturn {
  const [status, setStatus] = useState<CallStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [callDuration, setCallDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [peerInfo, setPeerInfo] = useState<{ name: string | null; phone: string } | null>(null);

  const wavoipRef = useRef<any>(null);
  const activeCallRef = useRef<any>(null);
  const durationIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const statusRef = useRef<CallStatus>('idle');

  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  useEffect(() => {
    return () => {
      if (durationIntervalRef.current) clearInterval(durationIntervalRef.current);
    };
  }, []);

  const startDurationTimer = useCallback(() => {
    setCallDuration(0);
    durationIntervalRef.current = setInterval(() => {
      setCallDuration(prev => prev + 1);
    }, 1000);
  }, []);

  const stopDurationTimer = useCallback(() => {
    if (durationIntervalRef.current) {
      clearInterval(durationIntervalRef.current);
      durationIntervalRef.current = null;
    }
  }, []);

  const resetState = useCallback(() => {
    setTimeout(() => {
      setStatus('idle');
      setError(null);
      setPeerInfo(null);
      setIsMuted(false);
      setCallDuration(0);
      activeCallRef.current = null;
    }, 2000);
  }, []);

  const checkMic = useCallback(async (): Promise<boolean> => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach(t => t.stop());
      return true;
    } catch (err: any) {
      const msg = err.name === 'NotAllowedError'
        ? 'Permissão de microfone negada. Permita nas configurações do navegador.'
        : err.name === 'NotFoundError'
        ? 'Nenhum microfone encontrado.'
        : err.message ?? 'Erro ao acessar microfone';
      setError(msg);
      toast.error(msg);
      return false;
    }
  }, []);

  const startCall = useCallback(async (phoneNumber: string, wavoipToken: string) => {
    const phone = phoneNumber.replace(/\D/g, '');
    if (!phone) { toast.error('Número inválido'); return; }
    if (!wavoipToken) { toast.error('Token WaVoIP não configurado. Configure em Configurações.'); return; }

    setStatus('connecting');
    setError(null);
    setPeerInfo({ name: null, phone });

    try {
      const { Wavoip } = await import('@wavoip/wavoip-api');
      wavoipRef.current = new Wavoip({ tokens: [wavoipToken] });

      const devices = wavoipRef.current.devices ?? [];
      if (devices.length > 0) {
        const ready = devices.find((d: any) => d.status === 'open');
        if (!ready) {
          const hibernating = devices.find((d: any) => d.status === 'hibernating');
          if (hibernating) {
            toast.info('Acordando dispositivo...');
            await hibernating.wakeUp();
            await new Promise(r => setTimeout(r, 2000));
          }
        }
      }

      const { call, err } = await wavoipRef.current.startCall({ to: phone });
      if (err) throw new Error(err.message ?? 'Erro ao iniciar chamada');
      if (!call) throw new Error('Chamada não criada');

      activeCallRef.current = call;
      setStatus('ringing');
      toast.info('Chamando...', { duration: 2000 });

      if (call.peer) {
        setPeerInfo({ name: call.peer.displayName, phone: call.peer.phone ?? phone });
      }

      call.onPeerAccept((activeCall: any) => {
        activeCallRef.current = activeCall;
        setStatus('connected');
        startDurationTimer();
        toast.success('Chamada conectada!');

        activeCall.onEnd(() => {
          setStatus('ended');
          stopDurationTimer();
        });
        activeCall.onError(() => {
          setStatus('error');
          stopDurationTimer();
          resetState();
        });
      });

      call.onPeerReject(() => { setStatus('rejected'); toast.error('Chamada rejeitada'); resetState(); });
      call.onUnanswered(() => { setStatus('unanswered'); toast.warning('Não atendeu'); resetState(); });
      call.onEnd(() => { if (statusRef.current !== 'connected') { setStatus('ended'); resetState(); } });

    } catch (err: any) {
      const raw = err?.message ?? '';
      const msg = raw.toLowerCase().includes('not found') || raw.toLowerCase().includes('notfound')
        ? 'Microfone não encontrado. Verifique se há um microfone conectado e com permissão no navegador.'
        : raw.toLowerCase().includes('not allowed') || raw.toLowerCase().includes('permission')
        ? 'Permissão de microfone negada. Permita o acesso nas configurações do navegador.'
        : raw || 'Erro ao iniciar chamada';
      setError(msg);
      setStatus('error');
      toast.error(msg);
      resetState();
    }
  }, [checkMic, startDurationTimer, stopDurationTimer, resetState]);

  const endCall = useCallback(async () => {
    try {
      if (activeCallRef.current?.end) await activeCallRef.current.end();
      setStatus('ended');
      stopDurationTimer();
    } catch {
      resetState();
    }
  }, [stopDurationTimer, resetState]);

  const toggleMute = useCallback(async () => {
    if (!activeCallRef.current) return;
    try {
      if (isMuted) {
        const { err } = await activeCallRef.current.unmute();
        if (!err) setIsMuted(false);
      } else {
        const { err } = await activeCallRef.current.mute();
        if (!err) setIsMuted(true);
      }
    } catch {}
  }, [isMuted]);

  return {
    status,
    isConnected: status === 'connected',
    isCalling: ['connecting', 'ringing', 'connected'].includes(status),
    startCall,
    endCall,
    toggleMute,
    isMuted,
    error,
    callDuration,
    peerInfo,
  };
}
