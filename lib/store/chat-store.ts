import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface ToolCall {
  name: string;
  status: string;
  input: string;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  thinking?: string;
  toolCalls?: ToolCall[];
}

interface ChatState {
  messages: ChatMessage[];
  isStreaming: boolean;
  currentCapability: string;
  selectedModel: string;
  addMessage: (msg: ChatMessage) => void;
  setStreaming: (v: boolean) => void;
  setCapability: (cap: string) => void;
  setModel: (model: string) => void;
  clearMessages: () => void;
}

export const useChatStore = create<ChatState>()(
  persist(
    (set) => ({
      messages: [],
      isStreaming: false,
      currentCapability: 'chat',
      selectedModel: 'gpt-4o',

      addMessage: (msg) =>
        set((state) => ({
          messages: [...state.messages, msg],
        })),

      setStreaming: (v) => set({ isStreaming: v }),

      setCapability: (cap) => set({ currentCapability: cap }),

      setModel: (model) => set({ selectedModel: model }),

      clearMessages: () => set({ messages: [] }),
    }),
    { name: 'sl-chat-storage' }
  )
);
