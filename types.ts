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

export type AssessmentDimension = 'evidence' | 'reasoning' | 'confidence' | 'remediation';

export interface AssessmentCriterion {
  id: string;
  label: string;
  dimension: AssessmentDimension;
  signalGroups: string[][];
  weight: number;
  guidance: string;
  strongAnswer: string;
}

export interface LabAssessment {
  prompt: string;
  criteria: AssessmentCriterion[];
}

export interface AssessmentFeedbackItem {
  criterionId: string;
  dimension: AssessmentDimension;
  level: 0 | 1 | 2 | 3 | 4;
  score: number;
  feedback: string;
  nextStep: string;
}

export interface AssessmentResult {
  submission: string;
  score: number;
  maxScore: number;
  dimensionScores: Record<AssessmentDimension, number>;
  criterionScores: Record<string, number>;
  matchedCriteria: string[];
  missingCriteria: string[];
  feedback: AssessmentFeedbackItem[];
  submittedAt: number;
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
  dynamicTarget?: any;
  steps: LabStep[];
  assessment?: LabAssessment;
}

export interface UserProgress {
  xp: number;
  level: number;
  rank: string;
  skills: { recon: number; web: number; exploit: number; forensics: number };
}

export interface SandboxPersistence {
  activeLab: Lab | null;
  currentStepIndex: number;
  completedLabs: string[];
  assessmentResults?: Record<string, AssessmentResult>;
  terminalHistory: TerminalLine[];
  fileSystem: Record<string, string>;
  userProgress: UserProgress;
  lastSaved: number;
}
