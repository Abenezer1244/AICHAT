// src/services/websocketService.ts - WebSocket service implementation

import { Server as HttpServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { logger } from '../../utils/logger';
import jwt from 'jsonwebtoken';
import websocketService from '../../services/websocketService';
export default websocketService;


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

// WebSocket message interfaces
interface WebSocketMessage {
  type: string;
  [key: string]: any;
}

interface ConnectionMessage extends WebSocketMessage {
  type: 'connected';
  message: string;
  timestamp: number;
}

interface PingMessage extends WebSocketMessage {
  type: 'ping';
}

interface PongMessage extends WebSocketMessage {
  type: 'pong';
  timestamp: number;
}

interface NewMessageMessage extends WebSocketMessage {
  type: 'new_message';
  message: {
    conversationId: string;
    message: string;
    timestamp: Date;
  };
  timestamp: number;
}

class WebSocketService {
  private wss: WebSocketServer | null = null;
  private clients: Map<string, AuthenticatedWebSocket> = new Map();
  private pingInterval: NodeJS.Timeout | null = null;
  private wsClient: WebSocket | null = null;
  private clientEventHandlers: Map<string, Array<(data: any) => void>> = new Map();
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 5;
  private reconnectTimeout: NodeJS.Timeout | null = null;
  
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
      path: '/ws' // This matches the client-side WebSocket path
    });
    
    logger.info('WebSocket server initialized');
    
    // Setup ping interval for connection health checks
    this.pingInterval = setInterval(() => this.checkConnections(), 30000);
    
    this.setupEventHandlers();
  }
  
  /**
   * Set up WebSocket server event handlers
   */
  private setupEventHandlers(): void {
    if (!this.wss) return;
    
    this.wss.on('connection', (ws: AuthenticatedWebSocket, request: any) => {
      // Set initial connection properties
      ws.isAlive = true;
      
      // Extract token from URL query parameters
      const url = new URL(request.url || '', `http://${request.headers.host}`);
      const token: string | null = url.searchParams.get('token');
      
      // Authenticate connection
      if (token) {
        try {
          const decoded = jwt.verify(token, process.env.JWT_SECRET as string) as { 
            id: string;
            role: string;
          };
          
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
          const message = JSON.parse(data);
          logger.debug(`WebSocket message received from ${ws.userId}:`, message);
          
          // Handle different message types
          if (message.type === 'ping') {
            this.sendToClient(ws.userId as string, {
              type: 'pong',
              timestamp: Date.now()
            } as PongMessage);
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
      } as ConnectionMessage);
    });
    
    // Handle WebSocket server errors
    this.wss.on('error', (error: Error): void => {
      logger.error('WebSocket server error:', error);
    });
  }
  
  /**
   * Check connections health and terminate dead connections
   */
  private checkConnections(): void {
    if (!this.wss) return;
    
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
  }
  
  /**
   * Connect to the WebSocket server (client-side)
   * @param token Authentication token
   * @returns WebSocket instance
   */
  connectWebSocket(token: string): WebSocket | null {
    if (typeof window === 'undefined') {
      // We're on the server, just return null
      return null;
    }
    
    try {
      // Close existing connection if any
      if (this.wsClient) {
        this.wsClient.close();
        this.wsClient = null;
      }
      
      // Determine WebSocket URL
      const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
      const host = window.location.host;
      const url = `${protocol}://${host}/ws?token=${token}`;
      
      // Create new WebSocket connection
      this.wsClient = new WebSocket(url);
      
      // Set up event handlers
      this.wsClient.onopen = (event) => {
        console.log('WebSocket connected');
        this.reconnectAttempts = 0;
        this.triggerEvent('open', event);
        
        // Send ping every 30 seconds to keep connection alive
        setInterval(() => {
          if (this.wsClient?.readyState === WebSocket.OPEN) {
            this.wsClient.send(JSON.stringify({ type: 'ping' }));
          }
        }, 30000);
      };
      
      this.wsClient.onclose = (event) => {
        console.log('WebSocket closed', event.code, event.reason);
        this.triggerEvent('close', event);
        
        // Attempt to reconnect if not a normal closure
        if (event.code !== 1000 && event.code !== 1001) {
          this.attemptReconnect(token);
        }
      };
      
      this.wsClient.onerror = (event) => {
        console.error('WebSocket error:', event);
        this.triggerEvent('error', event);
      };
      
      this.wsClient.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log('WebSocket message received:', data);
          
          // Trigger general message event
          this.triggerEvent('message', data);
          
          // Trigger specific event type
          if (data.type) {
            this.triggerEvent(data.type, data);
          }
        } catch (error) {
          console.error('Error processing WebSocket message:', error);
        }
      };
      
      return this.wsClient;
    } catch (error) {
      console.error('Error connecting to WebSocket:', error);
      return null;
    }
  }
  
  /**
   * Disconnect WebSocket connection (client-side)
   */
  disconnectWebSocket(): void {
    if (this.wsClient) {
      this.wsClient.close();
      this.wsClient = null;
    }
    
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    
    this.reconnectAttempts = 0;
    this.clientEventHandlers.clear();
  }
  
  /**
   * Attempt to reconnect to WebSocket server (client-side)
   * @param token Authentication token
   */
  private attemptReconnect(token: string): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.log('Maximum reconnection attempts reached');
      return;
    }
    
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
    console.log(`Attempting to reconnect in ${delay}ms (attempt ${this.reconnectAttempts + 1}/${this.maxReconnectAttempts})`);
    
    this.reconnectTimeout = setTimeout(() => {
      this.reconnectAttempts++;
      this.connectWebSocket(token);
    }, delay);
  }
  
  /**
   * Add client-side event listener
   * @param event Event name
   * @param callback Event callback
   */
  addEventListener(event: string, callback: (data: any) => void): void {
    if (!this.clientEventHandlers.has(event)) {
      this.clientEventHandlers.set(event, []);
    }
    
    this.clientEventHandlers.get(event)?.push(callback);
  }
  
  /**
   * Remove client-side event listener
   * @param event Event name
   * @param callback Event callback
   */
  removeEventListener(event: string, callback: (data: any) => void): void {
    if (!this.clientEventHandlers.has(event)) {
      return;
    }
    
    const handlers = this.clientEventHandlers.get(event);
    if (!handlers) return;
    
    const index = handlers.indexOf(callback);
    if (index !== -1) {
      handlers.splice(index, 1);
    }
  }
  
  /**
   * Trigger client-side event
   * @param event Event name
   * @param data Event data
   */
  private triggerEvent(event: string, data: any): void {
    const handlers = this.clientEventHandlers.get(event);
    if (handlers && handlers.length > 0) {
      handlers.forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`Error in ${event} event handler:`, error);
        }
      });
    }
  }
  
  /**
   * Clean up resources when shutting down
   */
  cleanup(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
    
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    
    if (this.wss) {
      this.wss.clients.forEach((ws) => {
        try {
          ws.terminate();
        } catch (e) {
          // Ignore errors during shutdown
        }
      });
      
      this.wss.close();
      this.wss = null;
    }
    
    if (this.wsClient) {
      this.wsClient.close();
      this.wsClient = null;
    }
    
    this.clients.clear();
    this.clientEventHandlers.clear();
    this.reconnectAttempts = 0;
    
    logger.info('WebSocket service cleaned up');
  }
  
  /**
   * Send a message to a specific client (server-side)
   * @param userId User ID
   * @param data Message data
   * @returns Success status
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
   * Send a message to the server (client-side)
   * @param data Message data
   * @returns Success status
   */
  sendMessage(data: any): boolean {
    if (!this.wsClient || this.wsClient.readyState !== WebSocket.OPEN) {
      console.error('WebSocket is not connected');
      return false;
    }
    
    try {
      this.wsClient.send(JSON.stringify(data));
      return true;
    } catch (error) {
      console.error('Error sending message:', error);
      return false;
    }
  }
  
  /**
   * Broadcast a message to all connected clients (server-side)
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
   * Notify a user about a new chat message (server-side)
   * @param userId User ID
   * @param message Message content
   */
  notifyNewMessage(userId: string, message: any): void {
    this.sendToClient(userId, {
      type: 'new_message',
      message,
      timestamp: Date.now()
    } as NewMessageMessage);
  }
  
  /**
   * Get connection status (client-side)
   * @returns Connection status
   */
  isConnected(): boolean {
    return !!this.wsClient && this.wsClient.readyState === WebSocket.OPEN;
  }
}

// Export singleton instance
export default new WebSocketService();