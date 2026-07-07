import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface SettingsState {
  // LLM
  defaultModel: string;
  temperature: number;
  maxTokens: number;
  thinkingMode: boolean;
  autoContextWindow: boolean;
  contextWindowThreshold: number;
  rateLimitEnabled: boolean;
  // Appearance
  theme: 'light' | 'dark' | 'snow' | 'glass' | 'system';
  language: string;
  // Methods
  setDefaultModel: (m: string) => void;
  setTemperature: (t: number) => void;
  setMaxTokens: (n: number) => void;
  toggleThinkingMode: () => void;
  toggleAutoContextWindow: () => void;
  toggleRateLimit: () => void;
  setTheme: (t: SettingsState['theme']) => void;
  setLanguage: (l: string) => void;
}

export const useSettingsStoreV2 = create<SettingsState>()(
  persist(
    (set) => ({
      // LLM defaults
      defaultModel: 'gpt-4o',
      temperature: 0.7,
      maxTokens: 4096,
      thinkingMode: true,
      autoContextWindow: true,
      contextWindowThreshold: 0.9,
      rateLimitEnabled: false,
      // Appearance defaults
      theme: 'system',
      language: 'zh-CN',

      // LLM methods
      setDefaultModel: (m) => set({ defaultModel: m }),
      setTemperature: (t) => set({ temperature: t }),
      setMaxTokens: (n) => set({ maxTokens: n }),
      toggleThinkingMode: () =>
        set((state) => ({ thinkingMode: !state.thinkingMode })),
      toggleAutoContextWindow: () =>
        set((state) => ({ autoContextWindow: !state.autoContextWindow })),
      toggleRateLimit: () =>
        set((state) => ({ rateLimitEnabled: !state.rateLimitEnabled })),

      // Appearance methods
      setTheme: (t) => set({ theme: t }),
      setLanguage: (l) => set({ language: l }),
    }),
    { name: 'sl-settings-storage' }
  )
);
