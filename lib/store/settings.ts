import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { TTSProviderId, ASRProviderId, TTSProviderConfig, ASRProviderConfig } from '@/lib/audio/types';

interface SettingsState {
  providerId: string;
  modelId: string;
  apiKey: string;
  apiSecret: string;
  baseUrl: string;
  theme: 'light' | 'dark' | 'system';
  language: 'zh-CN' | 'en-US';
  generatePptImages: boolean;
  maxTurns: string;
  selectedAgentIds: string[];
  asrProviderId: ASRProviderId;
  asrLanguage: string;
  asrProvidersConfig: Partial<Record<ASRProviderId, ASRProviderConfig>>;
  ttsProviderId: TTSProviderId;
  ttsVoice: string;
  ttsSpeed: number;
  ttsProvidersConfig: Partial<Record<TTSProviderId, TTSProviderConfig>>;
  setProviderId: (id: string) => void;
  setModelId: (id: string) => void;
  setApiKey: (key: string) => void;
  setApiSecret: (secret: string) => void;
  setBaseUrl: (url: string) => void;
  setTheme: (theme: 'light' | 'dark' | 'system') => void;
  setLanguage: (lang: 'zh-CN' | 'en-US') => void;
  setGeneratePptImages: (enabled: boolean) => void;
  setMaxTurns: (turns: string) => void;
  setSelectedAgentIds: (ids: string[]) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      providerId: 'spark',
      modelId: 'spark-4.0-turbo',
      apiKey: '',
      apiSecret: '',
      baseUrl: '',
      theme: 'system',
      language: 'zh-CN',
      generatePptImages: false,
      maxTurns: '',
      selectedAgentIds: [],
      asrProviderId: 'openai-whisper' as ASRProviderId,
      asrLanguage: 'auto',
      asrProvidersConfig: {},
      ttsProviderId: 'openai-tts' as TTSProviderId,
      ttsVoice: 'alloy',
      ttsSpeed: 1.0,
      ttsProvidersConfig: {},
      setProviderId: (providerId) => set({ providerId }),
      setModelId: (modelId) => set({ modelId }),
      setApiKey: (apiKey) => set({ apiKey }),
      setApiSecret: (apiSecret) => set({ apiSecret }),
      setBaseUrl: (baseUrl) => set({ baseUrl }),
      setTheme: (theme) => set({ theme }),
      setLanguage: (language) => set({ language }),
      setGeneratePptImages: (generatePptImages) => set({ generatePptImages }),
      setMaxTurns: (maxTurns) => set({ maxTurns }),
      setSelectedAgentIds: (selectedAgentIds) => set({ selectedAgentIds }),
    }),
    { name: 'settings-storage' },
  ),
);
