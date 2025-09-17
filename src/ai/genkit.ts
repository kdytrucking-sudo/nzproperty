import {genkit} from 'genkit';
import {googleAI} from '@genkit-ai/googleai';
import {readJSON} from '@/lib/storage';
import {AiConfig, DEFAULT_AI_CONFIG} from '@/lib/ai-config-schema';

async function loadAiConfig(): Promise<AiConfig> {
  try {
    // Read the config from Firebase Storage.
    const config = await readJSON('json/ai-config.json');
    // Ensure all fields from the schema are present, even if the file is old.
    const validatedConfig = {...DEFAULT_AI_CONFIG, ...config};
    return AiConfig.parse(validatedConfig);
  } catch (error) {
    console.warn(
      "Could not load 'ai-config.json' from Storage. Using default AI configuration.",
      error
    );
    return DEFAULT_AI_CONFIG;
  }
}

// Load the configuration asynchronously.
const loadedConfigPromise = loadAiConfig();

export const ai = genkit({
  plugins: [
    googleAI({
      // The generationConfig must be awaited as it's loaded asynchronously.
      generationConfig: loadedConfigPromise.then(config => ({
        temperature: config.temperature,
        topP: config.topP,
        topK: config.topK,
        maxOutputTokens: config.maxOutputTokens,
      })),
    }),
  ],
  // Define a custom getter for the model to ensure it's resolved after the async config load.
  // This avoids race conditions and ensures the model name from the config is always used.
  get model() {
    return loadedConfigPromise.then(config => config.model);
  },
});
