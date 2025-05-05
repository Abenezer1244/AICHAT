// src/router.jsx - Complete updated router configuration

import { createBrowserRouter } from 'react-router-dom';
import App from './App';
import DashboardPage from './pages/DashboardPage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import ChatPage from './pages/ChatPage';
import NotFoundPage from './pages/NotFoundPage';
import UnauthorizedPage from './pages/UnauthorizedPage';
import ProtectedRoute from './components/ProtectedRoute';

// Create the router with all routes defined
const router = createBrowserRouter([
  {
    path: '/',
    element: <App />,
    children: [
      {
        index: true,
        element: <DashboardPage />
      },
      {
        path: 'login',
        element: <LoginPage />
      },
      {
        path: 'register',
        element: <RegisterPage />
      },
      {
        path: 'dashboard',
        element: <DashboardPage />
      },
      {
        path: 'chat/:conversationId?',
        element: <ChatPage />
      },
      {
        path: 'unauthorized',
        element: <UnauthorizedPage />
      },
      {
        path: '*',
        element: <NotFoundPage />
      }
    ]
  }
]);

// Export the router
export default router;

// Define custom types for the router if needed
export const RouterTypes = {
  RoutePath: {
    HOME: '/',
    LOGIN: '/login',
    REGISTER: '/register',
    DASHBOARD: '/dashboard',
    CHAT: '/chat',
    UNAUTHORIZED: '/unauthorized'
  }
};

// Note: No FUTURE_FLAGS export to avoid conflicts