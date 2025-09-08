'use server';

import {genkit, type ModelArgument} from 'genkit';
import {googleAI} from '@genkit-ai/googleai';
import {getAiConfig} from './flows/get-ai-config';
import type {AIConfig} from '@/lib/ai-config-schema';

let aiInstance: {
    defineFlow: (options: any, fn: any) => any;
    definePrompt: (options: any) => any;
    generate: (options: any) => any;
} | null = null;

let aiConfig: AIConfig | null = null;

async function getInitializedAi() {
    if (!aiInstance) {
        aiConfig = await getAiConfig();
        const instance: ModelArgument<any> = genkit({
            plugins: [googleAI()],
            model: aiConfig.model,
        });
        aiInstance = {
            defineFlow: instance.defineFlow.bind(instance),
            definePrompt: instance.definePrompt.bind(instance),
            generate: instance.generate.bind(instance),
        };
    }
    return aiInstance;
}

export async function getModelConfig() {
    if (!aiConfig) {
        aiConfig = await getAiConfig();
    }
    return {
        temperature: aiConfig.temperature,
        topP: aiConfig.topP,
        topK: aiConfig.topK,
        maxOutputTokens: aiConfig.maxOutputTokens,
    };
}

export async function defineFlow(options: any, fn: any) {
    const ai = await getInitializedAi();
    return ai.defineFlow(options, fn);
}

export async function definePrompt(options: any) {
    const ai = await getInitializedAi();
    return ai.definePrompt(options);
}

export async function generate(options: any) {
    const ai = await getInitializedAi();
    return ai.generate(options);
}
