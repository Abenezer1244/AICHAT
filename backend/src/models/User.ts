// src/models/User.ts - User model schema

import mongoose, { Document, Schema } from 'mongoose';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';


// Interface for User document
export interface IUser extends Document {
  name: string;
  email: string;
  password: string;
  role: string;
  lastActive: Date;
  matchPassword(enteredPassword: string): Promise<boolean>;
  generateAuthToken(): string;
}

// Create User schema
const UserSchema: Schema = new Schema(
  {
    name: {
      type: String,
      required: [true, 'Please add a name'],
      trim: true,
    },
    email: {
      type: String,
      required: [true, 'Please add an email'],
      unique: true,
      match: [
        /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/,
        'Please add a valid email',
      ],
      lowercase: true,
    },
    password: {
      type: String,
      required: [true, 'Please add a password'],
      minlength: [6, 'Password must be at least 6 characters'],
      select: false, // Don't return password in query results
    },
    role: {
      type: String,
      enum: ['user', 'admin'],
      default: 'user',
    },
    lastActive: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

// Encrypt password using bcrypt before saving
UserSchema.pre<IUser>('save', async function (next) {
  if (!this.isModified('password')) {
    next();
  }

  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

// Method to check if entered password matches stored password
UserSchema.methods.matchPassword = async function (
  enteredPassword: string
): Promise<boolean> {
  return await bcrypt.compare(enteredPassword, this.password);
};

// src/models/User.ts - Modify JWT generation

// Generate JWT token with better options
UserSchema.methods.generateAuthToken = function (): string {
  const tokenData = { 
    id: this._id, 
    role: this.role,
    // Add version to invalidate old tokens when password changes
    tokenVersion: this.passwordVersion || 0
  };

  return jwt.sign(
    tokenData,
    process.env.JWT_SECRET as string,
    {
      expiresIn: process.env.JWT_EXPIRY || '7d',
      issuer: process.env.APP_NAME || 'production-chatbot',
      audience: process.env.APP_URL || 'https://your-chatbot-domain.com'
    }
  );
};

// src/models/User.ts

// Add user preferences
UserSchema.add({
  preferences: {
    theme: {
      type: String,
      enum: ['light', 'dark', 'system'],
      default: 'system'
    },
    notifications: {
      enabled: {
        type: Boolean,
        default: true
      },
      email: {
        type: Boolean,
        default: false
      }
    },
    aiModel: {
      type: String,
      enum: ['gpt-4', 'gpt-3.5-turbo', 'claude-2'],
      default: 'gpt-4'
    }
  },
  usage: {
    messageCount: {
      type: Number,
      default: 0
    },
    lastActive: {
      type: Date,
      default: Date.now
    }
  }
});

// Method to update user stats
UserSchema.methods.updateStats = async function() {
  this.usage.messageCount += 1;
  this.usage.lastActive = new Date();
  await this.save();
};

// Static method to get user by email
UserSchema.statics.findByEmail = async function(email: string) {
  return this.findOne({ email: email.toLowerCase() });
};

// Increment password version when password changes
UserSchema.pre<IUser>('save', async function (next) {
  if (this.isModified('password')) {
    this.passwordVersion = (this.passwordVersion || 0) + 1;
  }
  next();
});

export default mongoose.model<IUser>('User', UserSchema);

