// src/components/ChatInterface.tsx
import React, { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { chatAPI } from '../services/websocketService/api';
import ChatMessage from './ChatMessage';

interface ApiResponse {
  data: {
    data?: {
      conversationId?: string;
      message?: string;
    };
    messages?: Message[];
  };
}

interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp?: Date;
}

const ChatInterface: React.FC = (): JSX.Element => {
  const { id } = useParams<{ id?: string }>();
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [conversationId, setConversationId] = useState<string | undefined>(id);
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (conversationId) {
      fetchConversation(conversationId);
    }
  }, [conversationId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const fetchConversation = async (id: string) => {
    try {
      setLoading(true);
      const response = await chatAPI.getConversation(id) as ApiResponse;
      if (response.data && response.data.messages) {
        setMessages(response.data.messages || []);
      }
    } catch (error) {
      console.error('Error fetching conversation:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;

    const userMessage: Message = {
      role: 'user',
      content: input,
      timestamp: new Date()
    };

    try {
      const response = await chatAPI.sendMessage(input, conversationId) as ApiResponse;
      
      if (response.data && response.data.data) {
        if (!conversationId) {
          setConversationId(response.data.data.conversationId);
        }
        
        const assistantMessage: Message = {
          role: 'assistant',
          content: response.data.data.message || '',
          timestamp: new Date()
        };
        
        setMessages(prev => [...prev, assistantMessage]);
      }
    } catch (error) {
      console.error('Error sending message:', error);
    } finally {
      setLoading(false);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="chat-container">
      <div className="messages-container">
        {messages.map((message, index) => (
          <ChatMessage key={index} message={message} />
        ))}
        {loading && <div className="loading-indicator">AI is thinking...</div>}
        <div ref={messagesEndRef} />
      </div>
      
      <form onSubmit={handleSubmit} className="input-container">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type your message..."
          className="message-input"
          disabled={loading}
        />
        <button 
          type="submit" 
          className="send-button"
          disabled={loading || !input.trim()}
        >
          Send
        </button>
      </form>
    </div>
  );
};

export default ChatInterface;