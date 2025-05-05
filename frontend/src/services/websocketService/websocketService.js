// WebSocket client service for real-time communication

class WebSocketService {
    constructor() {
      this.socket = null;
      this.isConnected = false;
      this.reconnectAttempts = 0;
      this.maxReconnectAttempts = 5;
      this.reconnectTimeout = null;
      this.messageListeners = new Map();
      this.connectionListeners = [];
    }
  
    /**
     * Connect to WebSocket server
     * @param {string} token JWT authentication token
     */
    connect(token) {
      if (this.socket) {
        this.disconnect();
      }
  
      // Get the WebSocket URL based on the current environment
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const host = process.env.REACT_APP_WS_URL || window.location.host;
      const wsUrl = `${protocol}//${host}/ws?token=${token}`;
  
      try {
        this.socket = new WebSocket(wsUrl);
  
        this.socket.onopen = () => {
          console.log('WebSocket connected');
          this.isConnected = true;
          this.reconnectAttempts = 0;
          this._notifyConnectionListeners(true);
          
          // Send a ping message to keep the connection alive
          this._startHeartbeat();
        };
  
        this.socket.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data);
            this._handleMessage(message);
          } catch (error) {
            console.error('Error parsing WebSocket message:', error);
          }
        };
  
        this.socket.onclose = (event) => {
          console.log(`WebSocket disconnected: ${event.code} ${event.reason}`);
          this.isConnected = false;
          this._notifyConnectionListeners(false);
          
          // Clear heartbeat interval
          if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
            this.heartbeatInterval = null;
          }
          
          // Attempt to reconnect
          this._attemptReconnect(token);
        };
  
        this.socket.onerror = (error) => {
          console.error('WebSocket error:', error);
        };
      } catch (error) {
        console.error('Error connecting to WebSocket:', error);
        this._attemptReconnect(token);
      }
    }
  
    /**
     * Disconnect from WebSocket server
     */
    disconnect() {
      if (this.socket) {
        this.socket.close();
        this.socket = null;
      }
      
      this.isConnected = false;
      
      if (this.heartbeatInterval) {
        clearInterval(this.heartbeatInterval);
        this.heartbeatInterval = null;
      }
      
      if (this.reconnectTimeout) {
        clearTimeout(this.reconnectTimeout);
        this.reconnectTimeout = null;
      }
    }
  
    /**
     * Send a message to the server
     * @param {Object} data Message data
     * @returns {boolean} True if the message was sent
     */
    sendMessage(data) {
      if (this.isConnected && this.socket) {
        try {
          this.socket.send(JSON.stringify(data));
          return true;
        } catch (error) {
          console.error('Error sending WebSocket message:', error);
          return false;
        }
      }
      return false;
    }
  
    /**
     * Register a listener for a specific message type
     * @param {string} type Message type
     * @param {Function} callback Callback function
     */
    addMessageListener(type, callback) {
      if (!this.messageListeners.has(type)) {
        this.messageListeners.set(type, []);
      }
      this.messageListeners.get(type).push(callback);
    }
  
    /**
     * Remove a listener for a specific message type
     * @param {string} type Message type
     * @param {Function} callback Callback function
     */
    removeMessageListener(type, callback) {
      if (this.messageListeners.has(type)) {
        const listeners = this.messageListeners.get(type);
        const index = listeners.indexOf(callback);
        if (index !== -1) {
          listeners.splice(index, 1);
        }
      }
    }
  
    /**
     * Add a connection state change listener
     * @param {Function} callback Callback function(isConnected)
     */
    addConnectionListener(callback) {
      this.connectionListeners.push(callback);
    }
  
    /**
     * Remove a connection state change listener
     * @param {Function} callback Callback function
     */
    removeConnectionListener(callback) {
      const index = this.connectionListeners.indexOf(callback);
      if (index !== -1) {
        this.connectionListeners.splice(index, 1);
      }
    }
  
    /**
     * Handle incoming WebSocket message
     * @param {Object} message Message object
     * @private
     */
    _handleMessage(message) {
      // Handle pong messages for heartbeat
      if (message.type === 'pong') {
        // Connection is still alive
        return;
      }
  
      // Call listeners for this message type
      if (this.messageListeners.has(message.type)) {
        this.messageListeners.get(message.type).forEach(callback => {
          try {
            callback(message);
          } catch (error) {
            console.error(`Error in message listener for type ${message.type}:`, error);
          }
        });
      }
    }
  
    /**
     * Notify all connection listeners of connection state change
     * @param {boolean} isConnected Connection state
     * @private
     */
    _notifyConnectionListeners(isConnected) {
      this.connectionListeners.forEach(callback => {
        try {
          callback(isConnected);
        } catch (error) {
          console.error('Error in connection listener:', error);
        }
      });
    }
  
    /**
     * Attempt to reconnect to WebSocket server
     * @param {string} token JWT authentication token
     * @private
     */
    _attemptReconnect(token) {
      if (this.reconnectAttempts >= this.maxReconnectAttempts) {
        console.log('Max reconnect attempts reached');
        return;
      }
  
      this.reconnectAttempts++;
      const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts - 1), 30000);
      
      console.log(`Attempting to reconnect in ${delay / 1000} seconds...`);
      
      this.reconnectTimeout = setTimeout(() => {
        this.connect(token);
      }, delay);
    }
  
    /**
     * Start heartbeat to keep connection alive
     * @private
     */
    _startHeartbeat() {
      if (this.heartbeatInterval) {
        clearInterval(this.heartbeatInterval);
      }
      
      // Send a ping message every 30 seconds
      this.heartbeatInterval = setInterval(() => {
        if (this.isConnected) {
          this.sendMessage({ type: 'ping', timestamp: Date.now() });
        }
      }, 30000);
    }
  }
  
  // Export singleton instance
  const websocketService = new WebSocketService();
  export default websocketService;