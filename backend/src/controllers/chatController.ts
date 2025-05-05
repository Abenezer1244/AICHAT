// src/controllers/chatController.ts - Chat controller

import { Request, Response, NextFunction } from 'express';
import Conversation from '../models/Conversation';
// src/services/aiService.ts

export interface Message {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export class AIService {
  async generateResponse(messages: Message[], systemPrompt: string): Promise<string> {
    // TODO: Implement your actual AI service integration here
    // This is just a placeholder implementation
    return "This is a placeholder response. Implement your AI service integration.";
  }
}

const aiService = new AIService();
export default aiService;
import websocketService from '../services/websocketService';
import { ApiError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';
import { trackChatMessage, trackChatResponseTime } from '../middleware/metrics';

// Default system prompt for the chatbot
const DEFAULT_SYSTEM_PROMPT = 
  'You are a helpful, friendly customer service assistant. ' +
  'Provide concise, accurate information and assistance. ' +
  'If you do not know the answer to a question, say so rather than making something up.';

// @desc    Send a message to the chatbot
// @route   POST /api/chat/message
// @access  Private
export const sendMessage = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!req.user) {
      throw new ApiError('Not authorized', 401);
    }

    const { message, conversationId } = req.body;

    if (!message) {
      throw new ApiError('Message is required', 400);
    }

    let conversation;

    // Find existing conversation or create new one
    if (conversationId) {
      conversation = await Conversation.findOne({
        _id: conversationId,
        userId: req.user.id,
      });

      if (!conversation) {
        throw new ApiError('Conversation not found', 404);
      }
    } else {
      // Create a new conversation
      conversation = new Conversation({
        userId: req.user.id,
        title: message.substring(0, 30) + '...',
        messages: [],
      });
    }

    // Add user message to conversation
    conversation.messages.push({
      role: 'user',
      content: message,
      timestamp: new Date(),
    });
    
    // Track user message in metrics
    trackChatMessage('user');

    // Get all messages in the right format for the AI service
    const messageHistory: Message[] = conversation.messages.map((msg) => ({
      role: msg.role,
      content: msg.content,
    }));

    // Measure AI response time
    const startTime = process.hrtime();
    
    const aiResponse = await aiService.generateResponse(
      messageHistory,
      DEFAULT_SYSTEM_PROMPT
    );
    
    // Calculate and track response time
    const [seconds, nanoseconds] = process.hrtime(startTime);
    const duration = seconds + nanoseconds / 1e9;
    trackChatResponseTime(duration);
    trackChatMessage('assistant');

    // Add AI response to conversation
    conversation.messages.push({
      role: 'assistant',
      content: aiResponse,
      timestamp: new Date(),
    });

    // Save the conversation
    await conversation.save();

    logger.info(`Chat response generated for user ${req.user.id}`);
    
    // Notify via WebSocket
    websocketService.notifyNewMessage(req.user.id, {
      conversationId: conversation._id,
      message: aiResponse,
      timestamp: new Date()
    });

    res.status(200).json({
      success: true,
      data: {
        conversationId: conversation._id,
        message: aiResponse,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get user conversations
// @route   GET /api/chat/conversations
// @access  Private
export const getConversations = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!req.user) {
      throw new ApiError('Not authorized', 401);
    }

    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const skip = (page - 1) * limit;

    const conversations = await Conversation.find({ userId: req.user.id })
      .select('_id title createdAt')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Conversation.countDocuments({ userId: req.user.id });

    res.status(200).json({
      success: true,
      count: conversations.length,
      total,
      pagination: {
        page,
        pages: Math.ceil(total / limit),
      },
      data: conversations,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single conversation
// @route   GET /api/chat/conversations/:id
// @access  Private
export const getConversation = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!req.user) {
      throw new ApiError('Not authorized', 401);
    }

    const conversation = await Conversation.findOne({
      _id: req.params.id,
      userId: req.user.id,
    });

    if (!conversation) {
      throw new ApiError('Conversation not found', 404);
    }

    res.status(200).json({
      success: true,
      data: conversation,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete conversation
// @route   DELETE /api/chat/conversations/:id
// @access  Private
export const deleteConversation = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!req.user) {
      throw new ApiError('Not authorized', 401);
    }

    const conversation = await Conversation.findOne({
      _id: req.params.id,
      userId: req.user.id,
    });

    if (!conversation) {
      throw new ApiError('Conversation not found', 404);
    }

    await conversation.deleteOne();

    res.status(200).json({
      success: true,
      data: {},
    });
  } catch (error) {
    next(error);
  }
};