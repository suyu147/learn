import { NextRequest } from 'next/server';

const PISTON_API = 'https://emkc.org/api/v2/piston/execute';

const LANGUAGE_VERSIONS: Record<string, string> = {
  python: '3.12.0',
  javascript: '21.7.0',
  typescript: '5.4.5',
  java: '15.0.2',
  cpp: '10.2.0',
  c: '10.2.0',
  go: '1.22.0',
  rust: '1.77.0',
};

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { code, language, stdin } = body as {
      code: string;
      language: string;
      stdin?: string;
    };

    if (!code || !language) {
      return new Response(
        JSON.stringify({ error: { message: 'Missing required fields: code, language' } }),
        { status: 400, headers: { 'Content-Type': 'application/json' } },
      );
    }

    const version = LANGUAGE_VERSIONS[language] || '*';

    const response = await fetch(PISTON_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        language,
        version,
        files: [{ content: code }],
        stdin: stdin || '',
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return new Response(
        JSON.stringify({ error: { message: `Execution failed: ${errorText}` } }),
        { status: 500, headers: { 'Content-Type': 'application/json' } },
      );
    }

    const result = await response.json();
    return new Response(
      JSON.stringify({
        stdout: result.run?.stdout || '',
        stderr: result.run?.stderr || '',
        exitCode: result.run?.code ?? -1,
        signal: result.run?.signal || null,
      }),
      { headers: { 'Content-Type': 'application/json' } },
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: { message: error instanceof Error ? error.message : 'Unknown error' } }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    );
  }
}
