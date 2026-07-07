/**
 * LearningService — Mastery tracking and skill map management
 *
 * Provides a higher-level API over the learning-graph for the
 * MasteryPathCapability. Manages:
 * - Skill maps: topic -> mastery level (0.0-1.0)
 * - Mastery sessions: quiz results and evaluation tracking
 * - Spaced repetition: simple SM-2 inspired scheduling
 *
 * Storage layout:
 *   data/learning/{userId}/
 *     skill-map.json           — topic mastery levels
 *     sessions.json            — mastery session history
 *     schedule.json            — spaced repetition schedule
 *
 * Phase 3a
 */

import { createLogger } from '@/lib/logger';
import { readFile, writeFile, mkdir } from 'fs/promises';
import { join } from 'path';

const log = createLogger('LearningService');

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SkillEntry {
  topic: string;
  mastery: number;           // 0.0 to 1.0
  lastReviewed: string;      // ISO date
  reviewCount: number;
  streak: number;            // consecutive correct answers
  nextReviewDate: string;    // ISO date for spaced repetition
  difficulty: number;        // 1-5 scale
}

export interface SkillMap {
  userId: string;
  entries: SkillEntry[];
  updatedAt: string;
}

export interface MasterySession {
  id: string;
  userId: string;
  topics: string[];
  quizResults: MasteryQuizResult[];
  evaluation: MasteryEvaluation | null;
  startedAt: string;
  completedAt: string | null;
}

export interface MasteryQuizResult {
  topic: string;
  question: string;
  correct: boolean;
  difficulty: number;
  userAnswer: string;
  correctAnswer: string;
}

export interface MasteryEvaluation {
  weakPoints: string[];
  strongPoints: string[];
  suggestedFocus: string[];
  overallScore: number;      // 0-100
  feedback: string;
}

