// src/services/websocketService.ts - WebSocket service implementation

import { Server as HttpServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { logger } from '../utils/logger';
import jwt from 'jsonwebtoken';

// Interface for authenticated WebSocket connection
interface AuthenticatedWebSocket extends WebSocket {
  userId?: string;
  isAlive: boolean;
  readyState: 0 | 1 | 2 | 3;
  on(event: string, listener: (...args: any[]) => void): this;
  terminate(): void;
  close(code?: number, data?: string): void;
  ping(data?: any, mask?: boolean): void;
  send(data: string | ArrayBufferLike | Blob | ArrayBufferView): void;
}

class WebSocketService {
  private wss: WebSocketServer | null = null;
  private clients: Map<string, AuthenticatedWebSocket> = new Map();
  
  /**
   * Initialize WebSocket server
   * @param server HTTP server instance
   */
  initialize(server: HttpServer): void {
    this.wss = new WebSocketServer({ 
      server,
      path: '/ws' // This matches the client-side WebSocket path
    });
    
    logger.info('WebSocket server initialized');
    
    // Define message interfaces
    interface WebSocketMessage {
      type: string;
      [key: string]: any;
    }

    interface PingMessage extends WebSocketMessage {
      type: 'ping';
    }

    interface OutgoingMessage extends WebSocketMessage {
      type: string;
      timestamp: number;
    }

    interface WelcomeMessage extends OutgoingMessage {
      type: 'connected';
      message: string;
    }

    interface JwtPayload {
      id: string;
      role: string;
    }

    this.wss.on('connection', (ws: AuthenticatedWebSocket, request: any) => {
      // Set initial connection properties
      ws.isAlive = true;
      
      // Extract token from URL query parameters
      const url = new URL(request.url || '', `http://${request.headers.host}`);
      const token: string | null = url.searchParams.get('token');
      
      // Authenticate connection
      if (token) {
        try {
          const decoded: JwtPayload = jwt.verify(token, process.env.JWT_SECRET as string) as JwtPayload;
          
          ws.userId = decoded.id;
          this.clients.set(decoded.id, ws);
          
          logger.info(`WebSocket client connected: ${decoded.id}`);
        } catch (error) {
          logger.error('WebSocket authentication failed:', error);
          ws.close(1008, 'Authentication failed');
          return;
        }
      } else {
        // No token provided
        logger.warn('WebSocket connection attempt without token');
        ws.close(1008, 'Authentication required');
        return;
      }
      
      // Handle pong messages for connection health checks
      ws.on('pong', () => {
        ws.isAlive = true;
      });
      
      // Handle incoming messages
      ws.on('message', (data: string) => {
        try {
          const message: WebSocketMessage = JSON.parse(data);
          logger.debug(`WebSocket message received from ${ws.userId}:`, message);
          
          // Handle different message types
          if (message.type === 'ping') {
            this.sendToClient(ws.userId as string, {
              type: 'pong',
              timestamp: Date.now()
            } as OutgoingMessage);
          }
          
          // Add other message handlers as needed
        } catch (error) {
          logger.error('Error processing WebSocket message:', error);
        }
      });
      
      // Handle disconnection
      ws.on('close', () => {
        if (ws.userId) {
          this.clients.delete(ws.userId);
          logger.info(`WebSocket client disconnected: ${ws.userId}`);
        }
      });
      
      // Send welcome message
      this.sendToClient(ws.userId as string, {
        type: 'connected',
        message: 'Connection established successfully',
        timestamp: Date.now()
      } as WelcomeMessage);
    });
    
    // Set up regular health checks
    const interval = setInterval(() => {
      if (!this.wss) {
        clearInterval(interval);
        return;
      }
      
      this.wss.clients.forEach((wsClient) => {
        const ws = wsClient as unknown as AuthenticatedWebSocket;
        if (!ws.isAlive) {
          if (ws.userId) {
            this.clients.delete(ws.userId);
            logger.info(`WebSocket client timed out: ${ws.userId}`);
          }
          return ws.terminate();
        }
        
        ws.isAlive = false;
        ws.ping();
      });
    }, 30000); // Check every 30 seconds
    
    // Handle WebSocket server errors
    interface WsServerErrorEvent {
      error: Error;
    }

    this.wss.on('error', (error: Error): void => {
      logger.error('WebSocket server error:', error);
    });
  }
  
  /**
   * Send a message to a specific client
   * @param userId User ID
   * @param data Message data
   */
  sendToClient(userId: string, data: any): boolean {
    try {
      const client = this.clients.get(userId);
      
      if (client && client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify(data));
        return true;
      }
      return false;
    } catch (error) {
      logger.error(`Error sending to client ${userId}:`, error);
      return false;
    }
  }
  
  /**
   * Broadcast a message to all connected clients
   * @param data Message data
   * @param excludeUserId Optional user ID to exclude from broadcast
   */
  broadcast(data: any, excludeUserId?: string): void {
    try {
      this.clients.forEach((client, userId) => {
        if (excludeUserId && userId === excludeUserId) {
          return;
        }
        
        if (client.readyState === WebSocket.OPEN) {
          client.send(JSON.stringify(data));
        }
      });
    } catch (error) {
      logger.error('Error broadcasting message:', error);
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
}

// Export singleton instance
export default new WebSocketService();