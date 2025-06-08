export interface CoinGeckoPriceData {
  usd: number;
  usd_24h_change: number;
}

export interface CoinGeckoPrices {
  [key: string]: CoinGeckoPriceData;
}

export interface CoinGeckoCoin {
  id: string;
  name: string;
  symbol: string;
  thumb: string;
}

export interface AirdropData {
  id: string;
  name: string;
  symbol: string;
  thumb: string;
  description: string;
  status: string;
  value: string;
  endDate: string;
}