import axios from 'axios';
import { clearSession, getRefreshToken, setRefreshToken, removeRefreshToken } from './sessionManager';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true, // Enable sending cookies with all requests
});

// Add response interceptor to handle authentication errors
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // If the error is 401 (Unauthorized) and we haven't already tried to refresh
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        // Only try to refresh if we have a refresh token
        const currentRefreshToken = getRefreshToken();
        if (currentRefreshToken) {
          // Attempt to refresh the token
          const response = await axios.post(`${API_BASE_URL}/auth/refresh-token`, {
            refreshToken: currentRefreshToken
          });

          // Get the new tokens
          const { accessToken, refreshToken: newRefreshToken, expiresIn } = response.data.tokens;

          // Update the refresh token in localStorage
          setRefreshToken(newRefreshToken);

          // Update the Authorization header for all subsequent requests
          api.defaults.headers.common['Authorization'] = `Bearer ${accessToken}`;

          // Update the Authorization header for the original request
          originalRequest.headers.Authorization = `Bearer ${accessToken}`;

          // Retry the original request with the new token
          return api(originalRequest);
        }
      } catch (refreshError) {
        // If refresh fails, clear the session and redirect to login
        console.error('Token refresh failed:', refreshError);
        removeRefreshToken();
        clearSession(); // This will also clear other session data

        // Only redirect if we're in a browser environment
        if (typeof window !== 'undefined') {
          window.location.href = '/login';
        }

        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

export const authApi = {
  login: async (email: string, password: string) => {
    const response = await api.post('/auth/login', { email, password });

    // Store the refresh token using sessionManager
    if (response.data.tokens?.refreshToken && response.data.tokens?.expiresIn) {
      setRefreshToken(response.data.tokens.refreshToken);

      // Set the Authorization header for future requests
      api.defaults.headers.common['Authorization'] = `Bearer ${response.data.tokens.accessToken}`;
      return { ...response.data, expiresIn: response.data.tokens.expiresIn };
    }
    return response.data;
  },

  signup: async (email: string, password: string) => {
    const response = await api.post('/auth/signup', { email, password });

    // Store the refresh token using sessionManager
    if (response.data.tokens?.refreshToken && response.data.tokens?.expiresIn) {
      setRefreshToken(response.data.tokens.refreshToken);

      // Set the Authorization header for future requests
      api.defaults.headers.common['Authorization'] = `Bearer ${response.data.tokens.accessToken}`;
      return { ...response.data, expiresIn: response.data.tokens.expiresIn };
    }
    return response.data;
  },

  logout: async () => {
    try {
      // Only attempt to invalidate the refresh token if we have one
      const currentRefreshToken = getRefreshToken();
      if (currentRefreshToken) {
        await api.post('/auth/logout', { refreshToken: currentRefreshToken }, {
          headers: {
            'Content-Type': 'application/json'
          }
        });
      }
    } finally {
      // Clear all session data, including refresh token and auth header
      clearSession(); // This now handles removing the refresh token
      delete api.defaults.headers.common['Authorization'];
    }
  },

  getCurrentUser: async () => {
    const response = await api.get('/users/me');
    return response.data;
  },

  refreshToken: async () => {
    const currentRefreshToken = getRefreshToken();
    if (!currentRefreshToken) {
      throw new Error('No refresh token available');
    }
 
    const response = await api.post('/auth/refresh-token', { refreshToken: currentRefreshToken });

    // Update the refresh token and auth header using sessionManager
    if (response.data.tokens?.refreshToken && response.data.tokens?.expiresIn) {
      setRefreshToken(response.data.tokens.refreshToken);
      api.defaults.headers.common['Authorization'] = `Bearer ${response.data.tokens.accessToken}`;
      return { ...response.data, expiresIn: response.data.tokens.expiresIn };
    }
    return response.data;
  }
};

// Backend API response types
interface BackendUserAirdrop {
  userId: string;
  airdropId: string;
  status: string; // "eligible", "claimed", "missed"
  claimedAt: string | null;
  airdrop: {
    id: string;
    title: string;
    description: string | null;
    criteria: string;
    deadline: string;
  };
}

interface BackendAirdropsResponse {
  airdrops: BackendUserAirdrop[];
}

// Transform backend airdrop data to frontend format
const transformAirdropData = (userAirdrop: BackendUserAirdrop) => {
  const { airdrop, status, claimedAt } = userAirdrop;
  const deadline = new Date(airdrop.deadline);
  const now = new Date();

  // Determine frontend status based on backend status and deadline
  let frontendStatus: 'upcoming' | 'active' | 'completed' | 'missed';
  if (status === 'claimed') {
    frontendStatus = 'completed';
  } else if (status === 'missed') {
    frontendStatus = 'missed';
  } else if (deadline > now) {
    frontendStatus = 'upcoming';
  } else {
    frontendStatus = 'active';
  }

  // Extract symbol from title (assuming format like "Jupiter (JUP)" or fallback to first 3 chars)
  const symbolMatch = airdrop.title.match(/\(([^)]+)\)/);
  const symbol = symbolMatch ? symbolMatch[1] : airdrop.title.substring(0, 3).toUpperCase();

  return {
    id: airdrop.id,
    name: airdrop.title,
    symbol: symbol,
    logo: getCryptoLogoUrl(symbol),
    status: frontendStatus,
    eligibility: status === 'eligible' || status === 'claimed',
    deadline: airdrop.deadline,
    estimatedValue: 100, // Default value since backend doesn't provide this
    description: airdrop.description || 'No description available'
  };
};

