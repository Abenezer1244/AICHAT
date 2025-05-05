// src/models/Conversation.ts - Conversation model schema

import mongoose, { Document, Schema } from 'mongoose';

// Interface for Message document
interface IMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
}

// Interface for Conversation document
export interface IConversation extends Document {
  userId: mongoose.Schema.Types.ObjectId;
  title: string;
  messages: IMessage[];
  createdAt: Date;
  updatedAt: Date;
}

// Create Message schema
const MessageSchema: Schema = new Schema({
  role: {
    type: String,
    enum: ['user', 'assistant', 'system'],
    required: true,
  },
  content: {
    type: String,
    required: true,
  },
  timestamp: {
    type: Date,
    default: Date.now,
  },
});

// Create Conversation schema
const ConversationSchema: Schema = new Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    title: {
      type: String,
      default: 'New Conversation',
    },
    messages: [MessageSchema],
  },
  {
    timestamps: true,
  }
);

// Add index for faster queries
ConversationSchema.index({ userId: 1, createdAt: -1 });

export default mongoose.model<IConversation>('Conversation', ConversationSchema);

