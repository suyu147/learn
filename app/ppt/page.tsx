'use client';

import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useSettingsStore } from '@/lib/store/settings';
import { useStageStore } from '@/lib/store/stage';
import { useCanvasStore } from '@/lib/store/canvas';
import { CanvasArea } from '@/components/canvas/canvas-area';
import { PPTSidebar } from '@/components/ppt-sidebar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import {
  Loader2,
  Presentation,
  ArrowLeft,
  ImageIcon,
  Puzzle,
  ChevronDown,
  ChevronUp,
  Settings2,
  Info,
} from 'lucide-react';
import type { Scene } from '@/lib/types/stage';
import type { Action } from '@/lib/types/action';

type EngineState = 'idle' | 'playing' | 'paused';

export default function PPTPage() {
  const router = useRouter();

  const { scenes, currentSceneId, setStage, setScenes, setCurrentSceneId } = useStageStore();
  const { generatePptImages, setGeneratePptImages } = useSettingsStore();

  const [engineState, setEngineState] = useState<EngineState>('idle');
  const [whiteboardOpen, setWhiteboardOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [chatCollapsed, setChatCollapsed] = useState(true);
  const [isPresenting, setIsPresenting] = useState(false);
  const [showStopDiscussion, setShowStopDiscussion] = useState(false);

  const [requirement, setRequirement] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationProgress, setGenerationProgress] = useState('');
  const [generatedScenes, setGeneratedScenes] = useState<Scene[]>([]);

  const [showAdvanced, setShowAdvanced] = useState(false);
  const [imageGenApiKey, setImageGenApiKey] = useState('');
  const [includeInteractive, setIncludeInteractive] = useState(true);

  const actionQueueRef = useRef<Action[]>([]);
  const isPlayingRef = useRef(false);
  const playNextActionRef = useRef<() => void>(() => {});

  useEffect(() => {
    const saved = localStorage.getItem('smartlearn-ppt-settings');
    if (saved) {
      try {
        const s = JSON.parse(saved);
        if (s.imageGenApiKey) setImageGenApiKey(s.imageGenApiKey);
        if (s.includeInteractive !== undefined) setIncludeInteractive(s.includeInteractive);
      } catch { /* ignore */ }
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(
      'smartlearn-ppt-settings',
      JSON.stringify({ imageGenApiKey, includeInteractive }),
    );
  }, [imageGenApiKey, includeInteractive]);

  const currentScene = useMemo(() => {
    if (!currentSceneId) return scenes[0] || null;
    return scenes.find((s) => s.id === currentSceneId) || null;
  }, [scenes, currentSceneId]);

  const currentSceneIndex = useMemo(() => {
    if (!currentScene) return 0;
    return scenes.findIndex((s) => s.id === currentScene.id);
  }, [scenes, currentScene]);

  const playNextAction = useCallback(() => {
    if (actionQueueRef.current.length === 0 || !isPlayingRef.current) {
      setEngineState('idle');
      isPlayingRef.current = false;
      return;
    }

    const action = actionQueueRef.current.shift()!;

    if (action.type === 'spotlight') {
      useCanvasStore.getState().setSpotlight(action.elementId!, { dimness: 0.5 });
      setTimeout(() => useCanvasStore.getState().clearAllEffects(), 3000);
    } else if (action.type === 'laser') {
      useCanvasStore.getState().setLaser(action.elementId!, { color: '#ff0000' });
      setTimeout(() => useCanvasStore.getState().clearAllEffects(), 2000);
    }

    if (actionQueueRef.current.length > 0 && isPlayingRef.current) {
      const delay = action.type === 'speech' ? 2000 : 1000;
      setTimeout(() => playNextActionRef.current(), delay);
    } else {
      setEngineState('idle');
      isPlayingRef.current = false;
    }
  }, []);

  useEffect(() => {
    playNextActionRef.current = playNextAction;
  }, [playNextAction]);

  const handlePlayPause = useCallback(() => {
    if (engineState === 'playing') {
      isPlayingRef.current = false;
      setEngineState('paused');
      return;
    }

    const scene = currentScene;
    if (!scene?.actions || scene.actions.length === 0) return;

    if (engineState === 'idle') {
      actionQueueRef.current = [...scene.actions];
    }

    isPlayingRef.current = true;
    setEngineState('playing');
    playNextAction();
  }, [engineState, currentScene, playNextAction]);

  const handlePrevSlide = useCallback(() => {
    const idx = currentSceneIndex;
    if (idx > 0) {
      setCurrentSceneId(scenes[idx - 1].id);
      isPlayingRef.current = false;
      setEngineState('idle');
      actionQueueRef.current = [];
      useCanvasStore.getState().clearAllEffects();
    }
  }, [currentSceneIndex, scenes, setCurrentSceneId]);

  const handleNextSlide = useCallback(() => {
    const idx = currentSceneIndex;
    if (idx < scenes.length - 1) {
      setCurrentSceneId(scenes[idx + 1].id);
      isPlayingRef.current = false;
      setEngineState('idle');
      actionQueueRef.current = [];
      useCanvasStore.getState().clearAllEffects();
    }
  }, [currentSceneIndex, scenes, setCurrentSceneId]);

  const handleWhiteboardClose = useCallback(() => {
    setWhiteboardOpen((prev) => !prev);
  }, []);

  const handleTogglePresentation = useCallback(() => {
    if (!isPresenting) {
      document.documentElement.requestFullscreen?.();
    } else {
      document.exitFullscreen?.();
    }
    setIsPresenting((prev) => !prev);
  }, [isPresenting]);

  const handleGenerate = useCallback(async () => {
    if (!requirement.trim()) return;

    setIsGenerating(true);
    setGenerationProgress('正在生成动态课件...');
    setGeneratedScenes([]);

    try {
      const settingsStr = localStorage.getItem('smartlearn-settings');
      const settings = settingsStr ? JSON.parse(settingsStr) : {};
      const aiConfig = {
        providerId: settings.providerId,
        modelId: settings.modelId,
        apiKey: settings.apiKey,
        baseUrl: settings.baseUrl,
      };

      const response = await fetch('/api/generate/ppt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requirement: requirement.trim(),
          language: 'zh-CN',
          aiConfig,
          enableImageGeneration: generatePptImages,
          imageGenApiKey: imageGenApiKey || undefined,
          includeInteractive,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error('No response body');

      const decoder = new TextDecoder();
      let buffer = '';
      const allScenes: Scene[] = [];

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try {
            const data = JSON.parse(line.slice(6));

            if (data.type === 'progress') {
              setGenerationProgress(data.message || data.statusMessage || '生成中...');
            } else if (data.type === 'images_ready') {
              setGenerationProgress(`已生成 ${data.count} 张配图`);
            } else if (data.type === 'scene_ready' && data.scene) {
              allScenes.push(data.scene);
              setGeneratedScenes([...allScenes]);
            } else if (data.type === 'generation_complete') {
              setGenerationProgress('生成完成！');

              const stageId = data.stageId || `stage_${Date.now()}`;
              setStage({
                id: stageId,
                title: requirement.trim(),
                mode: 'playback',
                createdAt: Date.now(),
                updatedAt: Date.now(),
              });
              const sortedScenes = allScenes.sort((a: Scene, b: Scene) => a.order - b.order);
              setScenes(sortedScenes);
              if (sortedScenes.length > 0) {
                setCurrentSceneId(sortedScenes[0].id);
              }
            } else if (data.type === 'error') {
              setGenerationProgress(`错误: ${data.message}`);
            }
          } catch {
            // Skip malformed SSE data
          }
        }
      }
    } catch (error) {
      setGenerationProgress(`生成失败: ${String(error)}`);
    } finally {
      setIsGenerating(false);
    }
  }, [requirement, generatePptImages, imageGenApiKey, includeInteractive, setStage, setScenes, setCurrentSceneId]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') handlePrevSlide();
      if (e.key === 'ArrowRight') handleNextSlide();
      if (e.key === ' ') {
        e.preventDefault();
        handlePlayPause();
      }
      if (e.key === 'Escape' && isPresenting) {
        document.exitFullscreen?.();
        setIsPresenting(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handlePrevSlide, handleNextSlide, handlePlayPause, isPresenting]);

  const hasContent = scenes.length > 0;

  return (
    <div className="flex flex-col h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-2 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
        <Button variant="ghost" size="sm" onClick={() => router.push('/')}>
          <ArrowLeft className="w-4 h-4 mr-1" />
          返回
        </Button>
        <Presentation className="w-5 h-5 text-purple-600" />
        <h1 className="text-lg font-bold text-gray-900 dark:text-gray-100">动态课件生成</h1>
      </div>

      {/* Main content */}
      {hasContent ? (
        <div className="flex flex-1 min-h-0">
          {!sidebarCollapsed && scenes.length > 1 && (
            <PPTSidebar
              scenes={scenes}
              currentSceneId={currentScene?.id || null}
              onSelectScene={(id) => {
                setCurrentSceneId(id);
                isPlayingRef.current = false;
                setEngineState('idle');
                actionQueueRef.current = [];
                useCanvasStore.getState().clearAllEffects();
              }}
            />
          )}

          <div className="flex-1 flex flex-col min-w-0">
            <CanvasArea
              currentScene={currentScene}
              currentSceneIndex={currentSceneIndex}
              scenesCount={scenes.length}
              mode="playback"
              engineState={engineState}
              whiteboardOpen={whiteboardOpen}
              sidebarCollapsed={sidebarCollapsed}
              chatCollapsed={chatCollapsed}
              onToggleSidebar={() => setSidebarCollapsed((p) => !p)}
              onToggleChat={() => setChatCollapsed((p) => !p)}
              onPrevSlide={handlePrevSlide}
              onNextSlide={handleNextSlide}
              onPlayPause={handlePlayPause}
              onWhiteboardClose={handleWhiteboardClose}
              isPresenting={isPresenting}
              onTogglePresentation={handleTogglePresentation}
              showStopDiscussion={showStopDiscussion}
              onStopDiscussion={() => {
                setShowStopDiscussion(false);
                isPlayingRef.current = false;
                setEngineState('idle');
              }}
            />
          </div>
        </div>
      ) : (
        /* Generation form */
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="w-full max-w-xl space-y-5">
            <div className="text-center space-y-2">
              <Presentation className="w-12 h-12 text-purple-600 mx-auto" />
              <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                生成动态课件
              </h2>
              <p className="text-gray-500 dark:text-gray-400">
                输入课程主题或知识点，AI将自动生成带有讲解和高光动画的交互式课件
              </p>
            </div>

            <div className="flex gap-2">
              <Input
                value={requirement}
                onChange={(e) => setRequirement(e.target.value)}
                placeholder="例如：Python面向对象编程、数据结构之链表、机器学习基础..."
                className="flex-1"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !isGenerating) handleGenerate();
                }}
                disabled={isGenerating}
              />
              <Button
                onClick={handleGenerate}
                disabled={isGenerating || !requirement.trim()}
                className="bg-purple-600 hover:bg-purple-700 text-white"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    生成中
                  </>
                ) : (
                  '生成课件'
                )}
              </Button>
            </div>

            {/* Advanced Settings */}
            <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
              <button
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="w-full flex items-center justify-between px-4 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-800/50 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              >
                <span className="flex items-center gap-2">
                  <Settings2 className="w-4 h-4" />
                  高级设置
                </span>
                {showAdvanced ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>

              {showAdvanced && (
                <div className="p-4 space-y-4 bg-white dark:bg-gray-900">
                  {/* Interactive HTML toggle */}
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      id="includeInteractive"
                      checked={includeInteractive}
                      onChange={(e) => setIncludeInteractive(e.target.checked)}
                      className="mt-1 w-4 h-4 text-purple-600 rounded border-gray-300 focus:ring-purple-500"
                    />
                    <div className="flex-1">
                      <label htmlFor="includeInteractive" className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                        <Puzzle className="w-4 h-4 text-purple-500" />
                        包含可交互HTML场景
                      </label>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                        生成可操作的交互式演示（如物理实验、数学可视化），用户可直接在课件中操作
                      </p>
                    </div>
                  </div>

                  {/* Image Generation toggle */}
                  <div className="flex items-start gap-3">
                    <Switch checked={generatePptImages} onCheckedChange={setGeneratePptImages} />
                    <div className="flex-1">
                      <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                        <ImageIcon className="w-4 h-4 text-green-500" />
                        AI配图生成
                      </label>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                        该开关来自总设置，打开后会在生成课件时尝试自动生成并插入配图。
                      </p>
                    </div>
                  </div>

                  {/* Image Gen API Key */}
                  {generatePptImages && (
                    <div className="ml-7 space-y-2">
                      <Input
                        type="password"
                        value={imageGenApiKey}
                        onChange={(e) => setImageGenApiKey(e.target.value)}
                        placeholder="输入图片生成API密钥（也可配置在.env中）"
                        className="text-sm"
                      />
                      <div className="flex items-start gap-1.5 text-xs text-gray-400 dark:text-gray-500">
                        <Info className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                        <span>
                          推荐使用SiliconFlow（硅基流动）的免费额度。也可在项目根目录的
                          <code className="px-1 py-0.5 bg-gray-100 dark:bg-gray-800 rounded text-xs">.env</code>
                          文件中配置
                          <code className="px-1 py-0.5 bg-gray-100 dark:bg-gray-800 rounded text-xs">IMAGE_GEN_API_KEY</code>
                          ，无需每次手动输入
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {generationProgress && (
              <div className="text-center text-sm text-gray-500 dark:text-gray-400 animate-pulse">
                {generationProgress}
              </div>
            )}

            {generatedScenes.length > 0 && isGenerating && (
              <div className="text-center text-sm text-purple-600 dark:text-purple-400">
                已生成 {generatedScenes.length} 个场景...
              </div>
            )}

            <div className="text-xs text-gray-400 dark:text-gray-500 text-center space-y-1">
              <p>提示：生成后可使用空格键播放/暂停，方向键翻页，点击播放按钮启动讲解动画</p>
              <p>可交互HTML场景支持直接在课件中操作，如拖拽、点击、输入等</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