export interface ScheduleEntry {
  topic: string;
  dueDate: string;
  priority: number;          // 1-5, higher = more urgent
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const LEARNING_BASE_DIR = 'data/learning';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function generateId(): string {
  return `ms_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function daysFromNow(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

// ---------------------------------------------------------------------------
// LearningServiceImpl
// ---------------------------------------------------------------------------

export class LearningServiceImpl {
  private baseDir: string;

  constructor(baseDir?: string) {
    this.baseDir = baseDir ?? join(process.cwd(), LEARNING_BASE_DIR);
  }

  // -------------------------------------------------------------------------
  // Skill Map
  // -------------------------------------------------------------------------

  /**
   * Read the skill map for a user, creating a default empty one if it
   * does not yet exist on disk.
   */
  async getSkillMap(userId: string): Promise<SkillMap> {
    try {
      const filePath = this.skillMapPath(userId);
      const raw = await readFile(filePath, 'utf-8');
      return JSON.parse(raw) as SkillMap;
    } catch {
      const empty: SkillMap = {
        userId,
        entries: [],
        updatedAt: new Date().toISOString(),
      };
      await this.saveSkillMap(userId, empty);
      return empty;
    }
  }

  /**
   * SM-2 inspired mastery update.
   *
   * correct = true  -> mastery increases, streak grows, interval expands
   * correct = false -> mastery decreases, streak resets, review tomorrow
   */
  async updateMastery(
    userId: string,
    topic: string,
    correct: boolean,
    difficulty: number,
  ): Promise<SkillEntry> {
    const map = await this.getSkillMap(userId);

    let entry = map.entries.find((e) => e.topic === topic);

    if (!entry) {
      entry = {
        topic,
        mastery: 0.0,
        lastReviewed: new Date().toISOString(),
        reviewCount: 0,
        streak: 0,
        nextReviewDate: daysFromNow(1),
        difficulty: clamp(difficulty, 1, 5),
      };
      map.entries.push(entry);
    }

    // --- SM-2 inspired update ---
    if (correct) {
      entry.mastery = clamp(
        entry.mastery + 0.1 * (1 + entry.streak * 0.05),
        0,
        1.0,
      );
      entry.streak += 1;
      const interval = Math.min(30, 1 * Math.pow(2, entry.streak - 1));
      entry.nextReviewDate = daysFromNow(interval);
    } else {
      entry.mastery = clamp(
        entry.mastery - 0.15 * clamp(difficulty, 1, 5),
        0,
        1.0,
      );
      entry.streak = 0;
      entry.nextReviewDate = daysFromNow(1);
    }

    entry.lastReviewed = new Date().toISOString();
    entry.reviewCount += 1;
    entry.difficulty = clamp(difficulty, 1, 5);

    map.updatedAt = new Date().toISOString();
    await this.saveSkillMap(userId, map);

    log.debug(`updateMastery userId=${userId} topic=${topic} correct=${correct} mastery=${entry.mastery.toFixed(3)}`);
    return entry;
  }

  /**
   * Return the mastery level for a single topic (0 if unknown).
   */
  async getMasteryLevel(userId: string, topic: string): Promise<number> {
    try {
      const map = await this.getSkillMap(userId);
      const entry = map.entries.find((e) => e.topic === topic);
      return entry ? entry.mastery : 0;
    } catch (err) {
      log.error('getMasteryLevel failed', err);
      return 0;
    }
  }

  /**
   * Topics where mastery is below the given threshold (default 0.6).
   */
  async getWeakTopics(userId: string, threshold: number = 0.6): Promise<string[]> {
    try {
      const map = await this.getSkillMap(userId);
      return map.entries
        .filter((e) => e.mastery < threshold)
        .map((e) => e.topic);
    } catch (err) {
      log.error('getWeakTopics failed', err);
      return [];
    }
  }

  /**
   * Topics where mastery is above the given threshold (default 0.8).
   */
  async getStrongTopics(userId: string, threshold: number = 0.8): Promise<string[]> {
    try {
      const map = await this.getSkillMap(userId);
      return map.entries
        .filter((e) => e.mastery >= threshold)
        .map((e) => e.topic);
    } catch (err) {
      log.error('getStrongTopics failed', err);
      return [];
    }
  }

  // -------------------------------------------------------------------------
  // Mastery Sessions
  // -------------------------------------------------------------------------

  /**
   * Create a new mastery evaluation session for the given topics.
   */
  async createMasterySession(
    userId: string,
    topics: string[],
  ): Promise<MasterySession> {
    const session: MasterySession = {
      id: generateId(),
      userId,
      topics,
      quizResults: [],
      evaluation: null,
      startedAt: new Date().toISOString(),
      completedAt: null,
    };

    try {
      const sessions = await this.loadSessions(userId);
      sessions.push(session);
      await this.saveSessions(userId, sessions);
      log.info(`createMasterySession id=${session.id} userId=${userId} topics=${topics.length}`);
    } catch (err) {
      log.error('createMasterySession failed', err);
    }

    return session;
  }

  /**
   * Append a quiz result to an active session and update the skill map
   * for the result's topic.
   */
  async addQuizResult(
    userId: string,
    sessionId: string,
    result: MasteryQuizResult,
  ): Promise<MasterySession | null> {
    try {
      const sessions = await this.loadSessions(userId);
      const session = sessions.find((s) => s.id === sessionId);
      if (!session) {
        log.warn(`addQuizResult: session ${sessionId} not found for user ${userId}`);
        return null;
      }

      session.quizResults.push(result);
      await this.saveSessions(userId, sessions);

      // Also update the skill map for this topic
      await this.updateMastery(userId, result.topic, result.correct, result.difficulty);

      log.debug(`addQuizResult session=${sessionId} topic=${result.topic} correct=${result.correct}`);
      return session;
    } catch (err) {
      log.error('addQuizResult failed', err);
      return null;
    }
  }

  /**
   * Mark a session as complete with the given evaluation.
   */
  async completeMasterySession(
    userId: string,
    sessionId: string,
    evaluation: MasteryEvaluation,
  ): Promise<MasterySession | null> {
    try {
      const sessions = await this.loadSessions(userId);
      const session = sessions.find((s) => s.id === sessionId);
      if (!session) {
        log.warn(`completeMasterySession: session ${sessionId} not found for user ${userId}`);
        return null;
      }

      session.evaluation = evaluation;
      session.completedAt = new Date().toISOString();
      await this.saveSessions(userId, sessions);

      log.info(`completeMasterySession id=${sessionId} score=${evaluation.overallScore}`);
      return session;
    } catch (err) {
      log.error('completeMasterySession failed', err);
      return null;
    }
  }

  // -------------------------------------------------------------------------
  // Spaced Repetition Schedule
  // -------------------------------------------------------------------------

  /**
   * Return the current schedule sorted by priority (highest first),
   * then by due date (earliest first).
   */
  async getSchedule(userId: string): Promise<ScheduleEntry[]> {
    try {
      const schedule = await this.loadSchedule(userId);
      return schedule.sort((a, b) => {
        if (b.priority !== a.priority) return b.priority - a.priority;
        return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
      });
    } catch (err) {
      log.error('getSchedule failed', err);
      return [];
    }
  }

  /**
   * Recalculate the schedule from the current skill map.
   *
   * Priority assignment:
   *   mastery < 0.3  -> priority 5 (critical)
   *   mastery < 0.5  -> priority 4
   *   mastery < 0.7  -> priority 3
   *   mastery < 0.85 -> priority 2
   *   otherwise      -> priority 1
   *
   * Only topics with a review date in the past or within the next 7 days
   * are included.
   */
  async refreshSchedule(userId: string): Promise<ScheduleEntry[]> {
    try {
      const map = await this.getSkillMap(userId);
      const now = Date.now();
      const horizon = now + 7 * 24 * 60 * 60 * 1000; // 7 days from now

      const entries: ScheduleEntry[] = [];

      for (const skill of map.entries) {
        const due = new Date(skill.nextReviewDate).getTime();
        if (due > horizon) continue;

        let priority: number;
        if (skill.mastery < 0.3) {
          priority = 5;
        } else if (skill.mastery < 0.5) {
          priority = 4;
        } else if (skill.mastery < 0.7) {
          priority = 3;
        } else if (skill.mastery < 0.85) {
          priority = 2;
        } else {
          priority = 1;
        }

        // Boost priority for overdue items
        if (due < now) {
          priority = Math.min(5, priority + 1);
        }

        entries.push({
          topic: skill.topic,
          dueDate: skill.nextReviewDate,
          priority,
        });
      }

      entries.sort((a, b) => {
        if (b.priority !== a.priority) return b.priority - a.priority;
        return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
      });

      await this.saveSchedule(userId, entries);

      log.debug(`refreshSchedule userId=${userId} entries=${entries.length}`);
      return entries;
    } catch (err) {
      log.error('refreshSchedule failed', err);
      return [];
    }
  }

  // -------------------------------------------------------------------------
  // Private — file I/O helpers
  // -------------------------------------------------------------------------

  private userDir(userId: string): string {
    return join(this.baseDir, userId);
  }

  private skillMapPath(userId: string): string {
    return join(this.userDir(userId), 'skill-map.json');
  }

  private sessionsPath(userId: string): string {
    return join(this.userDir(userId), 'sessions.json');
  }

  private schedulePath(userId: string): string {
    return join(this.userDir(userId), 'schedule.json');
  }

  private async saveSkillMap(userId: string, map: SkillMap): Promise<void> {
    const dir = this.userDir(userId);
    await mkdir(dir, { recursive: true });
    await writeFile(this.skillMapPath(userId), JSON.stringify(map, null, 2), 'utf-8');
  }

  private async loadSessions(userId: string): Promise<MasterySession[]> {
    try {
      const raw = await readFile(this.sessionsPath(userId), 'utf-8');
      return JSON.parse(raw) as MasterySession[];
    } catch {
      return [];
    }
  }

  private async saveSessions(userId: string, sessions: MasterySession[]): Promise<void> {
    const dir = this.userDir(userId);
    await mkdir(dir, { recursive: true });
    await writeFile(this.sessionsPath(userId), JSON.stringify(sessions, null, 2), 'utf-8');
  }

  private async loadSchedule(userId: string): Promise<ScheduleEntry[]> {
    try {
      const raw = await readFile(this.schedulePath(userId), 'utf-8');
      return JSON.parse(raw) as ScheduleEntry[];
    } catch {
      return [];
    }
  }

  private async saveSchedule(userId: string, schedule: ScheduleEntry[]): Promise<void> {
    const dir = this.userDir(userId);
    await mkdir(dir, { recursive: true });
    await writeFile(this.schedulePath(userId), JSON.stringify(schedule, null, 2), 'utf-8');
  }
}
