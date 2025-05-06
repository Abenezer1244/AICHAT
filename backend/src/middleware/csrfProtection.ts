// Install the package: npm install csurf
// src/middleware/csrfProtection.ts

import { Request, Response, NextFunction } from 'express';
import csurf from 'csurf';

// Create CSRF protection middleware
const csrfProtection = csurf({
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict'
  }
});

// CSRF error handler
const handleCSRFError = (err: any, req: Request, res: Response, next: NextFunction) => {
  if (err.code === 'EBADCSRFTOKEN') {
    // Handle CSRF token errors
    return res.status(403).json({
      success: false,
      error: 'Invalid or expired CSRF token'
    });
  }
  
  // Pass to next error handler
  next(err);
};

export { csrfProtection, handleCSRFError };