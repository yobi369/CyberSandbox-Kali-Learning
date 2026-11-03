
import React, { useState, useEffect } from 'react';
import { Cpu, Info, ChevronRight, Book, Zap, Volume2, Mic } from 'lucide-react';
import { LabStep } from '../types';

interface MentorProps {
  message: string;
  isTyping: boolean;
  currentStep?: LabStep;
  stepProgress: number; 
}

const Mentor: React.FC<MentorProps> = ({ message, isTyping, currentStep, stepProgress }) => {
  const [displayText, setDisplayText] = useState('');
  const [tab, setTab] = useState<'mission' | 'intel'>('mission');

  useEffect(() => {
    let i = 0;
    setDisplayText('');
    const interval = setInterval(() => {
      setDisplayText(prev => prev + message.charAt(i));
      i++;
      if (i >= message.length) clearInterval(interval);
    }, 15);
    return () => clearInterval(interval);
  }, [message]);

  return (
    <div className="bg-slate-900/60 border border-white/5 rounded-2xl p-5 h-full flex flex-col backdrop-blur-2xl">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center">
            <Cpu className="text-cyan-400" size={20} />
          </div>
          <div>
            <h3 className="text-[11px] font-black text-white uppercase tracking-widest">Cipher v5.0</h3>
            <span className="text-[9px] text-emerald-500 font-bold uppercase tracking-tighter">Tactical Advisor</span>
          </div>
        </div>
        <div className="flex space-x-1 p-1 bg-slate-950 rounded-lg border border-white/5">
          <button onClick={() => setTab('mission')} className={`px-3 py-1 text-[9px] font-black uppercase rounded ${tab === 'mission' ? 'bg-cyan-500 text-slate-950' : 'text-slate-500'}`}>Mission</button>
          <button onClick={() => setTab('intel')} className={`px-3 py-1 text-[9px] font-black uppercase rounded ${tab === 'intel' ? 'bg-cyan-500 text-slate-950' : 'text-slate-500'}`}>Intel</button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto space-y-6 pr-1 custom-scrollbar">
        {tab === 'mission' ? (
          <>
            <div className="bg-slate-950/80 p-4 rounded-xl border border-white/5 text-[12px] leading-relaxed text-slate-300 italic">
              "{displayText}"
            </div>
            {currentStep && (
              <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2">
                <div className="p-5 bg-gradient-to-br from-cyan-500/10 to-transparent border border-cyan-500/30 rounded-2xl">
                  <div className="flex items-center space-x-2 mb-3">
                    <Zap size={12} className="text-cyan-400" />
                    <span className="text-[9px] font-black text-cyan-400 uppercase tracking-widest">Current Objective</span>
                  </div>
                  <p className="text-sm font-bold text-slate-100 leading-snug">{currentStep.instruction}</p>
                  <div className="mt-4 p-3 bg-slate-950/50 rounded-lg border border-white/5 text-[11px] text-slate-400">
                    {currentStep.explanation}
                  </div>
                  <div className="mt-4 flex items-center justify-between">
                     <span className="text-[9px] font-black text-emerald-500 uppercase tracking-widest flex items-center">
                        <ChevronRight size={14}/> {currentStep.hint}
                     </span>
                  </div>
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="space-y-4 text-[12px] text-slate-400">
             <div className="flex items-center space-x-2 text-cyan-400 mb-2">
                <Book size={14}/>
                <h4 className="font-black uppercase tracking-widest">Tactical Intelligence</h4>
             </div>
             <p className="leading-relaxed bg-slate-950/50 p-4 rounded-xl border border-white/5">
                {currentStep?.detailedGuide || "Perform reconnaissance to unlock deep tool analysis."}
             </p>
          </div>
        )}
      </div>

      <div className="mt-8 pt-8 border-t border-white/5">
        <div className="flex items-center justify-between text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3">
           <span>Module Progress</span>
           <span className="text-cyan-400">{Math.round(stepProgress)}%</span>
        </div>
        <div className="h-2 bg-slate-950 rounded-full border border-white/5">
           <div className="h-full bg-cyan-500 shadow-[0_0_10px_rgba(6,182,212,0.5)] transition-all duration-1000" style={{ width: `${stepProgress}%` }}></div>
        </div>
        <div className="mt-6 flex justify-center space-x-4">
           <button className="flex items-center space-x-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg border border-white/5 transition-all group">
              <Volume2 size={16} className="text-cyan-500 group-hover:scale-110"/>
              <span className="text-[10px] font-black uppercase text-slate-300">Voice Comms</span>
           </button>
        </div>
      </div>
    </div>
  );
};

export default Mentor;
