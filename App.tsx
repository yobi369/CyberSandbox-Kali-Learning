
import React, { useState, useEffect } from 'react';
import Terminal from './components/Terminal';
import Mentor from './components/Mentor';
import LabBrowser from './components/LabBrowser';
import { Lab, UserProgress, SandboxPersistence, TerminalLine } from './types';
import { getMentorResponse, speakInstruction } from './services/geminiService';
import { Shield, Activity, Wifi, Mic, MicOff, Network, Zap, Award, Cloud, Box, Cpu, Target, Radar } from 'lucide-react';
import { INITIAL_FILES } from './constants';
import { matchesExpectedCommand } from './services/labProgress';

const PERSISTENCE_KEY = 'cyber_sandbox_elite_v5';

const App: React.FC = () => {
  const [activeLab, setActiveLab] = useState<Lab | null>(null);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [completedLabs, setCompletedLabs] = useState<string[]>([]);
  const [mentorMessage, setMentorMessage] = useState('Welcome back, Operative. Re-establishing secure link...');
  const [isMentorTyping, setIsMentorTyping] = useState(false);
  const [userProgress, setUserProgress] = useState<UserProgress>({ 
    xp: 0, level: 1, rank: 'Green-Hat', skills: { recon: 10, web: 5, exploit: 0, forensics: 0 } 
  });
  const [terminalHistory, setTerminalHistory] = useState<TerminalLine[]>([]);
  const [fileSystem, setFileSystem] = useState<Record<string, string>>(INITIAL_FILES['home/kali']);
  const [isSaved, setIsSaved] = useState(true);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(PERSISTENCE_KEY);
      if (!saved) return;
      const data: unknown = JSON.parse(saved);
      if (!data || typeof data !== 'object') return;
      const state = data as Partial<SandboxPersistence>;
      if (Array.isArray(state.completedLabs)) setCompletedLabs(state.completedLabs.filter((id): id is string => typeof id === 'string'));
      if (Array.isArray(state.terminalHistory)) setTerminalHistory(state.terminalHistory.filter((line): line is TerminalLine => Boolean(line && typeof line.id === 'string' && typeof line.content === 'string' && typeof line.timestamp === 'number')));
      if (state.activeLab && Array.isArray(state.activeLab.steps)) {
        setActiveLab(state.activeLab);
        setCurrentStepIndex(Math.max(0, Math.min(Number(state.currentStepIndex) || 0, state.activeLab.steps.length - 1)));
      }
      if (state.fileSystem && typeof state.fileSystem === 'object') setFileSystem(state.fileSystem);
      if (state.userProgress && typeof state.userProgress.xp === 'number' && typeof state.userProgress.level === 'number') setUserProgress(state.userProgress);
    } catch {
      localStorage.removeItem(PERSISTENCE_KEY);
      setMentorMessage('Saved practice data could not be read. A fresh local session has been started.');
    }
  }, []);

  useEffect(() => {
    try {
      const persistence: SandboxPersistence = { activeLab, currentStepIndex, completedLabs, terminalHistory, fileSystem, userProgress, lastSaved: Date.now() };
      localStorage.setItem(PERSISTENCE_KEY, JSON.stringify(persistence));
      setIsSaved(true);
    } catch {
      setIsSaved(false);
    }
  }, [activeLab, currentStepIndex, completedLabs, terminalHistory, fileSystem, userProgress]);

  const handleSelectLab = async (lab: Lab) => {
    setActiveLab(lab);
    setCurrentStepIndex(0);
    setMentorMessage(`Operation ${lab.title} initialized. Engaging tactical protocols.`);
    speakInstruction(`Operation ${lab.title} initialized. Objective: complete the authorized training exercise.`);
  };

  const handleCommandResult = async (command: string, output: string) => {
    if (activeLab?.steps[currentStepIndex]) {
      const step = activeLab.steps[currentStepIndex];
      const stepMatched = matchesExpectedCommand(command, step.expectedCommand);
      if (stepMatched) {
        setUserProgress(prev => ({ ...prev, xp: prev.xp + 150 }));
        if (currentStepIndex < activeLab.steps.length - 1) {
          setCurrentStepIndex(prev => prev + 1);
          const feedback = await getMentorResponse(command, output, activeLab);
          setMentorMessage(feedback);
          speakInstruction(activeLab.steps[currentStepIndex + 1]?.instruction || "Next step ready.");
        } else {
          setCompletedLabs(prev => [...prev, activeLab.id]);
          setUserProgress(prev => ({ ...prev, level: prev.level + 1 }));
          setMentorMessage("Chain Complete. System neutralised.");
        }
      }
    }
  };

  const rankNames = ["Learner", "Junior Analyst", "Security Defender", "Researcher", "Specialist", "Senior Analyst", "Security Lead"];
  const currentRank = rankNames[Math.min(userProgress.level - 1, rankNames.length - 1)];

  return (
    <div className="flex h-screen bg-[#020617] text-slate-300 font-sans overflow-hidden selection:bg-cyan-500/30">
      {/* ELITE HUD OVERLAY */}
      <div className="fixed inset-0 pointer-events-none z-[100] border-[1px] border-cyan-500/10 opacity-30 shadow-[inset_0_0_100px_rgba(6,182,212,0.1)]"></div>
      
      {/* TACTICAL SIDEBAR */}
      <div className="w-20 bg-slate-950 border-r border-white/5 flex flex-col items-center py-8 space-y-12 z-20">
        <div className="group relative">
           <div className="w-12 h-12 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center animate-pulse shadow-[0_0_15px_rgba(6,182,212,0.2)]">
              <Shield className="text-cyan-400" size={24} />
           </div>
        </div>
        <nav className="flex-1 flex flex-col space-y-8">
           <button className="p-3 text-cyan-500 bg-cyan-500/10 rounded-xl"><Radar size={22}/></button>
           <button className="p-3 text-slate-600 hover:text-cyan-400"><Cpu size={22}/></button>
           <button className="p-3 text-slate-600 hover:text-cyan-400"><Target size={22}/></button>
           <button className="p-3 text-slate-600 hover:text-cyan-400"><Box size={22}/></button>
        </nav>
        <div className="p-3 bg-emerald-500/10 text-emerald-400 rounded-full border border-emerald-500/20"><Activity size={20}/></div>
      </div>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-20 border-b border-white/5 flex items-center justify-between px-10 bg-slate-950/60 backdrop-blur-xl">
           <div className="flex items-center space-x-12">
              <div>
                 <h1 className="text-2xl font-black text-white italic tracking-tighter flex items-center">
                    CYBER<span className="text-cyan-500 ml-1">SANDBOX</span>
                 </h1>
                 <div className="flex items-center space-x-2 mt-1">
                    <span className="text-[9px] font-black text-slate-600 uppercase tracking-widest">Operator: {currentRank}</span>
                    <div className="w-1 h-1 rounded-full bg-cyan-500 animate-pulse"></div>
                 </div>
              </div>

              <div className="flex space-x-8">
                 <div className="text-center">
                    <div className="text-[9px] font-black text-slate-500 uppercase mb-1">XP_SYNC</div>
                    <div className="h-1.5 w-32 bg-slate-900 rounded-full overflow-hidden border border-white/5">
                       <div className="h-full bg-gradient-to-r from-cyan-600 to-emerald-500" style={{ width: `${(userProgress.xp % 1000) / 10}%` }}></div>
                    </div>
                 </div>
                 <div className="text-center">
                    <div className="text-[9px] font-black text-slate-500 uppercase mb-1">Threat_Level</div>
                    <div className="text-xs font-mono text-amber-500 font-black">LOW</div>
                 </div>
              </div>
           </div>

           <div className="flex items-center space-x-8">
              <div className="flex items-center space-x-3">
                 <div className="text-right">
                    <div className="text-[9px] font-black text-slate-500 uppercase">Local Session</div>
                    <div className="text-xs font-mono text-emerald-500">LOCAL ONLY</div>
                 </div>
                 <Cloud size={18} className="text-cyan-500"/>
              </div>
              <div className="px-6 py-2.5 bg-slate-900/40 rounded-xl border border-white/5 font-mono text-xs font-bold text-slate-400">
                 ENVIRONMENT: SIMULATED
              </div>
           </div>
        </header>

        <main className="flex-1 flex min-h-0 bg-[linear-gradient(rgba(6,182,212,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(6,182,212,0.02)_1px,transparent_1px)] bg-[size:40px_40px]">
          <div className="w-80 border-r border-white/5 p-8 flex flex-col bg-slate-950/40 backdrop-blur-md">
             <LabBrowser 
               activeLabId={activeLab?.id || null} 
               onSelectLab={handleSelectLab} 
               completedLabs={completedLabs}
             />
          </div>

          <div className="flex-1 p-8 flex flex-col min-w-0 relative">
             <Terminal 
               activeLab={activeLab} 
               onCommandExecuted={handleCommandResult}
               history={terminalHistory}
               setHistory={setTerminalHistory}
               fileSystem={fileSystem}
               setFileSystem={setFileSystem}
             />
             <div className="mt-4 flex justify-between text-[9px] font-black text-slate-600 uppercase tracking-widest px-1">
                <div className="flex space-x-6">
                   <span className="flex items-center space-x-1"><div className="w-1 h-1 bg-cyan-500 rounded-full"></div> <span>Simulator: Active</span></span>
                   <span>{isSaved ? "Progress: Saved locally" : "Progress: Storage unavailable"}</span>
                </div>
                <span>v5.0.0-PRO</span>
             </div>
          </div>

          <div className="w-96 border-l border-white/5 p-8 flex flex-col bg-slate-950/40 backdrop-blur-md space-y-8">
             <Mentor 
               message={mentorMessage} 
               isTyping={isMentorTyping} 
               currentStep={activeLab?.steps[currentStepIndex]}
               stepProgress={activeLab ? ((currentStepIndex) / activeLab.steps.length) * 100 : 0}
             />
             
             <div className="bg-slate-950/60 border border-cyan-500/20 rounded-2xl p-6 flex flex-col relative overflow-hidden group h-64 shadow-2xl">
                <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity"><Network size={60}/></div>
                <h3 className="text-[10px] font-black text-cyan-400 uppercase tracking-[0.2em] mb-6 flex items-center">
                   <Radar size={14} className="mr-2 animate-spin-slow"/> Live_Scan_Map
                </h3>
                <div className="flex-1 flex items-center justify-center relative">
                   <div className="w-32 h-32 rounded-full border border-cyan-500/20 flex items-center justify-center">
                      <div className="w-24 h-24 rounded-full border border-cyan-500/40 flex items-center justify-center animate-ping"></div>
                      <div className="absolute inset-0 flex items-center justify-center">
                         {activeLab ? (
                            <div className="text-center">
                               <div className="w-12 h-12 rounded-lg bg-cyan-500/20 border border-cyan-500 flex items-center justify-center mx-auto mb-2 shadow-[0_0_20px_rgba(6,182,212,0.4)]">
                                  <Shield className="text-cyan-400" size={24}/>
                               </div>
                               <span className="text-[10px] font-mono text-white font-black">{activeLab.targetIp}</span>
                            </div>
                         ) : (
                            <span className="text-[9px] text-slate-600 font-black uppercase">Scanning...</span>
                         )}
                      </div>
                   </div>
                </div>
             </div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default App;
