import React, { useContext } from 'react';
import { Outlet } from 'react-router-dom';
import AuthContext from './contexts/AuthContext';
import Navbar from './components/layout/Navbar';
import './App.css';

const App = () => {
  const { isAuthenticated, isLoading } = useContext(AuthContext);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="spinner"></div>
        <p className="ml-2">Loading application...</p>
      </div>
    );
  }

  return (
    <div className="app">
      {isAuthenticated && <Navbar />}
      <main className="main-content">
        <Outlet />
      </main>
    </div>
  );
};

export default App;