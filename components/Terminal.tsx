import React, { useState, useRef, useEffect } from 'react';
import { TerminalLine, Lab } from '../types';
import { appendTerminalLine, MAX_TERMINAL_LINE_LENGTH } from '../services/terminalHistory';
import { HELP_TEXT } from '../constants';
import { Terminal as TerminalIcon } from 'lucide-react';

interface TerminalProps {
  onCommandExecuted: (command: string, output: string) => void;
  activeLab: Lab | null;
  history: TerminalLine[];
  setHistory: React.Dispatch<React.SetStateAction<TerminalLine[]>>;
  fileSystem: Record<string, string>;
  setFileSystem: React.Dispatch<React.SetStateAction<Record<string, string>>>;
}

const Terminal: React.FC<TerminalProps> = ({
  onCommandExecuted, activeLab, history, setHistory, fileSystem,
}) => {
  const [input, setInput] = useState('');
  const [isMsf, setIsMsf] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [history]);

  const addLine = (type: TerminalLine['type'], content: string) => {
    setHistory((prev) => appendTerminalLine(prev, {
      id: crypto.randomUUID(),
      type,
      content,
      timestamp: Date.now(),
    }));
  };

  const handleCommand = (cmd: string) => {
    const trimmed = cmd.trim();
    if (!trimmed) return;

    addLine('command', `${isMsf ? 'msf6' : 'kali@cybersandbox'}:~$ ${trimmed}`);
    const parts = trimmed.split(/\s+/);
    const base = parts[0].toLowerCase();
    let output = '';
    let type: TerminalLine['type'] = 'output';

    if (isMsf) {
      if (base === 'exit' || base === 'back') {
        setIsMsf(false);
        output = 'Returned to the CyberSandbox practice shell.';
      } else if (base === 'help') {
        output = 'Supported practice commands: help, search, use, show options, set, run, exit. No exploit code or network session is executed.';
      } else if (base === 'search') {
        output = 'SIMULATION: matching example modules would be listed here. No live exploit database is queried.';
      } else if (base === 'use' || base === 'set' || base === 'show') {
        output = `SIMULATION: accepted practice command “${trimmed}”. No framework module is loaded or configured.`;
      } else if (base === 'run' || base === 'exploit') {
        output = 'SIMULATION ONLY: this action does not execute an exploit, contact a host, or create a session. Use the exercise notes to explain the expected defensive observations.';
        type = 'system';
      } else {
        output = `Unknown simulated Metasploit command: ${base}. Type help.`;
        type = 'error';
      }
    } else {
      switch (base) {
        case 'help':
          output = HELP_TEXT;
          break;
        case 'clear':
          setHistory([]);
          return;
        case 'whoami':
          output = 'kali (simulated training identity)';
          break;
        case 'pwd':
          output = '/home/kali';
          break;
        case 'date':
          output = new Date().toString() + ' (local simulator clock)';
          break;
        case 'ls':
          output = Object.keys(fileSystem).join('  ') || '(empty directory)';
          break;
        case 'cat': {
          const requested = parts.slice(1).join(' ');
          const filename = requested.replace(/^\.\//, '').split('/').pop() ?? '';
          output = fileSystem[filename] ?? `cat: ${requested || 'missing filename'}: No such file in the training filesystem`;
          break;
        }
        case 'nmap':
          output = `SIMULATED SCAN — no packets were sent.\nTarget: ${activeLab?.targetIp ?? 'training target'}\nExample observations: 22/tcp open (SSH), 80/tcp open (HTTP), 445/tcp filtered (SMB).\nInterpret these as seeded exercise data, not a real assessment.`;
          type = 'system';
          break;
        case 'dig':
        case 'dnsrecon':
        case 'amass':
          output = `SIMULATION: example DNS observations for the lab domain. No DNS requests were sent.\nCommand model: ${trimmed}\nRecord your findings and explain their significance.`;
          type = 'system';
          break;
        case 'gobuster':
        case 'dirb':
        case 'nikto':
        case 'searchsploit':
        case 'sqlmap':
          output = `SIMULATION: sample ${base} exercise output. No HTTP requests, brute force, exploit lookup, or database tests were performed.\nUse only the lab-provided evidence when writing your finding.`;
          type = 'system';
          break;
        case 'hydra':
          output = 'SIMULATION BLOCKED: credential-guessing commands are not executed and no credentials are disclosed. Discuss rate limiting, MFA, lockout policy, and authentication telemetry instead.';
          type = 'system';
          break;
        case 'msfconsole':
          setIsMsf(true);
          output = 'Opened the Metasploit learning prompt. This is a command-learning simulation, not the Metasploit Framework.';
          type = 'system';
          break;
        default:
          output = `bash: ${base}: command not found in the CyberSandbox simulator. Type help.`;
          type = 'error';
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
          <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Simulated Kali Console</span>
        </div>
        <span className="text-[9px] uppercase tracking-widest text-amber-400">Training data only · no host execution</span>
      </div>
      <div ref={scrollRef} className="flex-1 p-6 overflow-y-auto font-mono text-[13px] space-y-2 custom-scrollbar bg-[radial-gradient(circle_at_center,rgba(6,182,212,0.05)_0%,transparent_100%)]">
        {history.map((line) => (
          <div key={line.id} className={`${line.type === 'command' ? 'text-cyan-400' : line.type === 'error' ? 'text-red-400' : line.type === 'success' ? 'text-emerald-400' : 'text-slate-400'}`}>
            <span className="opacity-50 text-[10px] mr-2">[{new Date(line.timestamp).toLocaleTimeString([], { hour12: false })}]</span>
            <span className="whitespace-pre-wrap">{line.content}</span>
          </div>
        ))}
        <form onSubmit={(event) => { event.preventDefault(); handleCommand(input); setInput(''); }} className="flex items-center">
          <span className={`${isMsf ? 'text-red-500' : 'text-cyan-500'} font-bold mr-2`}>{isMsf ? 'msf6' : 'kali@cybersandbox'}:~$</span>
          <input
            type="text"
            value={input}
            onChange={(event) => setInput(event.target.value)}
            className="flex-1 bg-transparent border-none outline-none text-emerald-300 caret-cyan-500"
            aria-label="Enter a simulated Kali Linux command"
            autoComplete="off"
            spellCheck={false}
          />
        </form>
      </div>
      <div className="h-1 bg-gradient-to-r from-transparent via-cyan-500/20 to-transparent animate-pulse" />
    </div>
  );
};

export default Terminal;
