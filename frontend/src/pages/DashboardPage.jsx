// src/pages/DashboardPage.tsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';

interface Conversation {
  _id: string;
  title: string;
  createdAt: string;
}

const DashboardPage: React.FC = () => {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { token, user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const fetchConversations = async () => {
      try {
        setLoading(true);
        const response = await axios.get('/api/chat/conversations', {
          headers: { Authorization: `Bearer ${token}` },
        });
        setConversations(response.data.data);
        setError(null);
      } catch (err) {
        console.error('Error fetching conversations:', err);
        setError('Failed to load conversations. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    fetchConversations();
  }, [token]);

  const handleNewChat = () => {
    navigate('/chat');
  };

  const handleOpenChat = (id: string) => {
    navigate(`/chat/${id}`);
  };

  const handleDeleteChat = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    
    if (!window.confirm('Are you sure you want to delete this conversation?')) {
      return;
    }
    
    try {
      await axios.delete(`/api/chat/conversations/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      
      setConversations(prevConversations => 
        prevConversations.filter(conv => conv._id !== id)
      );
    } catch (err) {
      console.error('Error deleting conversation:', err);
      setError('Failed to delete conversation. Please try again.');
    }
  };

  if (loading && conversations.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <header className="bg-gray-800 text-white p-4">
        <div className="container mx-auto flex justify-between items-center">
          <h1 className="text-2xl font-bold">Chatbot Dashboard</h1>
          <div>
            <span className="mr-4">Welcome, {user?.name || 'User'}!</span>
          </div>
        </div>
      </header>

      <main className="container mx-auto p-4">
        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}

        <div className="mb-6">
          <button
            onClick={handleNewChat}
            className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
          >
            New Conversation
          </button>
        </div>

        <div className="bg-white rounded-lg shadow">
          <h2 className="text-xl font-semibold p-4 border-b">Your Conversations</h2>
          
          {conversations.length === 0 ? (
            <div className="p-6 text-center text-gray-500">
              No conversations yet. Start a new one!
            </div>
          ) : (
            <ul>
              {conversations.map((conv) => (
                <li
                  key={conv._id}
                  onClick={() => handleOpenChat(conv._id)}
                  className="border-b last:border-b-0 p-4 flex justify-between items-center hover:bg-gray-50 cursor-pointer"
                >
                  <div>
                    <h3 className="font-medium">{conv.title}</h3>
                    <p className="text-sm text-gray-500">
                      {new Date(conv.createdAt).toLocaleString()}
                    </p>
                  </div>
                  <button
                    onClick={(e) => handleDeleteChat(conv._id, e)}
                    className="text-red-500 hover:text-red-700"
                  >
                    Delete
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </main>
    </div>
  );
};

export default DashboardPage;