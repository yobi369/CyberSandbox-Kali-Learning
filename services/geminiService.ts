
import { GoogleGenAI, Modality } from "@google/genai";
import { Lab } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });

export const generateMission = async (difficulty: string): Promise<Lab> => {
  const minSteps = 25;
  const complexity = difficulty === 'Advanced' ? 'chained exploits, internal pivoting, and log clearing' : 'deep service enumeration and vulnerability analysis';

  const response = await ai.models.generateContent({
    model: 'gemini-3-pro-preview',
    contents: `Generate a 25-step ELITE cybersecurity lab for a Kali Linux sandbox. 
    Level: ${difficulty}. Theme: ${complexity}.
    Must be a valid JSON object. 
    Steps must be sequential and use real Kali tools: nmap, gobuster, hydra, nikto, msfconsole, searchsploit, etc.
    Include 'detailedGuide' for every step explaining professional hacker methodology.`,
    config: {
      responseMimeType: "application/json",
    }
  });

  return JSON.parse(response.text);
};

export const getMentorResponse = async (userCommand: string, output: string, currentLab: Lab | null) => {
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `Action: ${userCommand}\nOutput: ${output}\nMission: ${currentLab?.title || 'Sandbox'}. Provide elite, short feedback.`,
  });
  return response.text;
};

export const speakInstruction = async (text: string) => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text: `Say with a tactical, robotic, calm military voice: ${text}` }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Charon' } },
        },
      },
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (base64Audio) {
      const audioData = atob(base64Audio);
      const arrayBuffer = new ArrayBuffer(audioData.length);
      const view = new Uint8Array(arrayBuffer);
      for (let i = 0; i < audioData.length; i++) view[i] = audioData.charCodeAt(i);
      
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      const dataInt16 = new Int16Array(arrayBuffer);
      const buffer = ctx.createBuffer(1, dataInt16.length, 24000);
      const channelData = buffer.getChannelData(0);
      for (let i = 0; i < dataInt16.length; i++) channelData[i] = dataInt16[i] / 32768.0;
      
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(ctx.destination);
      source.start();
    }
  } catch (e) {
    console.error("Audio synthesis failed", e);
  }
};
