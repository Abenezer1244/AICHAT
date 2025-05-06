// src/services/aiService.ts

import axios from 'axios';
import { logger } from '../utils/logger';
import { cacheGet, cacheSet } from './redisService';

// Interface for message format
export interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

// OpenAI API response type
interface OpenAIResponse {
  choices: Array<{
    message: {
      content: string;
    };
  }>;
}

// Anthropic API response type
interface AnthropicResponse {
  content: Array<{
    text: string;
  }>;
}

class AIService {
  private apiKey: string;
  private provider: 'anthropic' | 'openai';
  private cacheEnabled: boolean;
  private cacheTTL: number; // seconds
  
  constructor() {
    this.apiKey = process.env.AI_API_KEY || '';
    this.provider = (process.env.AI_PROVIDER || 'anthropic') as 'anthropic' | 'openai';
    this.cacheEnabled = process.env.AI_CACHE_ENABLED === 'true';
    this.cacheTTL = parseInt(process.env.AI_CACHE_TTL || '3600'); // Default 1 hour
    
    if (!this.apiKey) {
      logger.error('AI API key not found in environment variables');
    }
    
    logger.info(`AI Service initialized with provider: ${this.provider}, cache: ${this.cacheEnabled ? 'enabled' : 'disabled'}`);
  }
  
  /**
   * Generate a response from the AI model
   * @param messages Array of message objects with role and content
   * @param systemPrompt Optional system prompt to guide AI behavior
   * @returns The AI response text
   */
  async generateResponse(
    messages: Message[],
    systemPrompt?: string
  ): Promise<string> {
    try {
      // Create a cache key from messages and system prompt
      if (this.cacheEnabled) {
        const cacheKey = this.createCacheKey(messages, systemPrompt);
        const cachedResponse = await cacheGet<string>(cacheKey);
        
        if (cachedResponse) {
          logger.debug('AI response retrieved from cache');
          return cachedResponse;
        }
      }
      
      // If not in cache, call the AI provider
      let response: string;
      
      if (this.provider === 'anthropic') {
        response = await this.callAnthropic(messages, systemPrompt);
      } else {
        response = await this.callOpenAI(messages, systemPrompt);
      }
      
      // Cache the response if enabled
      if (this.cacheEnabled) {
        const cacheKey = this.createCacheKey(messages, systemPrompt);
        await cacheSet(cacheKey, response, this.cacheTTL);
      }
      
      return response;
    } catch (error) {
      logger.error('Error generating AI response:', error);
      return "I'm sorry, I'm having trouble connecting to my knowledge service right now. Please try again later.";
    }
  }
  
  /**
   * Create a cache key from messages and system prompt
   */
  private createCacheKey(messages: Message[], systemPrompt?: string): string {
    // Create a deterministic string from messages and system prompt
    const messagesString = JSON.stringify(messages);
    const hash = require('crypto')
      .createHash('md5')
      .update(messagesString + (systemPrompt || ''))
      .digest('hex');
    
    return `ai:response:${hash}`;
  }
  
  /**
   * Call the Anthropic Claude API
   */
  private async callAnthropic(
    messages: Message[],
    systemPrompt?: string
  ): Promise<string> {
    try {
      const formattedMessages = [...messages];
      if (systemPrompt) {
        formattedMessages.unshift({
          role: 'system',
          content: systemPrompt
        });
      }

      const requestBody = {
        messages: formattedMessages,
        max_tokens: 1000,
        model: process.env.ANTHROPIC_MODEL || 'claude-2'
      };

      const response = await axios.post<AnthropicResponse>('https://api.anthropic.com/v1/messages', requestBody, {
        headers: {
          'x-api-key': this.apiKey,
          'Content-Type': 'application/json',
          'anthropic-version': '2023-06-01',
        },
        timeout: 30000, // 30 seconds
      });

      return response.data.content[0].text;
    } catch (error) {
      logger.error('Error calling Anthropic API:', error);
      throw error;
    }
  }
  
  /**
   * Call the OpenAI API
   */
  private async callOpenAI(
    messages: Message[],
    systemPrompt?: string
  ): Promise<string> {
    try {
      // Add system prompt if provided
      const formattedMessages = [...messages];
      if (systemPrompt) {
        formattedMessages.unshift({
          role: 'system',
          content: systemPrompt
        });
      }

      const requestBody = {
        model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
        messages: formattedMessages,
        max_tokens: 1000,
      };

      const response = await axios.post<OpenAIResponse>('https://api.openai.com/v1/chat/completions', requestBody, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        timeout: 30000, // 30 seconds
      });

      return response.data.choices[0].message.content;
    } catch (error) {
      logger.error('Error calling OpenAI API:', error);
      throw error;
    }
  }
}

// Export a singleton instance
const aiService = new AIService();
export default aiService;