import { NextRequest } from 'next/server';
import { streamLLM } from '@/lib/ai/llm';
import { resolveModel } from '@/lib/server/resolve-model';
import { parseJsonResponse } from '@/lib/generation/json-repair';
import type { ProfileDimensions } from '@/lib/types/profile';
import type { ProviderId } from '@/lib/types/provider';
import evaluationPrompt from '@/lib/prompts/evaluation-prompt.json';

const EVALUATION_SYSTEM_PROMPT = evaluationPrompt.systemPrompt;

interface QuizResult {
  questionId: string;
  question: string;
  knowledgePoints: string[];
  correct: boolean;
  userAnswer: string;
  correctAnswer: string;
  difficulty: number;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { quizResults, profile, aiConfig } = body as {
      quizResults: QuizResult[];
      profile: ProfileDimensions | null;
      aiConfig?: { providerId?: string; modelId?: string; apiKey?: string; baseUrl?: string };
    };

    if (!quizResults || !Array.isArray(quizResults) || quizResults.length === 0) {
      return new Response(
        JSON.stringify({ error: { message: 'Missing required field: quizResults' } }),
        { status: 400, headers: { 'Content-Type': 'application/json' } },
      );
    }

    const { model } = resolveModel({
      providerId: aiConfig?.providerId as ProviderId | undefined,
      modelString: aiConfig?.modelId,
      apiKey: aiConfig?.apiKey,
      baseUrl: aiConfig?.baseUrl,
    });

    const correctCount = quizResults.filter(r => r.correct).length;
    const totalCount = quizResults.length;
    const score = Math.round((correctCount / totalCount) * 100);

    const resultsSummary = quizResults.map(r =>
      `[${r.correct ? '✓' : '✗'}] 难度${r.difficulty}/5 | 知识点: ${r.knowledgePoints.join(', ')} | 题目: ${r.question} | 学生答案: ${r.userAnswer} | 正确答案: ${r.correctAnswer}`
    ).join('\n');

    const profileContext = profile
      ? `\n\n当前学习画像：\n${JSON.stringify(profile, null, 2)}`
      : '\n\n暂无学习画像数据';

    const result = streamLLM(
      {
        model,
        system: EVALUATION_SYSTEM_PROMPT,
        prompt: `练习结果（得分: ${score}/${totalCount}，正确率: ${score}%）：\n${resultsSummary}${profileContext}`,
        maxOutputTokens: 2048,
      },
      'evaluate',
    );

    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();
        let fullContent = '';

        try {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ type: 'agent_start', agent: 'evaluation' })}\n\n`),
          );

          for await (const chunk of result.textStream) {
            fullContent += chunk;
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ type: 'text_delta', text: chunk })}\n\n`),
            );
          }

          const evaluation = parseJsonResponse<{
            weakPoints: string[];
            strongPoints: string[];
            suggestedFocus: string[];
            profileUpdate: ProfileDimensions | null;
            feedback: string;
          }>(fullContent);

          if (evaluation) {
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({ type: 'evaluation_result', evaluation, score })}\n\n`,
              ),
            );
          }

          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ type: 'agent_end', agent: 'evaluation' })}\n\n`),
          );
        } catch (error) {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ type: 'error', message: String(error) })}\n\n`),
          );
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({ error: { message: String(error) } }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    );
  }
}
