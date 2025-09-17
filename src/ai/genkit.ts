import {genkit} from 'genkit';
import {googleAI} from '@genkit-ai/googleai';
import * as fs from 'fs';
import * as path from 'path';
import { AiConfig, DEFAULT_AI_CONFIG } from '@/lib/ai-config-schema';

let loadedConfig: AiConfig;

try {
  const configPath = path.join(process.cwd(), 'src', 'lib', 'ai-config.json');
  const configJson = fs.readFileSync(configPath, 'utf-8');
  loadedConfig = JSON.parse(configJson) as AiConfig;
} catch (error) {
  console.warn("Could not load 'ai-config.json'. Using default AI configuration.", error);
  loadedConfig = DEFAULT_AI_CONFIG;
}

const { model, ...configOptions } = loadedConfig;

export const ai = genkit({
  plugins: [googleAI()],
  model: model || DEFAULT_AI_CONFIG.model,
  config: {
    temperature: configOptions.temperature ?? DEFAULT_AI_CONFIG.temperature,
    topP: configOptions.topP ?? DEFAULT_AI_CONFIG.topP,
    topK: configOptions.topK ?? DEFAULT_AI_CONFIG.topK,
    maxOutputTokens: configOptions.maxOutputTokens ?? DEFAULT_AI_CONFIG.maxOutputTokens,
  },
});
