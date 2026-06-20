import { NextRequest, NextResponse } from 'next/server';
import { writeFile, readFile } from 'fs/promises';
import { join } from 'path';
import { createLogger } from '@/lib/logger';
const log = createLogger('SettingsAPI');

const ENV_PATH = join(process.cwd(), '.env');

function maskKey(key: string): string {
  if (!key || key.length <= 4) return key ? '****' : '';
  return '****' + key.slice(-4);
}

export async function GET() {
  try {
    let envContent = '';
    try {
      envContent = await readFile(ENV_PATH, 'utf-8');
    } catch {
      // .env file doesn't exist yet
    }

    const config: Record<string, string> = {};
    for (const line of envContent.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIndex = trimmed.indexOf('=');
      if (eqIndex === -1) continue;
      const key = trimmed.substring(0, eqIndex).trim();
      const value = trimmed.substring(eqIndex + 1).trim();
      config[key] = value;
    }

    const imageGenConfig = {
      IMAGE_GEN_PROVIDER: config.IMAGE_GEN_PROVIDER || 'siliconflow',
      IMAGE_GEN_API_KEY: maskKey(config.IMAGE_GEN_API_KEY || ''),
      IMAGE_GEN_BASE_URL: config.IMAGE_GEN_BASE_URL || '',
      IMAGE_GEN_MODEL: config.IMAGE_GEN_MODEL || '',
      DOUBAO_IMAGE_API_KEY: maskKey(config.DOUBAO_IMAGE_API_KEY || ''),
      DOUBAO_IMAGE_BASE_URL: config.DOUBAO_IMAGE_BASE_URL || '',
      DOUBAO_IMAGE_MODEL: config.DOUBAO_IMAGE_MODEL || '',
      hasImageGenKey: !!(config.IMAGE_GEN_API_KEY && config.IMAGE_GEN_API_KEY !== 'your_image_gen_api_key_here'),
      hasDoubaoKey: !!(config.DOUBAO_IMAGE_API_KEY && config.DOUBAO_IMAGE_API_KEY !== 'your_doubao_image_api_key_here'),
    };

    return NextResponse.json({ imageGenConfig });
  } catch (error) {
    log.error('Failed to read settings:', error);
    return NextResponse.json({ error: 'Failed to read settings' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { imageGenConfig } = body as {
      imageGenConfig?: {
        IMAGE_GEN_PROVIDER?: string;
        IMAGE_GEN_API_KEY?: string;
        IMAGE_GEN_BASE_URL?: string;
        IMAGE_GEN_MODEL?: string;
        DOUBAO_IMAGE_API_KEY?: string;
        DOUBAO_IMAGE_BASE_URL?: string;
        DOUBAO_IMAGE_MODEL?: string;
      };
    };

    if (!imageGenConfig) {
      return NextResponse.json({ error: 'No config provided' }, { status: 400 });
    }

    let envContent = '';
    try {
      envContent = await readFile(ENV_PATH, 'utf-8');
    } catch {
      // .env file doesn't exist yet
    }

    const updates: Record<string, string> = {};

    if (imageGenConfig.IMAGE_GEN_PROVIDER) updates.IMAGE_GEN_PROVIDER = imageGenConfig.IMAGE_GEN_PROVIDER;
    if (imageGenConfig.IMAGE_GEN_BASE_URL) updates.IMAGE_GEN_BASE_URL = imageGenConfig.IMAGE_GEN_BASE_URL;
    if (imageGenConfig.IMAGE_GEN_MODEL) updates.IMAGE_GEN_MODEL = imageGenConfig.IMAGE_GEN_MODEL;
    if (imageGenConfig.IMAGE_GEN_API_KEY && !imageGenConfig.IMAGE_GEN_API_KEY.startsWith('****')) {
      updates.IMAGE_GEN_API_KEY = imageGenConfig.IMAGE_GEN_API_KEY;
    }
    if (imageGenConfig.DOUBAO_IMAGE_BASE_URL) updates.DOUBAO_IMAGE_BASE_URL = imageGenConfig.DOUBAO_IMAGE_BASE_URL;
    if (imageGenConfig.DOUBAO_IMAGE_MODEL) updates.DOUBAO_IMAGE_MODEL = imageGenConfig.DOUBAO_IMAGE_MODEL;
    if (imageGenConfig.DOUBAO_IMAGE_API_KEY && !imageGenConfig.DOUBAO_IMAGE_API_KEY.startsWith('****')) {
      updates.DOUBAO_IMAGE_API_KEY = imageGenConfig.DOUBAO_IMAGE_API_KEY;
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ success: true, message: 'No changes to save' });
    }

    const lines = envContent.split('\n');
    const updatedKeys = new Set<string>();

    const newLines = lines.map((line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) return line;

      const eqIndex = trimmed.indexOf('=');
      if (eqIndex === -1) return line;

      const key = trimmed.substring(0, eqIndex).trim();
      if (updates[key] !== undefined) {
        updatedKeys.add(key);
        return `${key}=${updates[key]}`;
      }
      return line;
    });

    for (const [key, value] of Object.entries(updates)) {
      if (!updatedKeys.has(key)) {
        newLines.push(`${key}=${value}`);
      }
    }

    await writeFile(ENV_PATH, newLines.join('\n'), 'utf-8');

    log.info(`Updated .env with keys: ${Object.keys(updates).join(', ')}`);

    return NextResponse.json({ success: true });
  } catch (error) {
    log.error('Failed to save settings:', error);
    return NextResponse.json({ error: 'Failed to save settings' }, { status: 500 });
  }
}
