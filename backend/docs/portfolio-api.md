# Portfolio Management API Documentation

## Overview
The Portfolio Management API provides comprehensive CRUD operations for managing cryptocurrency portfolio holdings and transactions. All endpoints require authentication via JWT token.

## Authentication
All endpoints require a valid JWT token in the Authorization header:
```
Authorization: Bearer <your-jwt-token>
```

## Base URL
```
/api/portfolio
```

## Endpoints

### Portfolio Summary

#### GET `/`
Get complete portfolio overview with summary and holdings.

**Response:**
```json
{
  "summary": {
    "totalValue": 15000.50,
    "totalCostBasis": 12000.00,
    "totalUnrealizedPnL": 3000.50,
    "totalRealizedPnL": 500.00,
    "totalPercentageChange": 25.0,
    "holdingsCount": 3
  },
  "holdings": [...]
}
```

#### GET `/summary`
Get portfolio summary only.

### Holdings Management

#### GET `/holdings`
Get all holdings for the authenticated user.

**Response:**
```json
{
  "holdings": [
    {
      "id": "uuid",
      "tokenSymbol": "BTC",
      "tokenName": "Bitcoin",
      "currentAmount": 0.5,
      "averageCostBasis": 45000.00,
      "totalCostBasis": 22500.00,
      "currentPrice": 50000.00,
      "currentValue": 25000.00,
      "unrealizedPnL": 2500.00,
      "percentageChange": 11.11,
      "lastPriceUpdate": "2024-01-15T10:30:00Z"
    }
  ]
}
```

#### GET `/holdings/:id`
Get specific holding with transaction history.

**Response:**
```json
{
  "holding": {
    "id": "uuid",
    "tokenSymbol": "BTC",
    "tokenName": "Bitcoin",
    "currentAmount": 0.5,
    "transactions": [...]
  }
}
```

#### POST `/holdings`
Create a new holding.

**Request Body:**
```json
{
  "tokenSymbol": "BTC",
  "tokenName": "Bitcoin",
  "currentAmount": 0.5
}
```

**Validation:**
- `tokenSymbol`: Required, 1-10 characters
- `tokenName`: Required, 1-100 characters
- `currentAmount`: Required, number >= 0

#### PUT `/holdings/:id`
Update holding amount (manual adjustment).

**Request Body:**
```json
{
  "currentAmount": 0.75
}
```

#### DELETE `/holdings/:id`
Delete holding and all associated transactions.

### Transaction Management

#### GET `/transactions`
Get all transactions for the authenticated user.

**Response:**
```json
{
  "transactions": [
    {
      "id": "uuid",
      "type": "BUY",
      "amount": 0.5,
      "pricePerToken": 45000.00,
      "totalValue": 22500.00,
      "transactionFee": 25.00,
      "date": "2024-01-15T10:00:00Z",
      "holding": {
        "tokenSymbol": "BTC",
        "tokenName": "Bitcoin"
      }
    }
  ]
}
```

#### GET `/transactions/:id`
Get specific transaction.

#### GET `/holdings/:id/transactions`
Get all transactions for a specific holding.

#### POST `/transactions`
Add a new transaction.

**Request Body:**
```json
{
  "holdingId": "uuid",
  "type": "BUY",
  "amount": 0.5,
  "pricePerToken": 45000.00,
  "totalValue": 22500.00,
  "transactionFee": 25.00,
  "feeTokenSymbol": "ETH",
  "exchangeName": "Coinbase",
  "transactionHash": "0x123...",
  "date": "2024-01-15T10:00:00Z",
  "notes": "Initial purchase"
}
```

**Transaction Types:**
- `BUY`: Purchase transaction
- `SELL`: Sale transaction
- `TRANSFER_IN`: Incoming transfer
- `TRANSFER_OUT`: Outgoing transfer
- `STAKE`: Staking transaction
- `UNSTAKE`: Unstaking transaction
- `REWARD`: Staking/mining reward
- `AIRDROP`: Airdrop received

**Validation:**
- `holdingId`: Required, valid UUID
- `type`: Required, valid transaction type
- `amount`: Required, number >= 0
- `date`: Required, valid ISO date string

#### DELETE `/transactions/:id`
Delete a transaction and recalculate holding metrics.

### Utility Endpoints

#### POST `/refresh-prices`
Manually refresh current prices for all holdings with detailed statistics.

**Response:**
```json
{
  "message": "Portfolio prices updated successfully",
  "stats": {
    "updated": 5,
    "failed": 0,
    "errors": []
  }
}
```

#### POST `/transactions/with-price-lookup`
Create transaction with automatic historical price lookup if price not provided.

**Request Body:**
```json
{
  "holdingId": "uuid",
  "type": "BUY",
  "amount": 0.5,
  "date": "2024-01-15T10:00:00Z",
  "notes": "Purchase without known price"
}
```

**Response:**
```json
{
  "success": true,
  "historicalPrice": 45000.00,
  "message": "Transaction added with historical price: $45000.00"
}
```

#### GET `/analytics`
Get comprehensive portfolio analytics and performance metrics.

