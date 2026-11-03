
export interface TerminalLine {
  id: string;
  type: 'command' | 'output' | 'error' | 'success' | 'system' | 'ai';
  content: string;
  timestamp: number;
}

export interface NetworkNode {
  id: string;
  ip: string;
  status: 'hidden' | 'discovered' | 'compromised';
  type: 'workstation' | 'server' | 'firewall' | 'database';
  ports: number[];
}

export interface LabStep {
  id: string;
  instruction: string;
  hint: string;
  expectedCommand?: string; 
  explanation: string;
  detailedGuide?: string;
}

export interface Lab {
  id: string;
  title: string;
  difficulty: 'Beginner' | 'Intermediate' | 'Advanced';
  description: string;
  category: 'Basics' | 'Recon' | 'Exploitation' | 'Post-Exploitation' | 'Forensics' | 'Web' | 'Network';
  objectives: string[];
  hints: string[];
  targetIp: string;
  dynamicTarget?: any; // Detailed machine info
  steps: LabStep[];
}

export interface UserProgress {
  xp: number;
  level: number;
  rank: string;
  skills: {
    recon: number;
    web: number;
    exploit: number;
    forensics: number;
  };
}

export interface SandboxPersistence {
  activeLab: Lab | null;
  currentStepIndex: number;
  completedLabs: string[];
  terminalHistory: TerminalLine[];
  fileSystem: Record<string, string>;
  userProgress: UserProgress;
  lastSaved: number;
}
