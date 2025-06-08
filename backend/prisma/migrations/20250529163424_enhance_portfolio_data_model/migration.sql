/*
  Warnings:

  - You are about to drop the column `amount` on the `PortfolioHolding` table. All the data in the column will be lost.
  - You are about to drop the column `price` on the `Transaction` table. All the data in the column will be lost.
  - Added the required column `currentAmount` to the `PortfolioHolding` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `Transaction` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_PortfolioHolding" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "tokenSymbol" TEXT NOT NULL,
    "tokenName" TEXT NOT NULL,
    "currentAmount" REAL NOT NULL,
    "averageCostBasis" REAL,
    "totalCostBasis" REAL,
    "currentPrice" REAL,
    "currentValue" REAL,
    "unrealizedPnL" REAL,
    "realizedPnL" REAL,
    "percentageChange" REAL,
    "lastPriceUpdate" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PortfolioHolding_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_PortfolioHolding" ("createdAt", "id", "tokenName", "tokenSymbol", "updatedAt", "userId", "currentAmount") SELECT "createdAt", "id", "tokenName", "tokenSymbol", "updatedAt", "userId", "amount" FROM "PortfolioHolding";
DROP TABLE "PortfolioHolding";
ALTER TABLE "new_PortfolioHolding" RENAME TO "PortfolioHolding";
CREATE INDEX "PortfolioHolding_userId_idx" ON "PortfolioHolding"("userId");
CREATE UNIQUE INDEX "PortfolioHolding_userId_tokenSymbol_key" ON "PortfolioHolding"("userId", "tokenSymbol");
CREATE TABLE "new_Transaction" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "holdingId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "amount" REAL NOT NULL,
    "pricePerToken" REAL,
    "totalValue" REAL,
    "transactionFee" REAL,
    "feeTokenSymbol" TEXT,
    "exchangeName" TEXT,
    "transactionHash" TEXT,
    "date" DATETIME NOT NULL,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Transaction_holdingId_fkey" FOREIGN KEY ("holdingId") REFERENCES "PortfolioHolding" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Transaction" ("amount", "createdAt", "date", "holdingId", "id", "type", "updatedAt", "pricePerToken") SELECT "amount", "createdAt", "date", "holdingId", "id", "type", CURRENT_TIMESTAMP, "price" FROM "Transaction";
DROP TABLE "Transaction";
ALTER TABLE "new_Transaction" RENAME TO "Transaction";
CREATE INDEX "Transaction_holdingId_idx" ON "Transaction"("holdingId");
CREATE INDEX "Transaction_date_idx" ON "Transaction"("date");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
