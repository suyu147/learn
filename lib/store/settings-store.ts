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
  // SmartLearn-specific settings (bridged from v1 useSettingsStore)
  smartlearnProviderId?: string;
  smartlearnModelId?: string;
  smartlearnApiKey?: string;
  smartlearnBaseUrl?: string;
  disabledAgentIds?: string[];
  maxResourceConcurrency?: number;
  // Methods
  setDefaultModel: (m: string) => void;
  setTemperature: (t: number) => void;
  setMaxTokens: (n: number) => void;
  toggleThinkingMode: () => void;
  toggleAutoContextWindow: () => void;
  toggleRateLimit: () => void;
  setTheme: (t: SettingsState['theme']) => void;
  setLanguage: (l: string) => void;
  // SmartLearn setters
  setSmartlearnModel: (providerId: string, modelId: string) => void;
  setSmartlearnApiKey: (key: string) => void;
  setSmartlearnBaseUrl: (url: string) => void;
  setDisabledAgentIds: (ids: string[]) => void;
  setMaxResourceConcurrency: (n: number) => void;
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
      // SmartLearn defaults
      smartlearnProviderId: '',
      smartlearnModelId: '',
      smartlearnApiKey: '',
      smartlearnBaseUrl: '',
      disabledAgentIds: [],
      maxResourceConcurrency: 3,

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

      // SmartLearn methods
      setSmartlearnModel: (providerId, modelId) =>
        set({ smartlearnProviderId: providerId, smartlearnModelId: modelId }),
      setSmartlearnApiKey: (key) => set({ smartlearnApiKey: key }),
      setSmartlearnBaseUrl: (url) => set({ smartlearnBaseUrl: url }),
      setDisabledAgentIds: (ids) => set({ disabledAgentIds: ids }),
      setMaxResourceConcurrency: (n) => set({ maxResourceConcurrency: n }),
    }),
    { name: 'sl-settings-storage' }
  )
);
