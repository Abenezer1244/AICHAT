// src/routes/chatRoutes.ts - Chat routes

import express from 'express';
import {
  sendMessage,
  getConversations,
  getConversation,
  deleteConversation,
} from '../controllers/chatController';
import { protect } from '../middleware/auth';

const router = express.Router();

// Protect all routes
router.use(protect);

router.post('/message', sendMessage);
router.get('/conversations', getConversations);
router.get('/conversations/:id', getConversation);
router.delete('/conversations/:id', deleteConversation);

export default router;