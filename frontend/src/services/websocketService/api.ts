// File: frontend/src/services/api.ts
const API_URL = process.env.REACT_APP_API_URL || '/api';

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

import axios from 'axios';

export const chatAPI = {
  getConversations: () => axios.get('/api/conversations'),
  getConversation: (id: string) => 
    axios.get(`/api/conversations/${id}`),
deleteConversation: (id: string) =>
    axios.delete(`/api/conversations/${id}`),
  
  sendMessage: (message: string, conversationId?: string) =>
    axios.post('/api/messages', { message, conversationId })
};

// Generic GET request
export const get = async <T>(endpoint: string): Promise<T> => {
  const token = localStorage.getItem('token');
  
  const response = await fetch(`${API_URL}${endpoint}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': token ? `Bearer ${token}` : ''
    }
  });
  
  const data: ApiResponse<T> = await response.json();
  
  if (!response.ok) {
    throw new Error(data.error || 'An error occurred');
  }
  
  return data.data as T;
};

// Generic POST request
export const post = async <T>(endpoint: string, body: any): Promise<T> => {
  const token = localStorage.getItem('token');
  
  const response = await fetch(`${API_URL}${endpoint}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': token ? `Bearer ${token}` : ''
    },
    body: JSON.stringify(body)
  });
  
  const data: ApiResponse<T> = await response.json();
  
  if (!response.ok) {
    throw new Error(data.error || 'An error occurred');
  }
  
  return data.data as T;
};

// Generic DELETE request
export const del = async <T>(endpoint: string): Promise<T> => {
  const token = localStorage.getItem('token');
  
  const response = await fetch(`${API_URL}${endpoint}`, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': token ? `Bearer ${token}` : ''
    }
  });
  
  const data: ApiResponse<T> = await response.json();
  
  if (!response.ok) {
    throw new Error(data.error || 'An error occurred');
  }
  
  return data.data as T;
};
