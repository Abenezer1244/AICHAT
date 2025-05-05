// File: frontend/src/types.d.ts
interface User {
    id: string;
    name: string;
    email: string;
    role: string;
  }
  
  interface Message {
    role: "user" | "assistant" | "system";
    content: string;
    timestamp: string;
  }
  
  interface Conversation {
    _id: string;
    title: string;
    messages: Message[];
    createdAt: string;
    updatedAt: string;
  }
  
  interface AuthState {
    isAuthenticated: boolean;
    user: User | null;
    loading: boolean;
    error: string | null;
  }
  
  interface ConversationState {
    conversations: Conversation[];
    currentConversation: Conversation | null;
    loading: boolean;
    error: string | null;
  }
  
  interface AuthAction {
    type: string;
    payload?: any;
  }
  
  interface ConversationAction {
    type: string;
    payload?: any;
  }