// frontend/src/services/websocketService.ts - Enhanced with better reconnection

import { logger } from '../utils/logger';

interface WebSocketMessage {
  type: string;
  [key: string]: any;
}

class WebSocketService {
  private socket: WebSocket | null = null;
  private isConnected: boolean = false;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 10;
  private initialReconnectDelay: number = 1000; // 1 second
  private maxReconnectDelay: number = 30000; // 30 seconds
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private messageListeners: Map<string, Array<(data: any) => void>> = new Map();
  private connectionListeners: Array<(isConnected: boolean) => void> = [];
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private url: string = '';
  
  /**
   * Connect to WebSocket server
   * @param token JWT authentication token
   * @returns WebSocket instance or null
   */
  connectWebSocket(token: string): WebSocket | null {
    if (typeof window === 'undefined') {
      return null; // We're on the server
    }
    
    try {
      // Close existing connection if any
      this.disconnectWebSocket();
      
      // Determine WebSocket URL
      const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
      const host = window.location.host;
      this.url = `${protocol}://${host}/ws?token=${token}`;
      
      // Create new WebSocket connection
      this.socket = new WebSocket(this.url);
      
      // Set up event handlers
      this.socket.onopen = this.handleOpen.bind(this);
      this.socket.onclose = this.handleClose.bind(this);
      this.socket.onerror = this.handleError.bind(this);
      this.socket.onmessage = this.handleMessage.bind(this);
      
      return this.socket;
    } catch (error) {
      logger.error('Error connecting to WebSocket:', error);
      this.attemptReconnect();
      return null;
    }
  }
  
  // frontend/src/services/websocketService.ts - Enhanced with better reconnection (continued)

  /**
   * Disconnect WebSocket connection
   */
  disconnectWebSocket(): void {
    this.stopHeartbeat();
    
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
    
    this.cancelReconnect();
    this.isConnected = false;
    this.reconnectAttempts = 0;
  }
  
  /**
   * Handle WebSocket open event
   */
  private handleOpen(event: Event): void {
    logger.info('WebSocket connected');
    this.isConnected = true;
    this.reconnectAttempts = 0;
    this.notifyConnectionListeners(true);
    this.startHeartbeat();
  }
  
  /**
   * Handle WebSocket close event
   */
  private handleClose(event: CloseEvent): void {
    logger.info(`WebSocket disconnected: ${event.code} ${event.reason}`);
    this.isConnected = false;
    this.notifyConnectionListeners(false);
    this.stopHeartbeat();
    
    // Attempt to reconnect if not a normal closure
    if (event.code !== 1000 && event.code !== 1001) {
      this.attemptReconnect();
    }
  }
  
  /**
   * Handle WebSocket error event
   */
  private handleError(event: Event): void {
    logger.error('WebSocket error:', event);
    // Error event is usually followed by a close event
  }
  
  /**
   * Handle WebSocket message event
   */
  private handleMessage(event: MessageEvent): void {
    try {
      const data = JSON.parse(event.data);
      logger.debug('WebSocket message received:', data);
      
      // Handle pong messages for heartbeat
      if (data.type === 'pong') {
        return;
      }
      
      // Notify general message listeners
      this.notifyMessageListeners('message', data);
      
      // Notify specific message type listeners
      if (data.type) {
        this.notifyMessageListeners(data.type, data);
      }
    } catch (error) {
      logger.error('Error processing WebSocket message:', error);
    }
  }
  
  /**
   * Start heartbeat to keep connection alive
   */
  private startHeartbeat(): void {
    this.stopHeartbeat();
    
    // Send a ping message every 30 seconds
    this.heartbeatInterval = setInterval(() => {
      if (this.isConnected && this.socket?.readyState === WebSocket.OPEN) {
        this.sendMessage({ type: 'ping', timestamp: Date.now() });
      }
    }, 30000);
  }
  
