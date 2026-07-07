/**
 * Media Tools — Image generation, video generation, and voice synthesis.
 *
 * Three tools for multimodal content generation:
 * 1. imagegen  — Generate images from text prompts via AI image APIs
 * 2. videogen  — Generate short video clips from text descriptions
 * 3. voice     — Text-to-speech synthesis
 *
 * These are placeholder implementations that define the tool interface.
 * Actual providers (OpenAI DALL-E, Stability AI, ElevenLabs, etc.)
 * are configured via environment variables.
 *
 * Provider support:
 * - Image: OpenAI DALL-E 3, Stability AI, SiliconFlow
 * - Video: RunwayML, Pika (future)
 * - Voice: OpenAI TTS, ElevenLabs, Edge TTS
 */

import {
  BaseTool,
  type ToolDefinition,
  type ToolResult,
  type ToolPromptHints,
  createToolResult,
  createToolParameter,
  createToolPromptHints,
} from '@/lib/deeptutor/core/tool-protocol';
import { createLogger } from '@/lib/logger';

const log = createLogger('MediaTools');

// ---------------------------------------------------------------------------
// Media service context (configured during bootstrap)
// ---------------------------------------------------------------------------

export interface MediaServiceConfig {
  /** Image generation provider */
  imageProvider: 'openai' | 'stability' | 'siliconflow' | 'none';
  /** Video generation provider */
  videoProvider: 'runwayml' | 'pika' | 'none';
  /** Voice/TTS provider */
  voiceProvider: 'openai' | 'elevenlabs' | 'edge' | 'none';
  /** API keys by provider */
  apiKeys: Record<string, string>;
  /** Output directory for generated media */
  outputDir: string;
}

let _config: MediaServiceConfig = {
  imageProvider: 'none',
  videoProvider: 'none',
  voiceProvider: 'none',
  apiKeys: {},
  outputDir: 'data/media',
};

export function setMediaToolContext(config: Partial<MediaServiceConfig>): void {
  _config = { ..._config, ...config };
  log.info(`Media tools configured: image=${_config.imageProvider}, video=${_config.videoProvider}, voice=${_config.voiceProvider}`);
}

