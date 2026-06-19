'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Send, Loader2, Bot, User, CheckCircle2, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useLearningProfileStore } from '@/lib/store/learning-profile';
import { useSettingsStore } from '@/lib/store/settings';
import { isProfileComplete } from '@/lib/utils/profile-utils';
import type { ConversationMessage } from '@/lib/types/profile';

export function ProfileChat() {
  const router = useRouter();
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [profileComplete, setProfileComplete] = useState(false);
  const [newChatOpen, setNewChatOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const { providerId, modelId, apiKey, baseUrl } = useSettingsStore();
  const { profile, addConversationMessage, updateDimensions, archiveCurrentProfile, reset } =
    useLearningProfileStore();
  const createWelcomeMessage = useCallback((): ConversationMessage => ({
    id: crypto.randomUUID(),
    role: 'assistant',
    content:
      '你好！我是你的学习助手，想了解一下你的学习情况，这样我可以为你推荐最合适的学习资源。\n\n让我先问几个问题：\n1. 你目前学过哪些编程语言或技术？\n2. 你更喜欢通过什么方式学习（看视频、读文档、动手写代码）？\n3. 你学习的主要目标是什么？',
    timestamp: Date.now(),
  }), []);

  // 画像完成后自动跳转
  useEffect(() => {
    if (profileComplete) {
      const timer = setTimeout(() => {
        router.push('/workspace');
      }, 2500);
      return () => clearTimeout(timer);
    }
  }, [profileComplete, profile?.id, router]);

  useEffect(() => {
    if (messages.length === 0) {
      setMessages([createWelcomeMessage()]);
    }
  }, [messages.length, createWelcomeMessage]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleNewChat = () => {
    // 归档当前画像（如果有）
    if (profile) {
      archiveCurrentProfile();
    }
    // 重置 store（清空当前画像）
    reset();
    // 重置本地状态
    setMessages([createWelcomeMessage()]);
    setProfileComplete(false);
    setNewChatOpen(false);
  };

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: ConversationMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: input.trim(),
      timestamp: Date.now(),
    };

    setMessages((prev) => [...prev, userMessage]);
    addConversationMessage(userMessage);
    setInput('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/profile/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMessage.content,
          profile: profile,
          conversationHistory: messages,
          aiConfig: { providerId, modelId, apiKey, baseUrl },
        }),
      });

      if (!response.ok) throw new Error('Failed to get response');

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let assistantContent = '';

      const assistantMessage: ConversationMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: '',
        timestamp: Date.now(),
      };

      setMessages((prev) => [...prev, assistantMessage]);

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split('\n');

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.slice(6));

                if (data.type === 'text_delta') {
                  assistantContent += data.text;
                  setMessages((prev) =>
                    prev.map((m) =>
                      m.id === assistantMessage.id
                        ? { ...m, content: assistantContent }
                        : m,
                    ),
                  );
                } else if (data.type === 'profile_update') {
                  console.log('Received profile update:', data.dimensions);
                  updateDimensions(data.dimensions);
                  // 检查画像是否完整
                  if (isProfileComplete(data.dimensions)) {
                    setProfileComplete(true);
                  }
                }
              } catch {
                // skip non-JSON lines
              }
            }
          }
        }
      }

      addConversationMessage({
        ...assistantMessage,
        content: assistantContent,
      });
    } catch (error) {
      console.error('Chat error:', error);
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: '抱歉，我遇到了一些问题，请稍后再试。',
          timestamp: Date.now(),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex h-[500px] flex-col rounded-lg border">
      <div className="flex items-center gap-2 border-b px-4 py-3">
        <Bot className="h-5 w-5 text-violet-500" />
        <span className="font-medium">画像构建助手</span>
        <div className="ml-auto">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0"
            onClick={() => setNewChatOpen(true)}
            title="新建对话"
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <ScrollArea className="flex-1 p-4" ref={scrollRef}>
        <div className="space-y-4">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex gap-3 ${
                message.role === 'user' ? 'flex-row-reverse' : ''
              }`}
            >
              <div
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                  message.role === 'assistant'
                    ? 'bg-violet-100 text-violet-600 dark:bg-violet-900/30 dark:text-violet-400'
                    : 'bg-primary/10 text-primary'
                }`}
              >
                {message.role === 'assistant' ? (
                  <Bot className="h-4 w-4" />
                ) : (
                  <User className="h-4 w-4" />
                )}
              </div>
              <div
                className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${
                  message.role === 'assistant'
                    ? 'bg-muted'
                    : 'bg-primary text-primary-foreground'
                }`}
              >
                <div className="whitespace-pre-wrap">{message.content}</div>
              </div>
            </div>
          ))}
          {isLoading && messages[messages.length - 1]?.role !== 'assistant' && (
            <div className="flex gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-violet-100 text-violet-600 dark:bg-violet-900/30 dark:text-violet-400">
                <Bot className="h-4 w-4" />
              </div>
              <div className="rounded-lg bg-muted px-3 py-2">
                <Loader2 className="h-4 w-4 animate-spin" />
              </div>
            </div>
          )}
        </div>
      </ScrollArea>

      <div className="border-t p-3">
        {profileComplete && (
          <div className="mb-3 flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-700 dark:border-green-800 dark:bg-green-950 dark:text-green-300">
            <CheckCircle2 className="h-5 w-5 shrink-0" />
            <div>
              <p className="font-medium">画像构建完成!</p>
              <p>即将跳转到学习工作台...</p>
            </div>
          </div>
        )}
        <div className="flex gap-2">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="输入消息..."
            className="min-h-[40px] max-h-[120px] resize-none"
            rows={1}
            disabled={profileComplete}
          />
          <Button
            onClick={handleSend}
            disabled={!input.trim() || isLoading || profileComplete}
            size="icon"
            className="shrink-0"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* 新建对话确认弹窗 */}
      <AlertDialog open={newChatOpen} onOpenChange={setNewChatOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>新建对话</AlertDialogTitle>
            <AlertDialogDescription>
              {profile
                ? '这将归档当前聊天记录并重新开始构建画像。当前记录会保存到历史中，可随时查看。确定要新建吗？'
                : '这将清空当前聊天并重新开始构建画像，确定要新建吗？'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={handleNewChat}>确认新建</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
