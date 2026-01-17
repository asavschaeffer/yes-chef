import React, { useEffect, useRef, useState } from 'react';
import { Mic, MicOff, Radio, X } from 'lucide-react';
import { connectLiveSession, createPcmBlob, decodeAudioData, decodeBase64 } from '../services/geminiService';
import { LiveServerMessage } from '@google/genai';

interface Props {
  isActive: boolean;
  onClose: () => void;
}

const LiveChef: React.FC<Props> = ({ isActive, onClose }) => {
  const [status, setStatus] = useState<'connecting' | 'connected' | 'error' | 'disconnected'>('disconnected');
  const [volume, setVolume] = useState(0); // For visualization
  
  // Refs for audio handling to avoid re-renders
  const audioContextRef = useRef<AudioContext | null>(null);
  const inputContextRef = useRef<AudioContext | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const sessionRef = useRef<any>(null); // Holds the promise
  
  useEffect(() => {
    if (!isActive) {
      cleanup();
      return;
    }

    startSession();

    return () => {
      cleanup();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isActive]);

  const cleanup = () => {
    sourcesRef.current.forEach(s => s.stop());
    sourcesRef.current.clear();
    
    if (audioContextRef.current) audioContextRef.current.close();
    if (inputContextRef.current) inputContextRef.current.close();
    
    // We can't explicitly "close" the session object easily without the reference, 
    // but the contexts closing stops the flow.
    // In a real app, we'd call session.close() if exposed.
    
    setStatus('disconnected');
  };

  const startSession = async () => {
    setStatus('connecting');
    try {
      // 1. Setup Audio Output
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      const outputNode = audioContextRef.current.createGain();
      outputNode.connect(audioContextRef.current.destination);

      // 2. Setup Audio Input
      inputContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      const sessionPromise = connectLiveSession(
        () => setStatus('connected'),
        async (msg) => handleServerMessage(msg, outputNode),
        () => setStatus('disconnected'),
        (err) => { console.error(err); setStatus('error'); }
      );
      
      sessionRef.current = sessionPromise;

      // 3. Process Input Stream
      const source = inputContextRef.current.createMediaStreamSource(stream);
      const processor = inputContextRef.current.createScriptProcessor(4096, 1, 1);
      
      processor.onaudioprocess = (e) => {
        const inputData = e.inputBuffer.getChannelData(0);
        
        // Simple volume meter logic
        let sum = 0;
        for(let i=0; i<inputData.length; i++) sum += inputData[i] * inputData[i];
        setVolume(Math.sqrt(sum / inputData.length));

        const pcmBlob = createPcmBlob(inputData);
        sessionPromise.then(session => {
          session.sendRealtimeInput({ media: pcmBlob });
        });
      };

      source.connect(processor);
      processor.connect(inputContextRef.current.destination);

    } catch (e) {
      console.error("Failed to start live session", e);
      setStatus('error');
    }
  };

  const handleServerMessage = async (message: LiveServerMessage, outputNode: GainNode) => {
    const ctx = audioContextRef.current;
    if (!ctx) return;

    const base64Audio = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
    
    if (base64Audio) {
      const bytes = decodeBase64(base64Audio);
      const buffer = await decodeAudioData(bytes, ctx);
      
      nextStartTimeRef.current = Math.max(nextStartTimeRef.current, ctx.currentTime);
      
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(outputNode);
      source.start(nextStartTimeRef.current);
      
      nextStartTimeRef.current += buffer.duration;
      sourcesRef.current.add(source);
      
      source.onended = () => sourcesRef.current.delete(source);
    }

    if (message.serverContent?.interrupted) {
      sourcesRef.current.forEach(s => s.stop());
      sourcesRef.current.clear();
      nextStartTimeRef.current = 0;
    }
  };

  if (!isActive) return null;

  return (
    <div className="fixed inset-0 z-50 bg-stone-900/95 backdrop-blur-sm flex flex-col items-center justify-center text-white">
      <button 
        onClick={onClose}
        className="absolute top-6 right-6 p-2 rounded-full bg-white/10 hover:bg-white/20 transition"
      >
        <X size={24} />
      </button>

      <div className="mb-12 text-center space-y-2">
        <h2 className="text-4xl font-serif font-bold tracking-tight">Yes, Chef</h2>
        <p className="text-stone-400">Hands-free Cooking Mode</p>
      </div>

      <div className="relative">
        {/* Visualizer Ring */}
        <div 
          className="absolute inset-0 rounded-full bg-accent-500 blur-xl opacity-40 transition-transform duration-75"
          style={{ transform: `scale(${1 + volume * 5})` }}
        />
        
        <div className={`w-32 h-32 rounded-full flex items-center justify-center border-4 shadow-2xl transition-all duration-500 ${
          status === 'connected' ? 'border-accent-500 bg-stone-800' : 'border-stone-600 bg-stone-800'
        }`}>
          {status === 'connecting' && <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-white"></div>}
          {status === 'connected' && <Mic size={48} className="text-white" />}
          {status === 'error' && <MicOff size={48} className="text-red-400" />}
        </div>
      </div>

      <div className="mt-12 h-8 flex items-center gap-2">
        {status === 'connected' ? (
          <>
            <span className="flex h-3 w-3 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
            </span>
            <span className="text-sm font-medium uppercase tracking-widest text-green-400">Listening</span>
          </>
        ) : (
          <span className="text-sm text-stone-500 uppercase tracking-widest">{status}</span>
        )}
      </div>
      
      <p className="mt-8 text-stone-500 max-w-xs text-center text-sm">
        "Do I have heavy cream?" <br/>
        "How do I julienne a carrot?" <br/>
        "Set a timer for 10 minutes."
      </p>
    </div>
  );
};

export default LiveChef;
