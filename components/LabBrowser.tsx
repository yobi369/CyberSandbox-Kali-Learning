
import React, { useState } from 'react';
import { Lab } from '../types';
import { generateMission } from '../services/geminiService';
import { Target, Sparkles, Loader2, ShieldPlus, BookOpen, Lock, Terminal as TerminalIcon, ChevronRight, Zap, Filter } from 'lucide-react';
import { LABS } from '../constants';

interface LabBrowserProps {
  activeLabId: string | null;
  onSelectLab: (lab: Lab) => void;
  completedLabs: string[];
}

const LabBrowser: React.FC<LabBrowserProps> = ({ activeLabId, onSelectLab, completedLabs }) => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [filterDifficulty, setFilterDifficulty] = useState<'All' | 'Beginner' | 'Intermediate' | 'Advanced'>('All');
  const [genDifficulty, setGenDifficulty] = useState<'Beginner' | 'Intermediate' | 'Advanced'>('Intermediate');

  const handleGenerate = async () => {
    setIsGenerating(true);
    try {
      const newLab = await generateMission(genDifficulty);
      onSelectLab(newLab);
    } finally {
      setIsGenerating(false);
    }
  };

  const filteredLabs = LABS.filter(l => filterDifficulty === 'All' || l.difficulty === filterDifficulty);

  return (
    <div className="space-y-8 h-full flex flex-col">
      <div className="flex flex-col space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <BookOpen className="text-cyan-500" size={20} />
            <h2 className="text-sm font-black text-white uppercase tracking-[0.2em]">Curriculum</h2>
          </div>
          <div className="flex items-center space-x-1 px-2 py-1 bg-slate-800 rounded-lg border border-white/5">
            <Filter size={10} className="text-slate-500" />
            <select 
              value={filterDifficulty} 
              onChange={(e) => setFilterDifficulty(e.target.value as any)}
              className="bg-transparent text-[9px] font-bold text-slate-300 border-none outline-none cursor-pointer uppercase"
            >
              <option value="All">All Levels</option>
              <option value="Beginner">Beginner</option>
              <option value="Intermediate">Intermediate</option>
              <option value="Advanced">Advanced</option>
            </select>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto pr-3 space-y-4 custom-scrollbar">
        {filteredLabs.map(lab => (
          <button
            key={lab.id}
            onClick={() => onSelectLab(lab)}
            className={`w-full text-left p-5 rounded-2xl border transition-all duration-500 group relative ${
              activeLabId === lab.id 
                ? 'bg-cyan-500/10 border-cyan-500/40 shadow-lg' 
                : 'bg-slate-900/40 border-white/5 hover:border-white/20'
            }`}
          >
            <div className="flex justify-between items-center mb-3">
               <span className={`text-[8px] font-black px-2 py-0.5 rounded-full uppercase tracking-tighter ${
                 lab.difficulty === 'Beginner' ? 'bg-emerald-500/20 text-emerald-400' : 
                 lab.difficulty === 'Intermediate' ? 'bg-cyan-500/20 text-cyan-400' : 'bg-red-500/20 text-red-400'
               }`}>
                 {lab.difficulty}
               </span>
               {completedLabs.includes(lab.id) && <ChevronRight size={12} className="text-emerald-400" />}
            </div>
            <h3 className={`text-sm font-black mb-1 transition-colors ${activeLabId === lab.id ? 'text-white' : 'text-slate-300'}`}>{lab.title}</h3>
            <p className="text-[10px] text-slate-500 line-clamp-1">{lab.description}</p>
          </button>
        ))}

        {/* AI GENERATOR */}
        <div className="pt-8 border-t border-white/5 space-y-6">
          <div className="flex items-center space-x-3 text-emerald-400 px-1">
            <Sparkles size={18} />
            <h2 className="text-[10px] font-black uppercase tracking-[0.2em]">Unlimited Practice</h2>
          </div>
          
          <div className="bg-slate-900/60 border border-white/5 rounded-3xl p-6 space-y-5">
            <div className="space-y-3">
              <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Target Difficulty</label>
              <div className="grid grid-cols-3 gap-2">
                {(['Beginner', 'Intermediate', 'Advanced'] as const).map(d => (
                  <button
                    key={d}
                    onClick={() => setGenDifficulty(d)}
                    className={`py-1.5 rounded-lg text-[8px] font-black uppercase tracking-tighter transition-all ${
                      genDifficulty === d ? 'bg-emerald-500 text-slate-950' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                    }`}
                  >
                    {d}
                  </button>
                ))}
              </div>
            </div>

            <button 
                disabled={isGenerating}
                onClick={handleGenerate}
                className="w-full py-4 bg-slate-950 hover:bg-emerald-600 border border-white/10 hover:border-emerald-400 text-[10px] font-black rounded-2xl transition-all disabled:opacity-50 flex items-center justify-center uppercase tracking-[0.1em]"
            >
                {isGenerating ? <Loader2 size={16} className="animate-spin mr-2" /> : <ShieldPlus size={16} className="mr-2" />}
                Generate Dynamic Lab
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LabBrowser;
