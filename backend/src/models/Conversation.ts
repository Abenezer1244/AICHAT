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

// src/models/Conversation.ts

// Add more functionality to the Conversation model
ConversationSchema.methods.addMessage = async function(role: string, content: string) {
  this.messages.push({
    role,
    content,
    timestamp: new Date()
  });
  
  // Update title if this is the first user message
  if (role === 'user' && this.messages.length <= 2) {
    // Generate a title from the first user message
    this.title = content.substring(0, 50) + (content.length > 50 ? '...' : '');
  }
  
  await this.save();
  return this;
};

// Static method to get conversations with pagination
ConversationSchema.statics.getUserConversations = async function(
  userId: mongoose.Schema.Types.ObjectId,
  page = 1,
  limit = 10
) {
  const skip = (page - 1) * limit;
  
  const conversations = await this.find({ userId })
    .select('_id title createdAt updatedAt')
    .sort({ updatedAt: -1 })
    .skip(skip)
    .limit(limit);
    
  const total = await this.countDocuments({ userId });
  
  return {
    conversations,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit)
    }
  };
};

// Virtual for message count
ConversationSchema.virtual('messageCount').get(function() {
  return this.messages.length;
});

// Virtual for last message
ConversationSchema.virtual('lastMessage').get(function() {
  if (this.messages.length === 0) return null;
  return this.messages[this.messages.length - 1];
});

export default mongoose.model<IConversation>('Conversation', ConversationSchema);