**Response:**
```json
{
  "analytics": {
    "summary": { /* Portfolio summary */ },
    "topPerformers": [
      {
        "symbol": "BTC",
        "percentageChange": 25.5,
        "value": 12500.00
      }
    ],
    "worstPerformers": [
      {
        "symbol": "DOGE",
        "percentageChange": -15.2,
        "value": 850.00
      }
    ],
    "allocationByValue": [
      {
        "symbol": "BTC",
        "percentage": 65.5,
        "value": 32750.00
      }
    ],
    "recentActivity": [
      {
        "type": "BUY",
        "symbol": "ETH",
        "amount": 2.0,
        "date": "2024-01-15T10:00:00Z"
      }
    ]
  }
}
```

#### GET `/price-alerts`
Get price alerts for significant changes in user's holdings.

**Query Parameters:**
- `threshold` (optional): Percentage threshold for significant changes (default: 5)

**Response:**
```json
{
  "alerts": [
    {
      "symbol": "BTC",
      "currentPrice": 52000.00,
      "change24h": 8.5,
      "isSignificantChange": true,
      "alertType": "gain"
    }
  ],
  "threshold": 5,
  "totalAlerts": 3,
  "significantChanges": 1
}
```

### Admin Endpoints

#### POST `/admin/bulk-update-prices`
Bulk update prices for all users (admin only).

**Response:**
```json
{
  "message": "Bulk price update completed",
  "stats": {
    "usersProcessed": 150,
    "totalHoldingsUpdated": 450,
    "totalErrors": 2,
    "processingTime": 15000
  }
}
```

#### GET `/admin/cache-stats`
Get cache performance statistics (admin only).

**Response:**
```json
{
  "cacheStats": {
    "priceCache": {
      "keys": 25,
      "hits": 150,
      "misses": 30
    },
    "coinListCache": {
      "keys": 1,
      "hits": 45,
      "misses": 1
    },
    "airdropCache": {
      "keys": 1,
      "hits": 20,
      "misses": 3
    }
  }
}
```

#### POST `/admin/clear-caches`
Clear all price caches (admin only).

**Response:**
```json
{
  "message": "All price caches cleared successfully"
}
```

## Error Responses

### 400 Bad Request
```json
{
  "error": "Validation error message"
}
```

### 401 Unauthorized
```json
{
  "error": "Authentication required"
}
```

### 404 Not Found
```json
{
  "error": "Resource not found"
}
```

### 500 Internal Server Error
```json
{
  "error": "Internal server error message"
}
```

## Data Models

### PortfolioHolding
- `id`: Unique identifier
- `userId`: Owner user ID
- `tokenSymbol`: Token symbol (e.g., "BTC")
- `tokenName`: Full token name
- `currentAmount`: Current holdings amount
- `averageCostBasis`: Average cost per token
- `totalCostBasis`: Total invested amount
- `currentPrice`: Current market price
- `currentValue`: Current total value
- `unrealizedPnL`: Unrealized profit/loss
- `realizedPnL`: Realized profit/loss
- `percentageChange`: Performance percentage
- `lastPriceUpdate`: Last price update timestamp

### Transaction
- `id`: Unique identifier
- `holdingId`: Associated holding ID
- `type`: Transaction type enum
- `amount`: Transaction amount
- `pricePerToken`: Price per token at transaction time
- `totalValue`: Total transaction value
- `transactionFee`: Transaction fee
- `feeTokenSymbol`: Fee token symbol
- `exchangeName`: Exchange name
- `transactionHash`: Blockchain transaction hash
- `date`: Transaction date
- `notes`: Additional notes

## Features

### Automatic Calculations
- Cost basis tracking with FIFO method
- Realized P&L calculation on sales
- Unrealized P&L based on current prices
- Performance percentage calculations

### Enhanced Price Integration
- **Multi-layered Caching**: Separate caches for prices, coin lists, and airdrops with configurable TTL
- **Rate Limiting**: Built-in API rate limiting to respect CoinGecko free tier limits
- **Symbol Resolution**: Automatic mapping from token symbols to CoinGecko IDs with fallback lookup
- **Batch Processing**: Efficient batch price updates with retry logic and exponential backoff
- **Historical Prices**: Automatic historical price lookup for transactions without price data
- **Price Alerts**: Configurable alerts for significant price changes
- **Enhanced Data**: 24h volume, market cap, and last update timestamps

### Real-time Price Integration
- **CoinGecko API Integration**: Comprehensive integration with enhanced data fields
- **Automatic Updates**: Smart price updates with detailed statistics and error tracking
- **Manual Refresh**: Enhanced manual refresh with detailed success/failure reporting
- **Fallback Handling**: Graceful degradation when price data is unavailable

### Performance & Reliability
- **Retry Logic**: Exponential backoff for failed API requests
- **Error Handling**: Comprehensive error tracking and reporting
- **Cache Management**: Advanced cache statistics and manual cache clearing
- **Bulk Operations**: Efficient bulk price updates for all users

### Data Integrity
- **User Isolation**: Users can only access their own data with proper authorization
- **Transaction Safety**: Database transactions for consistency across operations
- **Automatic Recalculation**: Smart metric recalculation after data changes
- **Comprehensive Validation**: Input validation with detailed error messages
- **Audit Trail**: Detailed logging and error tracking for debugging
