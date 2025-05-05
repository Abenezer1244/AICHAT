// src/components/ConversationList.tsx
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { chatAPI } from '../services/websocketService/api';

interface Conversation {
  _id: string;
  title: string;
  createdAt: string;
}

interface ConversationResponse {
  data: {
    data: Conversation[];
  };
}

const ConversationList: React.FC = (): JSX.Element => {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    const fetchConversations = async () => {
      try {
        setLoading(true);
        const response = await chatAPI.getConversations() as ConversationResponse;
        if (response && response.data) {
          setConversations(response.data.data || []);
        }
      } catch (err) {
        setError('Failed to load conversations');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchConversations();
  }, []);

  const handleDelete = async (id: string) => {
    try {
      if (window.confirm('Are you sure you want to delete this conversation?')) {
        await chatAPI.deleteConversation(id);
        setConversations(prev => prev.filter(conv => conv._id !== id));
      }
    } catch (error) {
      setError('Failed to delete conversation');
    }
  };

  if (loading) return <div>Loading...</div>;
  if (error) return <div className="error-message">{error}</div>;

  return (
    <div className="conversation-list">
      <h2>Your Conversations</h2>
      {conversations.length === 0 ? (
        <p>No conversations found. Start a new chat!</p>
      ) : (
        <ul>
          {conversations.map((conversation) => (
            <li key={conversation._id}>
              <Link to={`/chat/${conversation._id}`}>
                {conversation.title}
              </Link>
              <button 
                onClick={() => handleDelete(conversation._id)}
                className="delete-btn"
              >
                Delete
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default ConversationList;