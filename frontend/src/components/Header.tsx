// src/components/Header.tsx - Application header component

import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const Header: React.FC = () => {
  const { isAuthenticated, user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <header className="bg-blue-600 text-white shadow-md">
      <div className="container mx-auto px-4 py-3 flex justify-between items-center">
        <Link to="/" className="text-xl font-bold">Production Chatbot</Link>
        
        <nav>
          {isAuthenticated ? (
            <div className="flex items-center space-x-4">
              <span>Welcome, {user?.name}</span>
              <button 
                onClick={handleLogout}
                className="bg-blue-500 hover:bg-blue-700 text-white py-1 px-3 rounded"
              >
                Logout
              </button>
            </div>
          ) : (
            <div className="space-x-2">
              <Link to="/login" className="bg-blue-500 hover:bg-blue-700 text-white py-1 px-3 rounded">
                Login
              </Link>
              <Link to="/register" className="bg-white text-blue-600 hover:bg-gray-100 py-1 px-3 rounded">
                Register
              </Link>
            </div>
          )}
        </nav>
      </div>
    </header>
  );
};

export default Header;

