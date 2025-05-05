// File: frontend/src/contexts/ConversationContext.tsx
import React, { createContext, useReducer, useContext } from 'react';

// Conversation Reducer
const conversationReducer = (state: ConversationState, action: ConversationAction): ConversationState => {
  switch (action.type) {
    case 'GET_CONVERSATIONS_SUCCESS':
      return {
        ...state,
        conversations: action.payload,
        loading: false,
        error: null
      };
    case 'GET_CONVERSATION_SUCCESS':
      return {
        ...state,
        currentConversation: action.payload,
        loading: false,
        error: null
      };
    case 'SEND_MESSAGE_SUCCESS':
      return {
        ...state,
        currentConversation: action.payload.conversation,
        loading: false,
        error: null
      };
    case 'CONVERSATION_ERROR':
      return {
        ...state,
        loading: false,
        error: action.payload
      };
    case 'LOADING':
      return {
        ...state,
        loading: true
      };
    case 'CLEAR_ERROR':
      return {
        ...state,
        error: null
      };
    default:
      return state;
  }
};

// Initial conversation state
const initialConversationState: ConversationState = {
  conversations: [],
  currentConversation: null,
  loading: false,
  error: null
};

// Create context
interface ConversationContextType {
  conversationState: ConversationState;
  getConversations: () => Promise<void>;
  getConversation: (id: string) => Promise<void>;
  sendMessage: (message: string, conversationId?: string) => Promise<void>;
  clearError: () => void;
}

const ConversationContext = createContext<ConversationContextType | undefined>(undefined);

// Conversation Provider component
export const ConversationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [conversationState, dispatch] = useReducer(conversationReducer, initialConversationState);

  // Get all conversations
  const getConversations = async () => {
    try {
      dispatch({ type: 'LOADING' });
      
      const token = localStorage.getItem('token');
      
      const response = await fetch('/api/chat/conversations', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch conversations');
      }
      
      dispatch({ type: 'GET_CONVERSATIONS_SUCCESS', payload: data.data });
    } catch (error: any) {
      dispatch({ type: 'CONVERSATION_ERROR', payload: error.message });
    }
  };

  // Get a single conversation
  const getConversation = async (id: string) => {
    try {
      dispatch({ type: 'LOADING' });
      
      const token = localStorage.getItem('token');
      
      const response = await fetch(`/api/chat/conversations/${id}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch conversation');
      }
      
      dispatch({ type: 'GET_CONVERSATION_SUCCESS', payload: data.data });
    } catch (error: any) {
      dispatch({ type: 'CONVERSATION_ERROR', payload: error.message });
    }
  };

  // Send a message
  const sendMessage = async (message: string, conversationId?: string) => {
    try {
      dispatch({ type: 'LOADING' });
      
      const token = localStorage.getItem('token');
      
      const response = await fetch('/api/chat/message', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ 
          message, 
          conversationId 
        })
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to send message');
      }
      
      // Update the current conversation with the latest message
      const updatedConversation = {
        ...conversationState.currentConversation,
        messages: [
          ...(conversationState.currentConversation?.messages || []),
          { role: 'user', content: message, timestamp: new Date().toISOString() },
          { role: 'assistant', content: data.data.message, timestamp: new Date().toISOString() }
        ]
      };
      
      dispatch({ 
        type: 'SEND_MESSAGE_SUCCESS', 
        payload: { 
          conversation: updatedConversation 
        } 
      });
    } catch (error: any) {
      dispatch({ type: 'CONVERSATION_ERROR', payload: error.message });
    }
  };

  // Clear error
  const clearError = () => {
    dispatch({ type: 'CLEAR_ERROR' });
  };

  return (
    <ConversationContext.Provider value={{ 
      conversationState, 
      getConversations, 
      getConversation, 
      sendMessage, 
      clearError 
    }}>
      {children}
    </ConversationContext.Provider>
  );
};

// Custom hook to use conversation context
export const useConversation = (): ConversationContextType => {
  const context = useContext(ConversationContext);
  if (context === undefined) {
    throw new Error('useConversation must be used within a ConversationProvider');
  }
  return context;
};
