/**
 * GET /api/v1/profile/errors — Get user's error history and analysis
 */

import { NextRequest } from 'next/server';
import { createLogger } from '@/lib/logger';
import { readFile } from 'fs/promises';
import { join } from 'path';

const log = createLogger('ProfileErrorsRoute');

function getUserId(req: NextRequest): string {
  return req.headers.get('x-user-id') ?? 'anonymous';
}

function apiError(err: unknown, fallbackStatus: number = 500) {
  const message = err instanceof Error ? err.message : 'Unknown error';
  log.error('error', err);
  return new Response(JSON.stringify({ error: message }), {
    status: fallbackStatus,
    headers: { 'Content-Type': 'application/json' },
  });
}

interface QuizResult {
  topic: string;
  question: string;
  correct: boolean;
  difficulty: number;
  userAnswer: string;
  correctAnswer: string;
}

interface Session {
  id: string;
  userId: string;
  topics: string[];
  quizResults: QuizResult[];
  evaluation: {
    weakPoints: string[];
    strongPoints: string[];
    suggestedFocus: string[];
    overallScore: number;
    feedback: string;
  } | null;
  startedAt: string;
  completedAt: string | null;
}

export async function GET(req: NextRequest) {
  try {
    const userId = getUserId(req);

    // Read sessions directly from file (LearningServiceImpl stores them at
    // data/learning/{userId}/sessions.json) since there is no public
    // getMasterySessions accessor.
    let sessions: Session[] = [];
    try {
      const raw = await readFile(
        join(process.cwd(), 'data', 'learning', userId, 'sessions.json'),
        'utf-8',
      );
      sessions = JSON.parse(raw) as Session[];
    } catch {
      // No sessions file yet — return empty result
    }

    const errorData = sessions.flatMap((s) =>
      (s.quizResults ?? []).map((qr) => ({
        question: qr.question,
        topic: qr.topic ?? 'unknown',
        correct: qr.correct ?? false,
        userAnswer: qr.userAnswer ?? '',
        correctAnswer: qr.correctAnswer ?? '',
        difficulty: qr.difficulty,
        timestamp: s.completedAt ?? s.startedAt,
      })),
    );

    const total = errorData.length;
    const correctCount = errorData.filter((e) => e.correct).length;

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          recent: errorData.slice(0, 20),
          total,
          correctCount,
          errorCount: total - correctCount,
          accuracy: total > 0 ? Math.round((correctCount / total) * 100) : null,
        },
      }),
      { headers: { 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    log.error('GET /api/v1/profile/errors failed:', err);
    return apiError(err);
  }
}