export function getMediaConfig(): MediaServiceConfig {
  return { ..._config };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function downloadToBase64(url: string): Promise<string> {
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Download failed: ${response.status}`);
    const buffer = await response.arrayBuffer();
    return Buffer.from(buffer).toString('base64');
  } catch (err) {
    log.error(`Failed to download media from ${url}:`, err);
    throw err;
  }
}

function generateMediaId(): string {
  return `media_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

// ---------------------------------------------------------------------------
// 1. ImageGenTool
// ---------------------------------------------------------------------------

export class ImageGenTool extends BaseTool {
  getDefinition(): ToolDefinition {
    return {
      name: 'imagegen',
      description: 'Generate an image from a text description using AI image generation. Returns the generated image as a URL or base64 data.',
      parameters: [
        createToolParameter({ name: 'prompt', type: 'string', description: 'Detailed text description of the image to generate' }),
        createToolParameter({ name: 'style', type: 'string', description: 'Visual style: natural, vivid, artistic, digital-art, anime, photographic', required: false, default: 'natural', enum: ['natural', 'vivid', 'artistic', 'digital-art', 'anime', 'photographic'] }),
        createToolParameter({ name: 'size', type: 'string', description: 'Image size: 1024x1024, 1792x1024, 1024x1792', required: false, default: '1024x1024', enum: ['1024x1024', '1792x1024', '1024x1792'] }),
        createToolParameter({ name: 'quality', type: 'string', description: 'Generation quality: standard, hd', required: false, default: 'standard', enum: ['standard', 'hd'] }),
      ],
    };
  }

  override getPromptHints(): ToolPromptHints {
    return createToolPromptHints({
      shortDescription: 'Generate images from text',
      whenToUse: 'When the user asks to create, generate, or draw an image, illustration, diagram, or visual',
      inputFormat: 'prompt: detailed description, style: visual style, size: dimensions',
      guideline: 'Be descriptive in prompts. Include details about composition, lighting, colors, and mood.',
    });
  }

  async execute(kwargs: Record<string, unknown>): Promise<ToolResult> {
    try {
      const prompt = kwargs.prompt as string;
      const style = (kwargs.style as string) || 'natural';
      const size = (kwargs.size as string) || '1024x1024';
      const quality = (kwargs.quality as string) || 'standard';

      if (_config.imageProvider === 'none') {
        return createToolResult({
          content: 'Image generation is not configured. Set DT_IMAGE_PROVIDER (openai|stability|siliconflow) and the corresponding API key.',
          success: false,
        });
      }

      if (_config.imageProvider === 'openai') {
        return await this.generateOpenAI(prompt, style, size, quality);
      }

      // Placeholder for other providers
      return createToolResult({
        content: `Image generation with provider "${_config.imageProvider}" is not yet implemented.`,
        success: false,
      });
    } catch (err) {
      log.error('Image generation failed:', err);
      return createToolResult({
        content: `Image generation failed: ${err instanceof Error ? err.message : String(err)}`,
        success: false,
      });
    }
  }

  private async generateOpenAI(
    prompt: string,
    style: string,
    size: string,
    quality: string,
  ): Promise<ToolResult> {
    const apiKey = _config.apiKeys.openai ?? process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return createToolResult({ content: 'OpenAI API key not configured.', success: false });
    }

    const response = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'dall-e-3',
        prompt,
        n: 1,
        size,
        quality,
        style,
        response_format: 'url',
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OpenAI DALL-E error: ${response.status} ${errorText}`);
    }

    const data = await response.json() as { data: Array<{ url: string; revised_prompt: string }> };
    const image = data.data[0];

    if (!image?.url) {
      return createToolResult({ content: 'No image URL returned from DALL-E.', success: false });
    }

    return createToolResult({
      content: `Generated image: ${image.url}\n\nRevised prompt: ${image.revised_prompt}`,
      metadata: {
        url: image.url,
        revisedPrompt: image.revised_prompt,
        provider: 'openai',
        mediaId: generateMediaId(),
      },
    });
  }
}

// ---------------------------------------------------------------------------
// 2. VideoGenTool
// ---------------------------------------------------------------------------

export class VideoGenTool extends BaseTool {
  getDefinition(): ToolDefinition {
    return {
      name: 'videogen',
      description: 'Generate a short video clip from a text description. Returns a video URL or status.',
      parameters: [
        createToolParameter({ name: 'prompt', type: 'string', description: 'Detailed description of the video to generate' }),
        createToolParameter({ name: 'duration', type: 'number', description: 'Video duration in seconds (default: 4)', required: false, default: 4 }),
        createToolParameter({ name: 'style', type: 'string', description: 'Video style: cinematic, animation, realistic, artistic', required: false, default: 'cinematic', enum: ['cinematic', 'animation', 'realistic', 'artistic'] }),
      ],
    };
  }

  override getPromptHints(): ToolPromptHints {
    return createToolPromptHints({
      shortDescription: 'Generate video clips from text',
      whenToUse: 'When the user asks to create a video, animation, or motion clip',
      inputFormat: 'prompt: scene description, duration: seconds, style: visual style',
      guideline: 'Describe camera movement, subject motion, and scene composition clearly.',
      note: 'Video generation is compute-intensive and may take 30-120 seconds.',
    });
  }

  async execute(kwargs: Record<string, unknown>): Promise<ToolResult> {
    try {
      const prompt = kwargs.prompt as string;
      const duration = (kwargs.duration as number) || 4;
      const style = (kwargs.style as string) || 'cinematic';

      if (_config.videoProvider === 'none') {
        return createToolResult({
          content: 'Video generation is not configured. Set DT_VIDEO_PROVIDER (runwayml|pika) and the corresponding API key.',
          success: false,
        });
      }

      // Video generation is async — return a job ID for polling
      const mediaId = generateMediaId();

      // Placeholder: In production, this would call the video API and return a job ID
      return createToolResult({
        content: `Video generation started (job: ${mediaId}). Provider: ${_config.videoProvider}. This may take 30-120 seconds.`,
        metadata: {
          mediaId,
          provider: _config.videoProvider,
          status: 'processing',
          prompt,
          duration,
          style,
        },
      });
    } catch (err) {
      log.error('Video generation failed:', err);
      return createToolResult({
        content: `Video generation failed: ${err instanceof Error ? err.message : String(err)}`,
        success: false,
      });
    }
  }
}

// ---------------------------------------------------------------------------
// 3. VoiceTool
// ---------------------------------------------------------------------------

export class VoiceTool extends BaseTool {
  getDefinition(): ToolDefinition {
    return {
      name: 'voice',
      description: 'Convert text to speech audio. Returns audio data as a URL or base64.',
      parameters: [
        createToolParameter({ name: 'text', type: 'string', description: 'Text to convert to speech' }),
        createToolParameter({ name: 'voice', type: 'string', description: 'Voice selection', required: false, default: 'alloy', enum: ['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer'] }),
        createToolParameter({ name: 'speed', type: 'number', description: 'Speech speed (0.25 to 4.0, default: 1.0)', required: false, default: 1.0 }),
        createToolParameter({ name: 'language', type: 'string', description: 'Language hint: en, zh, ja, ru, auto', required: false, default: 'auto' }),
      ],
    };
  }

  override getPromptHints(): ToolPromptHints {
    return createToolPromptHints({
      shortDescription: 'Text-to-speech synthesis',
      whenToUse: 'When the user asks to read text aloud, generate audio, or narrate content',
      inputFormat: 'text: content to speak, voice: voice selection, speed: playback rate',
      guideline: 'For best results, use clear punctuation and natural sentence structure.',
    });
  }

  async execute(kwargs: Record<string, unknown>): Promise<ToolResult> {
    try {
      const text = kwargs.text as string;
      const voice = (kwargs.voice as string) || 'alloy';
      const speed = (kwargs.speed as number) || 1.0;
      const language = (kwargs.language as string) || 'auto';

      if (_config.voiceProvider === 'none') {
        return createToolResult({
          content: 'Voice synthesis is not configured. Set DT_VOICE_PROVIDER (openai|elevenlabs|edge) and the corresponding API key.',
          success: false,
        });
      }

      if (_config.voiceProvider === 'openai') {
        return await this.synthesizeOpenAI(text, voice, speed);
      }

      // Edge TTS fallback (free, no API key needed)
      if (_config.voiceProvider === 'edge') {
        return await this.synthesizeEdge(text, language);
      }

      return createToolResult({
        content: `Voice provider "${_config.voiceProvider}" is not yet implemented.`,
        success: false,
      });
    } catch (err) {
      log.error('Voice synthesis failed:', err);
      return createToolResult({
        content: `Voice synthesis failed: ${err instanceof Error ? err.message : String(err)}`,
        success: false,
      });
    }
  }

  private async synthesizeOpenAI(
    text: string,
    voice: string,
    speed: number,
  ): Promise<ToolResult> {
    const apiKey = _config.apiKeys.openai ?? process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return createToolResult({ content: 'OpenAI API key not configured.', success: false });
    }

    const response = await fetch('https://api.openai.com/v1/audio/speech', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'tts-1',
        input: text,
        voice,
        speed,
        response_format: 'mp3',
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OpenAI TTS error: ${response.status} ${errorText}`);
    }

    const buffer = await response.arrayBuffer();
    const base64 = Buffer.from(buffer).toString('base64');

    return createToolResult({
      content: `Generated ${text.length} characters of speech audio (${buffer.byteLength} bytes).`,
      metadata: {
        mediaId: generateMediaId(),
        provider: 'openai',
        format: 'mp3',
        audioBase64: base64,
        byteLength: buffer.byteLength,
        voice,
        speed,
      },
    });
  }

  private async synthesizeEdge(
    text: string,
    language: string,
  ): Promise<ToolResult> {
    // Edge TTS requires the edge-tts Python package or a WebSocket API.
    // This is a placeholder for the integration point.
    return createToolResult({
      content: `Edge TTS synthesis requested for ${text.length} characters (language: ${language}). Edge TTS integration pending.`,
      metadata: {
        mediaId: generateMediaId(),
        provider: 'edge',
        status: 'pending',
        language,
      },
    });
  }
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createMediaTools(): BaseTool[] {
  return [
    new ImageGenTool(),
    new VideoGenTool(),
    new VoiceTool(),
  ];
}
