// src/services/websocketService.ts - Enhanced with better security

import { Server as HttpServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { logger } from '../utils/logger';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';

// Interface for authenticated WebSocket connection
interface AuthenticatedWebSocket extends WebSocket {
  userId: string;
  role: string;
  isAlive: boolean;
  connectionId: string; // Unique ID for this connection
  readyState: 0 | 1 | 2 | 3;
}

class WebSocketService {
  private wss: WebSocketServer | null = null;
  private clients: Map<string, AuthenticatedWebSocket[]> = new Map();
  private pingInterval: NodeJS.Timeout | null = null;
  
  /**
   * Initialize WebSocket server
   * @param server HTTP server instance
   */
  initialize(server: HttpServer): void {
    if (this.wss) {
      return; // Already initialized
    }
    
    this.wss = new WebSocketServer({ 
      server,
      path: '/ws',
      // Add WebSocket server options
      clientTracking: true,
      perMessageDeflate: {
        zlibDeflateOptions: {
          level: 6, // Default compression level
        }
      },
      // Add more security options
      maxPayload: 1024 * 1024, // 1MB max message size
      // Skip server verification in development
      verifyClient: process.env.NODE_ENV === 'production'
        ? this.verifyClient.bind(this)
        : undefined
    });
    
    logger.info('WebSocket server initialized');
    
    // Setup ping interval for connection health checks
    this.pingInterval = setInterval(() => this.checkConnections(), 30000);
    
    this.setupEventHandlers();
  }
  
  // Additions to websocketService.ts

// Add heartbeat mechanism to detect dead connections
private setupHeartbeat(): void {
  if (!this.wss) return;
  
  // Set up interval to ping clients
  setInterval(() => {
    this.wss.clients.forEach((ws: AuthenticatedWebSocket) => {
      if (ws.isAlive === false) {
        // Client didn't respond to previous ping
        if (ws.userId) {
          this.clients.delete(ws.userId);
          logger.info(`Terminating inactive WebSocket connection for user: ${ws.userId}`);
        }
        return ws.terminate();
      }
      
      // Set to false and send ping - client should respond with pong
      ws.isAlive = false;
      ws.ping();
    });
  }, 30000); // Check every 30 seconds
}

// Add connection status monitoring for metrics
private trackConnectionMetrics(): void {
  setInterval(() => {
    const activeConnections = this.wss.clients.size;
    // If using Prometheus, you can record the gauge here
    logger.debug(`Active WebSocket connections: ${activeConnections}`);
  }, 60000); // Update every minute
}

// Add method to broadcast system messages
public broadcastSystemMessage(message: string): void {
  this.broadcast({
    type: 'system',
    message,
    timestamp: Date.now()
  });
}


  /**
   * Verify client connection - basic security check
   */
  private verifyClient(info: { origin: string, req: any, secure: boolean }, callback: (res: boolean, code?: number, message?: string) => void): void {
    try {
      // Check origin
      const allowedOrigins = process.env.ALLOWED_ORIGINS 
        ? process.env.ALLOWED_ORIGINS.split(',') 
        : [];
        
      // In production, require valid origin
      if (process.env.NODE_ENV === 'production' && 
          allowedOrigins.length > 0 && 
          !allowedOrigins.includes(info.origin)) {
        logger.warn(`WebSocket connection rejected due to invalid origin: ${info.origin}`);
        return callback(false, 403, 'Forbidden');
      }
      
      // Check for token in query parameters
      const url = new URL(info.req.url, `http://${info.req.headers.host}`);
      const token = url.searchParams.get('token');
      
      if (!token) {
        logger.warn('WebSocket connection attempt without token');
        return callback(false, 401, 'Unauthorized');
      }
      
      // Verify token
      try {
        jwt.verify(token, process.env.JWT_SECRET as string);
        return callback(true);
      } catch (err) {
        logger.warn('WebSocket connection with invalid token');
        return callback(false, 401, 'Unauthorized');
      }
    } catch (error) {
      logger.error('Error in WebSocket client verification:', error);
      return callback(false, 500, 'Internal Server Error');
    }
  }
  
  /**
   * Set up WebSocket server event handlers
   */
  private setupEventHandlers(): void {
    if (!this.wss) return;
    
    this.wss.on('connection', this.handleConnection.bind(this));
    
    this.wss.on('error', (error: Error): void => {
      logger.error('WebSocket server error:', error);
    });
    
    // Handle server close
    this.wss.on('close', () => {
      logger.info('WebSocket server closed');
      this.cleanup();
    });
  }
  
  /**
   * Handle new WebSocket connection
   */
  private handleConnection(ws: WebSocket, request: any): void {
    try {
      // Extract token from URL query parameters
      const url = new URL(request.url, `http://${request.headers.host}`);
      const token = url.searchParams.get('token');
      
      if (!token) {
        logger.warn('WebSocket connection attempt without token');
        ws.close(1008, 'Authentication required');
        return;
      }
      
      // Authenticate connection
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET as string) as { 
          id: string; 
          role: string;
        };
        
        // Extend WebSocket with auth info
        const authWs = ws as AuthenticatedWebSocket;
        authWs.userId = decoded.id;
        authWs.role = decoded.role;
        authWs.isAlive = true;
        authWs.connectionId = crypto.randomUUID();
        
        // Store client connection
        if (!this.clients.has(decoded.id)) {
          this.clients.set(decoded.id, []);
        }
        this.clients.get(decoded.id)?.push(authWs);
        
        logger.info(`WebSocket client connected: ${decoded.id}`);
        
        // Set up event handlers for this connection
        authWs.on('pong', () => {
          authWs.isAlive = true;
        });
        
        authWs.on('message', (data: Buffer) => {
          this.handleMessage(authWs, data);
        });
        
        authWs.on('close', (code: number, reason: Buffer) => {
          this.handleClose(authWs, code, reason.toString());
        });
        
        authWs.on('error', (error: Error) => {
          logger.error(`WebSocket error for user ${authWs.userId}:`, error);
        });
        
        // Send welcome message
        this.sendToClient(authWs, {
          type: 'connected',
          message: 'Connection established successfully',
          timestamp: Date.now()
        });
      } catch (error) {
        logger.error('WebSocket authentication failed:', error);
        ws.close(1008, 'Authentication failed');
      }
    } catch (error) {
      logger.error('Error in WebSocket connection handler:', error);
      ws.close(1011, 'Internal Server Error');
    }
  }
  
  /**
   * Handle WebSocket message
   */
  private handleMessage(ws: AuthenticatedWebSocket, data: Buffer): void {
    try {
      // Parse message
      const message = JSON.parse(data.toString());
      logger.debug(`WebSocket message received from ${ws.userId}:`, message);
      
      // Handle different message types
      switch (message.type) {
        case 'ping':
          this.sendToClient(ws, {
            type: 'pong',
            timestamp: Date.now()
          });
          break;
          
        // Add more message type handlers here
          
        default:
          // Unknown message type
          logger.warn(`Unknown WebSocket message type: ${message.type}`);
      }
    } catch (error) {
      logger.error('Error processing WebSocket message:', error);
    }
  }
  
  /**
   * Handle WebSocket close
   */
  private handleClose(ws: AuthenticatedWebSocket, code: number, reason: string): void {
    try {
      logger.info(`WebSocket connection closed for user ${ws.userId}: ${code} ${reason}`);
      
      // Remove from clients map
      const userConnections = this.clients.get(ws.userId);
      if (userConnections) {
        const index = userConnections.findIndex(conn => conn.connectionId === ws.connectionId);
        if (index !== -1) {
          userConnections.splice(index, 1);
        }
        
        // If no more connections for this user, remove the entry
        if (userConnections.length === 0) {
          this.clients.delete(ws.userId);
        }
      }
    } catch (error) {
      logger.error('Error in WebSocket close handler:', error);
    }
  }
  
  /**
   * Check connections health and terminate dead connections
   */
  private checkConnections(): void {
    if (!this.wss) return;
    
    try {
      this.wss.clients.forEach((ws) => {
        const authWs = ws as AuthenticatedWebSocket;
        
        if (!authWs.isAlive) {
          logger.info(`Terminating inactive WebSocket connection for user ${authWs.userId}`);
          return authWs.terminate();
        }
        
        authWs.isAlive = false;
        authWs.ping();
      });
    } catch (error) {
      logger.error('Error checking WebSocket connections:', error);
    }
  }
  
  /**
   * Clean up resources
   */
  cleanup(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
    
    if (this.wss) {
      this.wss.clients.forEach((ws) => {
        try {
          ws.terminate();
        } catch (e) {
          // Ignore errors during shutdown
        }
      });
      
      this.wss = null;
    }
    
    this.clients.clear();
  }
  
  /**
   * Send a message to a specific client
   * @param ws WebSocket connection or userId
   * @param data Message data
   * @returns Success status
   */
  sendToClient(ws: AuthenticatedWebSocket | string, data: any): boolean {
    try {
      // If ws is a string (userId), find the client
      if (typeof ws === 'string') {
        const userConnections = this.clients.get(ws);
        if (!userConnections || userConnections.length === 0) {
          return false;
        }
        
        // Send to all connections for this user
        let success = false;
        userConnections.forEach(conn => {
          if (conn.readyState === WebSocket.OPEN) {
            conn.send(JSON.stringify(data));
            success = true;
          }
        });
        
        return success;
      }
      
      // If ws is a WebSocket, send directly
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(data));
        return true;
      }
      
      return false;
    } catch (error) {
      logger.error('Error sending WebSocket message:', error);
      return false;
    }
  }
  
  /**
   * Broadcast a message to all connected clients
   * @param data Message data
   * @param excludeUserId Optional user ID to exclude
   */
  broadcast(data: any, excludeUserId?: string): void {
    if (!this.wss) return;
    
    try {
      this.wss.clients.forEach((ws) => {
        const authWs = ws as AuthenticatedWebSocket;
        
        if (excludeUserId && authWs.userId === excludeUserId) {
          return;
        }
        
        if (authWs.readyState === WebSocket.OPEN) {
          authWs.send(JSON.stringify(data));
        }
      });
    } catch (error) {
      logger.error('Error broadcasting WebSocket message:', error);
    }
  }
  
  /**
   * Notify a user about a new chat message
   * @param userId User ID
   * @param message Message content
   */
  notifyNewMessage(userId: string, message: any): void {
    this.sendToClient(userId, {
      type: 'new_message',
      message,
      timestamp: Date.now()
    });
  }
  
  /**
   * Get number of connected clients
   * @returns Number of connected clients
   */
  getConnectionCount(): number {
    return this.wss ? this.wss.clients.size : 0;
  }
  
  /**
   * Get number of unique users connected
   * @returns Number of unique users
   */
  getUniqueUserCount(): number {
    return this.clients.size;
  }
}

// Export singleton instance
export default new WebSocketService();