  /**
   * Stop heartbeat
   */
  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }
  
  /**
   * Attempt to reconnect with exponential backoff
   */
  private attemptReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      logger.warn('Maximum reconnection attempts reached');
      this.notifyMessageListeners('reconnect_failed', {
        message: 'Maximum reconnection attempts reached'
      });
      return;
    }
    
    this.cancelReconnect();
    
    // Calculate delay with exponential backoff and jitter
    const delay = Math.min(
      this.initialReconnectDelay * Math.pow(1.5, this.reconnectAttempts),
      this.maxReconnectDelay
    );
    const jitter = 0.1; // 10% jitter
    const jitterAmount = delay * jitter * (Math.random() * 2 - 1);
    const finalDelay = delay + jitterAmount;
    
    logger.info(`Attempting to reconnect in ${Math.round(finalDelay)}ms (attempt ${this.reconnectAttempts + 1}/${this.maxReconnectAttempts})`);
    
    this.notifyMessageListeners('reconnecting', {
      attempt: this.reconnectAttempts + 1,
      maxAttempts: this.maxReconnectAttempts,
      delay: Math.round(finalDelay)
    });
    
    this.reconnectTimeout = setTimeout(() => {
      this.reconnectAttempts++;
      
      // If we have a URL, reconnect
      if (this.url) {
        this.socket = new WebSocket(this.url);
        this.socket.onopen = this.handleOpen.bind(this);
        this.socket.onclose = this.handleClose.bind(this);
        this.socket.onerror = this.handleError.bind(this);
        this.socket.onmessage = this.handleMessage.bind(this);
      }
    }, finalDelay);
  }
  
  /**
   * Cancel reconnection attempt
   */
  private cancelReconnect(): void {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
  }
  
  /**
   * Add message event listener
   * @param type Message type to listen for
   * @param callback Callback function
   */
  addEventListener(type: string, callback: (data: any) => void): void {
    if (!this.messageListeners.has(type)) {
      this.messageListeners.set(type, []);
    }
    
    this.messageListeners.get(type)?.push(callback);
  }
  
  /**
   * Remove message event listener
   * @param type Message type
   * @param callback Callback function
   */
  removeEventListener(type: string, callback: (data: any) => void): void {
    const listeners = this.messageListeners.get(type);
    if (!listeners) return;
    
    const index = listeners.indexOf(callback);
    if (index !== -1) {
      listeners.splice(index, 1);
    }
  }
  
  /**
   * Add connection state change listener
   * @param callback Callback function
   */
  addConnectionListener(callback: (isConnected: boolean) => void): void {
    this.connectionListeners.push(callback);
    
    // Call immediately with current state
    callback(this.isConnected);
  }
  
  /**
   * Remove connection state change listener
   * @param callback Callback function
   */
  removeConnectionListener(callback: (isConnected: boolean) => void): void {
    const index = this.connectionListeners.indexOf(callback);
    if (index !== -1) {
      this.connectionListeners.splice(index, 1);
    }
  }
  
  /**
   * Notify message listeners of an event
   * @param type Message type
   * @param data Message data
   */
  private notifyMessageListeners(type: string, data: any): void {
    const listeners = this.messageListeners.get(type);
    if (!listeners || listeners.length === 0) return;
    
    listeners.forEach(callback => {
      try {
        callback(data);
      } catch (error) {
        logger.error(`Error in WebSocket ${type} event handler:`, error);
      }
    });
  }
  
  /**
   * Notify connection listeners of connection state change
   * @param isConnected Connection state
   */
  private notifyConnectionListeners(isConnected: boolean): void {
    this.connectionListeners.forEach(callback => {
      try {
        callback(isConnected);
      } catch (error) {
        logger.error('Error in WebSocket connection listener:', error);
      }
    });
  }
  
  /**
   * Send a message to the server
   * @param data Message data
   * @returns Success status
   */
  sendMessage(data: WebSocketMessage): boolean {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      logger.warn('WebSocket is not connected');
      return false;
    }
    
    try {
      this.socket.send(JSON.stringify(data));
      return true;
    } catch (error) {
      logger.error('Error sending WebSocket message:', error);
      return false;
    }
  }
  
  /**
   * Get connection status
   * @returns Connection status
   */
  isWebSocketConnected(): boolean {
    return this.isConnected && !!this.socket && this.socket.readyState === WebSocket.OPEN;
  }
}

// Export singleton instance
const websocketService = new WebSocketService();
export default websocketService;