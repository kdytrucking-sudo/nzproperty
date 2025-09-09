// GENKIT_CONFIG_START
import {genkit} from 'genkit';
import {googleAI} from '@genkit-ai/googleai';

export const ai = genkit({
  plugins: [googleAI()],
  model: 'googleai/gemini-2.5-flash',
  config: {
    temperature: 0.2,
    topP: 1,
    topK: 1,
    maxOutputTokens: 8192,
  },
});
// GENKIT_CONFIG_END
