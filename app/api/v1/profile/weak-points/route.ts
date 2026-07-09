/**
 * GET /api/v1/profile/weak-points — Get user's weak points
 */

import { NextRequest } from 'next/server';
import { createLogger } from '@/lib/logger';
import { getLearningService } from '@/lib/deeptutor/bootstrap';
import { readFile } from 'fs/promises';
import { join } from 'path';

const log = createLogger('ProfileWeakPointsRoute');

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
  correct: boolean;
}

interface Session {
  quizResults: QuizResult[];
  startedAt: string;
}

export async function GET(req: NextRequest) {
  try {
    const userId = getUserId(req);
    const svc = getLearningService();

    // 1. Skill map entries with low mastery
    const skillMap = await svc.getSkillMap(userId);

    // 2. Read sessions to aggregate quiz error data per topic
    let sessions: Session[] = [];
    try {
      const raw = await readFile(
        join(process.cwd(), 'data', 'learning', userId, 'sessions.json'),
        'utf-8',
      );
      sessions = JSON.parse(raw) as Session[];
    } catch {
      // no sessions yet
    }

    const topicStats: Record<string, { total: number; errors: number; topic: string; mastery: number }> = {};

    // Seed from skill map
    for (const entry of skillMap.entries) {
      if (!topicStats[entry.topic]) {
        topicStats[entry.topic] = { total: 0, errors: 0, topic: entry.topic, mastery: entry.mastery };
      } else {
        topicStats[entry.topic].mastery = entry.mastery;
      }
    }

    // Aggregate quiz results
    for (const session of sessions) {
      for (const qr of session.quizResults ?? []) {
        const topic = qr.topic ?? 'unknown';
        if (!topicStats[topic]) {
          topicStats[topic] = { total: 0, errors: 0, topic, mastery: 0 };
        }
        topicStats[topic].total++;
        if (!qr.correct) topicStats[topic].errors++;
      }
    }

    // Filter to weak points: low mastery OR has errors
    const weakPoints = Object.values(topicStats)
      .filter((t) => t.mastery < 0.6 || t.errors > 0)
      .map((t) => {
        const errorRate = t.total > 0 ? Math.round((t.errors / t.total) * 100) : 0;
        const severity =
          t.mastery < 0.3 || t.errors >= 3 ? 'high' : t.mastery < 0.5 || t.errors >= 1 ? 'medium' : 'low';
        return {
          topic: t.topic,
          mastery: Math.round(t.mastery * 100),
          errorRate,
          attempts: t.total,
          errors: t.errors,
          severity,
        };
      })
      .sort((a, b) => b.errorRate - a.errorRate || a.mastery - b.mastery);

    return new Response(JSON.stringify({ success: true, data: weakPoints }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    log.error('GET /api/v1/profile/weak-points failed:', err);
    return apiError(err);
  }
}
