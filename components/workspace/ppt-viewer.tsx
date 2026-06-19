'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Pause, Play, RotateCcw, SkipForward } from 'lucide-react';
import { useSlideBackgroundStyle } from '@/lib/hooks/use-slide-background-style';
import { ScreenElement } from '@/components/slide-renderer/Editor/ScreenElement';
import { QuizRenderer } from '@/components/slide-renderer/Editor/QuizRenderer';
import { computeContentHeight, sortPPTElements } from '@/components/slide-renderer/Editor/ScreenCanvas';
import { SpotlightOverlay } from '@/components/slide-renderer/Editor/SpotlightOverlay';
import { LaserOverlay } from '@/components/slide-renderer/Editor/LaserOverlay';
import type { Action } from '@/lib/types/action';
import type { Scene } from '@/lib/types/stage';
import type { PPTElement, SlideBackground } from '@/lib/types/slides';

const CANVAS_WIDTH = 1000;
const CANVAS_HEIGHT = 562.5;

type EngineState = 'idle' | 'playing' | 'paused';

interface Props {
  scenes?: Scene[];
}

interface SpotlightState {
  elementId: string;
  dimness: number;
}

interface LaserState {
  elementId: string;
  color: string;
}

function SlidePreview({
  scene,
  spotlight,
  laser,
}: {
  scene: Scene;
  spotlight: SpotlightState | null;
  laser: LaserState | null;
}) {
  const slideData = scene.type === 'slide'
    ? (scene.content as { type: string; canvas?: import('@/lib/types/slides').Slide }).canvas
    : null;
  const quizData = scene.type === 'quiz'
    ? (scene.content as { type: string; questions?: import('@/lib/types/stage').QuizQuestion[] }).questions ?? []
    : [];
  const interactiveHtml = scene.type === 'interactive'
    ? (scene.content as { type: string; html?: string; url?: string }).html
    : undefined;

  const contentHeight = useMemo(() => {
    if (!slideData?.elements) return CANVAS_HEIGHT;
    return computeContentHeight(slideData.elements);
  }, [slideData]);

  const { backgroundStyle } = useSlideBackgroundStyle(slideData?.background as SlideBackground | undefined);

  if (scene.type === 'quiz') {
    return (
      <div className="rounded-lg border bg-white p-4">
        <QuizRenderer questions={quizData} title={scene.title} />
      </div>
    );
  }

  if (scene.type === 'interactive') {
    return (
      <div className="overflow-hidden rounded-lg border bg-white">
        {interactiveHtml ? (
          <iframe
            srcDoc={interactiveHtml}
            className="h-[560px] w-full border-0"
            sandbox="allow-scripts allow-same-origin"
            title={scene.title}
          />
        ) : (
          <div className="flex h-[320px] items-center justify-center text-sm text-muted-foreground">
            暂无交互内容
          </div>
        )}
      </div>
    );
  }

  if (!slideData) {
    return (
      <div className="flex h-[320px] items-center justify-center rounded-lg border bg-white text-sm text-muted-foreground">
        暂无课件内容
      </div>
    );
  }

  const elements = sortPPTElements(slideData.elements ?? []);

  return (
    <div className="overflow-auto rounded-lg border bg-muted/10 p-6">
      <div
        className="mx-auto origin-top shadow-lg"
        style={{
          width: CANVAS_WIDTH,
          minHeight: CANVAS_HEIGHT,
          height: contentHeight,
          ...backgroundStyle,
        }}
      >
        <div className="relative" style={{ width: CANVAS_WIDTH, minHeight: CANVAS_HEIGHT, height: contentHeight }}>
          {elements.map((element: PPTElement) => (
            <ScreenElement key={element.id} element={element} contentHeight={contentHeight} />
          ))}
          {spotlight && <SpotlightOverlay scene={scene} elementId={spotlight.elementId} dimness={spotlight.dimness} />}
          {laser && <LaserOverlay scene={scene} elementId={laser.elementId} color={laser.color} />}
        </div>
      </div>
    </div>
  );
}

