'use server';
import {genkit} from 'genkit';
import {googleAI} from '@genkit-ai/googleai';
import {readJSON} from '@/lib/storage';
import {
  AiConfigSchema,
  DEFAULT_AI_CONFIG,
  type AiConfig,
} from '@/lib/ai-config-schema';

// This function asynchronously loads the AI configuration from storage.
async function loadAiConfig(): Promise<AiConfig> {
  try {
    const config = await readJSON('json/ai-config.json');
    const validatedConfig = {...DEFAULT_AI_CONFIG, ...config};
    return AiConfigSchema.parse(validatedConfig);
  } catch (error) {
    console.warn(
      "Could not load 'ai-config.json' from Storage. Using default AI configuration.",
      error
    );
    return DEFAULT_AI_CONFIG;
  }
}

let aiInstance: any;

// Asynchronously get the initialized AI instance.
export async function getAi() {
  if (aiInstance) {
    return aiInstance;
  }

  const config = await loadAiConfig();

  aiInstance = genkit({
    plugins: [
      googleAI({
        generationConfig: {
          temperature: config.temperature,
          topP: config.topP,
          topK: config.topK,
          maxOutputTokens: config.maxOutputTokens,
        },
      }),
    ],
    model: config.model,
  });

  return aiInstance;
}
