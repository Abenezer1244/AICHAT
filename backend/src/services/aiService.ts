// src/services/aiService.ts - AI service for chatbot

import axios from 'axios';
import { logger } from '../utils/logger';

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
  
  constructor() {
    this.apiKey = process.env.AI_API_KEY || '';
    this.provider = (process.env.AI_PROVIDER || 'anthropic') as 'anthropic' | 'openai';
    
    if (!this.apiKey) {
      logger.error('AI API key not found in environment variables');
    }
    
    logger.info(`AI Service initialized with provider: ${this.provider}`);
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
      if (this.provider === 'anthropic') {
        return await this.callAnthropic(messages, systemPrompt);
      } else {
        return await this.callOpenAI(messages, systemPrompt);
      }
    } catch (error) {
      logger.error('Error generating AI response:', error);
      return "I'm sorry, I'm having trouble connecting to my knowledge service right now. Please try again later.";
    }
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
export default new AIService();