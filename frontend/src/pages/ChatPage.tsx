// src/pages/ChatPage.tsx - Chat page implementation

import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import websocketService from '../services/websocketService';

// Define types
interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
}

interface Conversation {
  _id: string;
  title: string;
  messages: Message[];
}

const ChatPage: React.FC = () => {
  const { conversationId } = useParams<{ conversationId: string }>();
  const { token, user } = useAuth();
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const [wsConnected, setWsConnected] = useState(false);

  // Scroll to bottom of messages
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Load conversation data
  useEffect(() => {
    const fetchConversation = async () => {
      if (!conversationId) return;

      try {
        setLoading(true);
        const response = await axios.get(`/api/chat/conversations/${conversationId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setConversation(response.data.data);
        setError(null);
      } catch (err) {
        console.error('Error fetching conversation:', err);
        setError('Failed to load conversation. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    fetchConversation();
  }, [conversationId, token]);

  // Connect to WebSocket
  useEffect(() => {
    if (!token || !user) return;

    // Create WebSocket connection
    const ws = websocketService.connectWebSocket(token);
    
    if (ws) {
      // Set up event handlers
      const handleOpen = () => {
        console.log('WebSocket connected');
        setWsConnected(true);
      };
      
      const handleMessage = (data: any) => {
        try {
          // Handle new message event
          if (data.type === 'new_message' && data.message.conversationId === conversationId) {
            // Update conversation with new message
            setConversation(prev => {
              if (!prev) return prev;
              
              return {
                ...prev,
                messages: [
                  ...prev.messages,
                  {
                    role: 'assistant',
                    content: data.message.message,
                    timestamp: new Date(data.message.timestamp)
                  }
                ]
              };
            });
          }
        } catch (err) {
          console.error('Error processing WebSocket message:', err);
        }
      };
      
      const handleClose = () => {
        console.log('WebSocket disconnected');
        setWsConnected(false);
      };
      
      const handleError = (error: any) => {
        console.error('WebSocket error:', error);
        setWsConnected(false);
      };
      
      // Add event listeners
      websocketService.addEventListener('open', handleOpen);
      websocketService.addEventListener('message', handleMessage);
      websocketService.addEventListener('close', handleClose);
      websocketService.addEventListener('error', handleError);
      
      // Initial connection status
      setWsConnected(websocketService.isConnected());
      
      // Cleanup function
      return () => {
        websocketService.removeEventListener('open', handleOpen);
        websocketService.removeEventListener('message', handleMessage);
        websocketService.removeEventListener('close', handleClose);
        websocketService.removeEventListener('error', handleError);
        websocketService.disconnectWebSocket();
      };
    }
  }, [token, user, conversationId]);

  // Scroll to bottom when messages update
  useEffect(() => {
    scrollToBottom();
  }, [conversation?.messages]);

  // Send message function
  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!message.trim()) return;
    
    try {
      setLoading(true);
      
      // Optimistically update UI
      const newMessage: Message = {
        role: 'user',
        content: message,
        timestamp: new Date()
      };
      
      setConversation(prev => {
        if (!prev) {
          return {
            _id: conversationId || 'new',
            title: message.substring(0, 30) + '...',
            messages: [newMessage]
          };
        }
        
        return {
          ...prev,
          messages: [...prev.messages, newMessage]
        };
      });
      
      // Clear input
      setMessage('');
      
      // Send to API
      const response = await axios.post('/api/chat/message', 
        { 
          message: message.trim(), 
          conversationId 
        },
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      
      // If new conversation, redirect to the newly created conversation
      if (!conversationId && response.data.data.conversationId) {
        navigate(`/chat/${response.data.data.conversationId}`);
      }
      
      setError(null);
    } catch (err) {
      console.error('Error sending message:', err);
      setError('Failed to send message. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Render loading state
  if (loading && !conversation) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  // Render error state
  if (error && !conversation) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen">
        <div className="text-red-500 mb-4">{error}</div>
        <button 
          onClick={() => navigate('/dashboard')}
          className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
        >
          Return to Dashboard
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen">
      {/* Header */}
      <header className="bg-gray-800 text-white p-4 flex justify-between items-center">
        <h1 className="text-xl font-bold truncate">
          {conversation?.title || 'New Conversation'}
        </h1>
        <div className="flex items-center">
          <span className={`w-3 h-3 rounded-full mr-2 ${wsConnected ? 'bg-green-500' : 'bg-red-500'}`}></span>
          <button 
            onClick={() => navigate('/dashboard')}
            className="bg-blue-500 text-white px-3 py-1 rounded hover:bg-blue-600 text-sm"
          >
            Dashboard
          </button>
        </div>
      </header>
      
      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 bg-gray-100">
        {conversation?.messages.map((msg, index) => (
          <div
            key={index}
            className={`mb-4 ${
              msg.role === 'user' ? 'text-right' : 'text-left'
            }`}
          >
            <div
              className={`inline-block p-3 rounded-lg ${
                msg.role === 'user'
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-300 text-gray-800'
              }`}
            >
              {msg.content}
            </div>
            <div className="text-xs text-gray-500 mt-1">
              {new Date(msg.timestamp).toLocaleTimeString()}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>
      
      {/* Message input */}
      <form onSubmit={sendMessage} className="p-4 bg-white border-t">
        {error && <div className="text-red-500 mb-2">{error}</div>}
        <div className="flex">
          <input
            type="text"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Type a message..."
            className="flex-1 border rounded-l-lg p-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={loading}
          />
          <button
            type="submit"
            className="bg-blue-500 text-white px-4 py-2 rounded-r-lg hover:bg-blue-600 disabled:bg-blue-300"
            disabled={loading || !message.trim()}
          >
            {loading ? (
              <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
            ) : (
              'Send'
            )}
          </button>
        </div>
      </form>
    </div>
  );
};