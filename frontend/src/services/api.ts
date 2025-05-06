// frontend/src/services/api.ts - Enhanced API service with better error handling

const API_URL = process.env.REACT_APP_API_URL || '/api';

interface ApiError extends Error {
  statusCode?: number;
  details?: string;
  response?: {
    data?: {
      error?: string;
      message?: string;
    };
    status?: number;
  };
}

class ApiService {
  private token: string | null;

  constructor() {
    this.token = localStorage.getItem('token');
  }

  /**
   * Set authentication token
   * @param token JWT token
   */
  setToken(token: string | null) {
    this.token = token;
    if (token) {
      localStorage.setItem('token', token);
    } else {
      localStorage.removeItem('token');
    }
  }

  /**
   * Make a GET request
   * @param endpoint API endpoint
   * @returns Promise with response data
   */
  async get<T>(endpoint: string): Promise<T> {
    try {
      const response = await fetch(`${API_URL}${endpoint}`, {
        method: 'GET',
        headers: this.getHeaders(),
      });

      return this.handleResponse<T>(response);
    } catch (error) {
      return this.handleError<T>(error as ApiError);
    }
  }

  /**
   * Make a POST request
   * @param endpoint API endpoint
   * @param data Request body data
   * @returns Promise with response data
   */
  async post<T>(endpoint: string, data: any): Promise<T> {
    try {
      const response = await fetch(`${API_URL}${endpoint}`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(data),
      });

      return this.handleResponse<T>(response);
    } catch (error) {
      return this.handleError<T>(error as ApiError);
    }
  }

  /**
   * Make a PUT request
   * @param endpoint API endpoint
   * @param data Request body data
   * @returns Promise with response data
   */
  async put<T>(endpoint: string, data: any): Promise<T> {
    try {
      const response = await fetch(`${API_URL}${endpoint}`, {
        method: 'PUT',
        headers: this.getHeaders(),
        body: JSON.stringify(data),
      });

      return this.handleResponse<T>(response);
    } catch (error) {
      return this.handleError<T>(error as ApiError);
    }
  }

  /**
   * Make a DELETE request
   * @param endpoint API endpoint
   * @returns Promise with response data
   */
  async delete<T>(endpoint: string): Promise<T> {
    try {
      const response = await fetch(`${API_URL}${endpoint}`, {
        method: 'DELETE',
        headers: this.getHeaders(),
      });

      return this.handleResponse<T>(response);
    } catch (error) {
      return this.handleError<T>(error as ApiError);
    }
  }

  /**
   * Get request headers
   * @returns Headers object
   */
  private getHeaders(): HeadersInit {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    return headers;
  }

  /**
   * Handle API response
   * @param response Fetch response object
   * @returns Promise with response data
   */
  private async handleResponse<T>(response: Response): Promise<T> {
    if (!response.ok) {
      const error: ApiError = new Error('API request failed');
      error.statusCode = response.status;
      
      try {
        const errorData = await response.json();
        error.details = errorData.error || errorData.message || 'Unknown error';
      } catch (e) {
        error.details = 'Failed to parse error response';
      }

      throw error;
    }

    return await response.json();
  }

  /**
   * Handle API error
   * @param error Error object
   * @returns Never - always throws
   */
  private handleError<T>(error: ApiError): never {
    // Handle token expiration
    if (error.statusCode === 401 || error.response?.status === 401) {
      this.setToken(null);
      
      // Publish token expired event
      const event = new CustomEvent('auth:tokenExpired');
      window.dispatchEvent(event);
    }

    // Enhance error message
    const errorMessage = 
      error.details || 
      error.response?.data?.error || 
      error.response?.data?.message || 
      error.message || 
      'An unknown error occurred';

    console.error('API Error:', {
      message: errorMessage,
      status: error.statusCode || error.response?.status,
      endpoint: error.message,
    });

    throw error;
  }
}

// Export singleton instance
export const apiService = new ApiService();
export default apiService;