
import React, { useState, useRef, useEffect } from 'react';
import { TerminalLine, Lab } from '../types';
import { HELP_TEXT } from '../constants';
import { Terminal as TerminalIcon, ShieldAlert } from 'lucide-react';

interface TerminalProps {
  onCommandExecuted: (command: string, output: string) => void;
  activeLab: Lab | null;
  history: TerminalLine[];
  setHistory: React.Dispatch<React.SetStateAction<TerminalLine[]>>;
  fileSystem: Record<string, string>;
  setFileSystem: React.Dispatch<React.SetStateAction<Record<string, string>>>;
}

const Terminal: React.FC<TerminalProps> = ({ 
  onCommandExecuted, 
  activeLab, 
  history, 
  setHistory,
  fileSystem,
  setFileSystem
}) => {
  const [input, setInput] = useState('');
  const [isMsf, setIsMsf] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [history]);

  const addLine = (type: TerminalLine['type'], content: string) => {
    setHistory(prev => [...prev, { id: Math.random().toString(36).substr(2, 9), type, content, timestamp: Date.now() }]);
  };

  const handleCommand = async (cmd: string) => {
    const trimmed = cmd.trim();
    if (!trimmed) return;

    addLine('command', `${isMsf ? 'msf6' : 'root@kali'}:~# ${trimmed}`);
    let output = '';
    let type: TerminalLine['type'] = 'output';

    const parts = trimmed.split(' ');
    const base = parts[0].toLowerCase();

    // MSFCONSOLE SUB-SIMULATION
    if (isMsf) {
      if (base === 'exit') { setIsMsf(false); output = 'Exiting Metasploit...'; }
      else if (base === 'use') output = `[*] Selected module: ${parts[1] || 'exploit/multi/handler'}`;
      else if (base === 'set') output = `${parts[1]} => ${parts[2]}`;
      else if (base === 'exploit' || base === 'run') {
        output = `[*] Started reverse TCP handler on 172.16.2.221:4444\n[*] Sending stage (175135 bytes) to ${activeLab?.targetIp || 'target'}\n[+] Meterpreter session 1 opened!`;
        type = 'success';
      }
      else output = `Unknown command: ${base}`;
    } else {
      // STANDARD KALI TOOLS
      switch (base) {
        case 'help': output = HELP_TEXT; break;
        case 'msfconsole': setIsMsf(true); output = '[+] Metasploit Framework Initialized.'; break;
        case 'ls': output = Object.keys(fileSystem).join('  '); break;
        case 'nmap':
           output = `Scanning ${activeLab?.targetIp || 'network'}...\nFound: 80/http (Apache), 22/ssh (OpenSSH), 445/smb (Samba)`;
           type = 'success';
           break;
        case 'gobuster':
           output = `[+] /admin (Status: 200)\n[+] /uploads (Status: 403)\n[+] /config.php (Status: 200)`;
           type = 'success';
           break;
        case 'hydra':
           output = `[ATTACK] hydra v9.4 (c) 2022\n[22][ssh] host: ${activeLab?.targetIp} login: admin password: password123\n1 of 1 target successfully completed.`;
           type = 'success';
           break;
        case 'cat':
           output = fileSystem[parts[1]] || `cat: ${parts[1]}: No such file`;
           break;
        default: output = `bash: ${base}: command not found`; type = 'error';
      }
    }

    addLine(type, output);
    onCommandExecuted(trimmed, output);
  };

  return (
    <div className="flex flex-col h-full bg-[#020617] border border-cyan-500/30 rounded-lg overflow-hidden shadow-[0_0_30px_rgba(6,182,212,0.1)]">
      <div className="bg-slate-900 px-4 py-2 flex items-center justify-between border-b border-white/5">
        <div className="flex items-center space-x-2">
          <TerminalIcon size={14} className="text-cyan-400" />
          <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Virtual_Console_v5</span>
        </div>
        <div className="flex space-x-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-red-500/40"></div>
          <div className="w-2.5 h-2.5 rounded-full bg-amber-500/40"></div>
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-500/40"></div>
        </div>
      </div>
      <div ref={scrollRef} className="flex-1 p-6 overflow-y-auto font-mono text-[13px] space-y-2 custom-scrollbar bg-[radial-gradient(circle_at_center,rgba(6,182,212,0.05)_0%,transparent_100%)]">
        {history.map(line => (
          <div key={line.id} className={`${line.type === 'command' ? 'text-cyan-400' : line.type === 'error' ? 'text-red-400' : line.type === 'success' ? 'text-emerald-400' : 'text-slate-500'}`}>
            <span className="opacity-50 text-[10px] mr-2">[{new Date(line.timestamp).toLocaleTimeString([], {hour12: false})}]</span>
            <span className="whitespace-pre-wrap">{line.content}</span>
          </div>
        ))}
        <form onSubmit={e => { e.preventDefault(); handleCommand(input); setInput(''); }} className="flex items-center">
          <span className={`${isMsf ? 'text-red-500' : 'text-cyan-500'} font-bold mr-2`}>{isMsf ? 'msf6' : 'root@kali'}:~#</span>
          <input
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            className="flex-1 bg-transparent border-none outline-none text-emerald-300 caret-cyan-500"
            autoFocus
            spellCheck={false}
          />
        </form>
      </div>
      <div className="h-1 bg-gradient-to-r from-transparent via-cyan-500/20 to-transparent animate-pulse"></div>
    </div>
  );
};

export default Terminal;
