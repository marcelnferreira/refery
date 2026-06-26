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
  startCall: (phoneNumber: string, wavoipToken: string, micStream?: MediaStream) => void;
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

  const startCall = useCallback(async (phoneNumber: string, wavoipToken: string, micStream?: MediaStream) => {
    const raw = phoneNumber.replace(/\D/g, '');
    if (!raw) { toast.error('Número inválido'); return; }
    // WaVoIP precisa do número completo com DDI 55 (ex: 5511987654321)
    const phone = raw.startsWith('55') && raw.length >= 12 ? raw : `55${raw}`;
    console.log('[WaVoIP] chamando número:', phone);
    if (!wavoipToken) { toast.error('Token WaVoIP não configurado. Configure em Configurações.'); return; }

    setStatus('connecting');
    setError(null);
    setPeerInfo({ name: null, phone });

    // Intercepta getUserMedia do WaVoIP para usar o stream já capturado
    let restoreGUM: (() => void) | null = null;
    if (micStream) {
      const orig = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
      (navigator.mediaDevices as any).getUserMedia = async () => micStream;
      restoreGUM = () => { (navigator.mediaDevices as any).getUserMedia = orig; };
    }

    try {
      const { Wavoip } = await import('@wavoip/wavoip-api');
      wavoipRef.current = new Wavoip({ tokens: [wavoipToken] });

      // O constructor do WaVoIP chama updateDeviceList() de forma async sem await.
      // Precisamos esperar os microfones serem enumerados antes de chamar startCall,
      // senão this.devices ainda está [] e retorna "Nenhum microfone encontrado".
      const micList = (wavoipRef.current as any).multimedia?.microphone;
      if (micList) {
        // Força atualização da lista agora que já temos permissão de microfone
        await micList.updateDeviceList?.();
        // Aguarda até 2s caso ainda esteja vazio
        let t = 0;
        while ((micList.devices?.length ?? 0) === 0 && t < 20) {
          await new Promise(r => setTimeout(r, 100));
          t++;
        }
        console.log('[WaVoIP] microfones encontrados:', micList.devices);
      }

      // Aguarda o socket do dispositivo WaVoIP conectar (tryToConnect + socket.connect são async)
      const rawDevices = (wavoipRef.current as any)._devices ?? [];
      if (rawDevices.length > 0) {
        const firstDevice = rawDevices[0];
        let socketWait = 0;
        while (!firstDevice.socket?.connected && socketWait < 50) {
          await new Promise(r => setTimeout(r, 200));
          socketWait++;
        }
        console.log('[WaVoIP] device status:', firstDevice.status, '| socket connected:', firstDevice.socket?.connected);
        if (!firstDevice.socket?.connected) {
          restoreGUM?.();
          throw new Error('Não foi possível conectar ao servidor WaVoIP. Verifique se o token do dispositivo está correto em Configurações → Telefonia.');
        }

        // Monitora todos os eventos do socket para diagnóstico
        firstDevice.socket.onAny((event: string, ...args: any[]) => {
          console.log('[WaVoIP ←]', event, JSON.stringify(args).slice(0, 300));
        });
        firstDevice.socket.onAnyOutgoing((event: string, ...args: any[]) => {
          const safe = args.map((a: any) => typeof a === 'function' ? '[ack]' : a instanceof ArrayBuffer ? '[audio]' : a);
          console.log('[WaVoIP →]', event, JSON.stringify(safe).slice(0, 300));
        });
      }

      // Acorda dispositivo WaVoIP (WhatsApp) se estiver em hibernação
      const wavoipDevices = wavoipRef.current.devices ?? [];
      if (wavoipDevices.length > 0) {
        const hibernating = wavoipDevices.find((d: any) => d.status === 'hibernating');
        if (hibernating) {
          toast.info('Acordando dispositivo...');
          await hibernating.wakeUp();
          await new Promise(r => setTimeout(r, 2000));
        }
      }

      // Timeout de 15s para evitar que startCall trave indefinidamente
      const { call, err } = await Promise.race([
        wavoipRef.current.startCall({ to: phone }),
        new Promise<{ call: null; err: any }>(resolve =>
          setTimeout(() => resolve({ call: null, err: { message: 'Timeout: WaVoIP não respondeu em 15 segundos. Verifique se o WhatsApp está conectado ao dispositivo.' } }), 15000)
        ),
      ]);
      restoreGUM?.();
      if (err) {
        console.error('[WaVoIP] startCall err:', JSON.stringify(err));
        throw new Error(err.message ?? 'Erro ao iniciar chamada');
      }
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
      restoreGUM?.();
      console.error('[WaVoIP] catch:', err);
      const raw = err?.message ?? '';
      const msg = raw || 'Erro ao iniciar chamada';
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