export function PPTViewer({ scenes }: Props) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [engineState, setEngineState] = useState<EngineState>('idle');
  const [spotlight, setSpotlight] = useState<SpotlightState | null>(null);
  const [laser, setLaser] = useState<LaserState | null>(null);

  const safeScenes = scenes ?? [];
  const clampedIndex = Math.min(currentIndex, Math.max(safeScenes.length - 1, 0));
  const scene = safeScenes[clampedIndex];
  const actionQueueRef = useRef<Action[]>([]);
  const isPlayingRef = useRef(false);
  const effectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const nextActionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const playNextActionRef = useRef<() => void>(() => {});

  const clearTimersAndEffects = useCallback(() => {
    if (effectTimerRef.current) {
      clearTimeout(effectTimerRef.current);
      effectTimerRef.current = null;
    }
    if (nextActionTimerRef.current) {
      clearTimeout(nextActionTimerRef.current);
      nextActionTimerRef.current = null;
    }
    setSpotlight(null);
    setLaser(null);
  }, []);

  const stopPlayback = useCallback(() => {
    isPlayingRef.current = false;
    actionQueueRef.current = [];
    setEngineState('idle');
    clearTimersAndEffects();
  }, [clearTimersAndEffects]);

  const playNextAction = useCallback(() => {
    if (actionQueueRef.current.length === 0 || !isPlayingRef.current) {
      setEngineState('idle');
      isPlayingRef.current = false;
      return;
    }

    const action = actionQueueRef.current.shift()!;
    clearTimersAndEffects();

    if (action.type === 'spotlight' && action.elementId) {
      setSpotlight({ elementId: action.elementId, dimness: action.dimOpacity ?? 0.5 });
      effectTimerRef.current = setTimeout(() => setSpotlight(null), 3000);
    } else if (action.type === 'laser' && action.elementId) {
      setLaser({ elementId: action.elementId, color: action.color || '#ff0000' });
      effectTimerRef.current = setTimeout(() => setLaser(null), 2000);
    }

    if (actionQueueRef.current.length > 0 && isPlayingRef.current) {
      const delay = action.type === 'speech' ? 2000 : 1000;
      nextActionTimerRef.current = setTimeout(() => playNextActionRef.current(), delay);
    } else {
      nextActionTimerRef.current = setTimeout(() => {
        clearTimersAndEffects();
        setEngineState('idle');
        isPlayingRef.current = false;
      }, action.type === 'spotlight' ? 3000 : action.type === 'laser' ? 2000 : 500);
    }
  }, [clearTimersAndEffects]);

  useEffect(() => {
    playNextActionRef.current = playNextAction;
  }, [playNextAction]);

  useEffect(() => {
    stopPlayback();
  }, [clampedIndex, stopPlayback]);

  useEffect(() => () => stopPlayback(), [stopPlayback]);

  const handlePlayPause = useCallback(() => {
    if (!scene?.actions?.length) return;

    if (engineState === 'playing') {
      isPlayingRef.current = false;
      setEngineState('paused');
      if (nextActionTimerRef.current) {
        clearTimeout(nextActionTimerRef.current);
        nextActionTimerRef.current = null;
      }
      return;
    }

    if (engineState === 'idle') {
      actionQueueRef.current = [...scene.actions];
      clearTimersAndEffects();
    }

    isPlayingRef.current = true;
    setEngineState('playing');
    playNextAction();
  }, [clearTimersAndEffects, engineState, playNextAction, scene]);

  const canPlayEffects = !!scene?.actions?.some((action) => action.type === 'spotlight' || action.type === 'laser');

  if (safeScenes.length === 0) {
    return (
      <div className="flex h-[400px] items-center justify-center rounded-lg border">
        <p className="text-muted-foreground">课件内容加载中...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h3 className="text-base font-medium">{scene?.title}</h3>
          <span className="text-sm text-muted-foreground">
            场景 {clampedIndex + 1} / {safeScenes.length}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={!canPlayEffects}
            onClick={handlePlayPause}
          >
            {engineState === 'playing' ? <Pause className="mr-1 h-4 w-4" /> : <Play className="mr-1 h-4 w-4" />}
            {engineState === 'playing' ? '暂停特效' : '播放特效'}
          </Button>
          <Button variant="outline" size="sm" disabled={engineState === 'idle'} onClick={stopPlayback}>
            <RotateCcw className="mr-1 h-4 w-4" />
            重置
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={clampedIndex === 0}
            onClick={() => setCurrentIndex((index) => index - 1)}
          >
            上一个
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={clampedIndex >= safeScenes.length - 1}
            onClick={() => setCurrentIndex((index) => index + 1)}
          >
            <SkipForward className="mr-1 h-4 w-4" />
            下一个
          </Button>
        </div>
      </div>

      {scene ? <SlidePreview scene={scene} spotlight={spotlight} laser={laser} /> : null}

      <div className="flex justify-center gap-2">
        {safeScenes.map((_, index) => (
          <button
            key={index}
            className={`h-2 rounded-full transition-all ${
              index === clampedIndex ? 'w-4 bg-primary' : 'w-2 bg-muted-foreground/30'
            }`}
            onClick={() => setCurrentIndex(index)}
            aria-label={`跳转到场景 ${index + 1}`}
          />
        ))}
      </div>
    </div>
  );
}