export const airdropApi = {
  // Get all airdrops for the authenticated user
  getAirdrops: async (filters?: { status?: string; upcoming?: boolean; completed?: boolean }) => {
    const params = new URLSearchParams();
    if (filters?.status) params.append('status', filters.status);
    if (filters?.upcoming) params.append('upcoming', 'true');
    if (filters?.completed) params.append('completed', 'true');

    const response = await api.get<BackendAirdropsResponse>(`/airdrops?${params.toString()}`);
    return response.data.airdrops.map(transformAirdropData);
  },

  // Get a specific airdrop by ID
  getAirdrop: async (id: string) => {
    const response = await api.get<{ airdrop: BackendUserAirdrop }>(`/airdrops/${id}`);
    return transformAirdropData(response.data.airdrop);
  },

  // Toggle claim status for an airdrop
  toggleClaim: async (id: string) => {
    const response = await api.post<{ airdrop: BackendUserAirdrop }>(`/airdrops/${id}/claim`);
    return transformAirdropData(response.data.airdrop);
  }
};

// Portfolio API types
interface PortfolioSummary {
  totalValue: number;
  totalCostBasis: number;
  totalUnrealizedPnL: number;
  totalRealizedPnL: number;
  totalPercentageChange: number;
  holdingsCount: number;
}

interface PortfolioHolding {
  id: string;
  tokenSymbol: string;
  tokenName: string;
  currentAmount: number;
  averageCostBasis: number | null;
  totalCostBasis: number | null;
  currentPrice: number | null;
  currentValue: number | null;
  unrealizedPnL: number | null;
  realizedPnL: number | null;
  percentageChange: number | null;
  lastPriceUpdate: string | null;
}

interface PortfolioResponse {
  summary: PortfolioSummary;
  holdings: PortfolioHolding[];
}

// Alert API types
interface Alert {
  id: string;
  userId: string;
  type: string;
  condition: string;
  threshold: number | null;
  tokenSymbol: string | null;
  airdropId: string | null;
  active: boolean;
  lastTriggered: string | null;
  createdAt: string;
  updatedAt: string;
}

interface AlertsResponse {
  alerts: Alert[];
}

export const portfolioApi = {
  // Get portfolio summary and holdings
  getPortfolio: async (): Promise<PortfolioResponse> => {
    const response = await api.get<PortfolioResponse>('/portfolio');
    return response.data;
  },

  // Get portfolio summary only
  getSummary: async (): Promise<{ summary: PortfolioSummary }> => {
    const response = await api.get<{ summary: PortfolioSummary }>('/portfolio/summary');
    return response.data;
  },

  // Get holdings only
  getHoldings: async (): Promise<{ holdings: PortfolioHolding[] }> => {
    const response = await api.get<{ holdings: PortfolioHolding[] }>('/portfolio/holdings');
    return response.data;
  },

  // Refresh portfolio prices
  refreshPrices: async () => {
    const response = await api.post('/portfolio/refresh-prices');
    return response.data;
  }
};

export const alertsApi = {
  // Get all alerts for the authenticated user
  getAlerts: async (): Promise<AlertsResponse> => {
    const response = await api.get<AlertsResponse>('/alerts');
    return response.data;
  },

  // Create a new alert
  createAlert: async (alertData: {
    type: string;
    condition: string;
    threshold?: number;
    tokenSymbol?: string;
    airdropId?: string;
  }) => {
    const response = await api.post('/alerts', alertData);
    return response.data;
  },

  // Update an alert
  updateAlert: async (id: string, alertData: Partial<Alert>) => {
    const response = await api.put(`/alerts/${id}`, alertData);
    return response.data;
  },

  // Delete an alert
  deleteAlert: async (id: string) => {
    const response = await api.delete(`/alerts/${id}`);
    return response.data;
  }
};

export const getCryptoLogoUrl = (symbol: string) => {
  // This is a placeholder. In a real application, you would use a reliable
  // crypto logo API that supports CORS, e.g., CoinGecko, CoinMarketCap, etc.
  // Example: `https://assets.coingecko.com/coins/images/ID/large/${symbol.toLowerCase()}.png`
  // For now, we'll use a generic placeholder that assumes a pattern.
  // You might need to adjust the base URL and path based on the chosen API.
  return `https://api.cryptologos.io/v1/coins/${symbol.toLowerCase()}/logo.png`;
};
