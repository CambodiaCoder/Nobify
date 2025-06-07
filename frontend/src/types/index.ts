export interface Airdrop {
  id: string;
  name: string;
  symbol: string;
  logo: string;
  status: 'upcoming' | 'active' | 'completed' | 'missed';
  eligibility: boolean;
  deadline: string;
  estimatedValue: number;
  description: string;
}

export interface Token {
  id: string;
  name: string;
  symbol: string;
  logo: string;
  amount: number;
  price: number;
  value: number;
  change24h: number;
  change7d: number;
  history: {
    timestamp: number;
    price: number;
  }[];
}

export interface Alert {
  id: string;
  type: 'price' | 'airdrop' | 'news';
  title: string;
  description: string;
  timestamp: number;
  read: boolean;
  priority: 'low' | 'medium' | 'high';
  relatedAsset?: {
    id: string;
    name: string;
    symbol: string;
  };
}

export interface User {
  id: string;
  name: string;
  email: string;
  profileImage: string;
  portfolioValue: number;
  portfolioChange24h: number;
  portfolioChange7d: number;
}