import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  // Clear existing data
  await prisma.transaction.deleteMany();
  await prisma.portfolioHolding.deleteMany();
  await prisma.userAirdrop.deleteMany();
  await prisma.alert.deleteMany();
  await prisma.airdrop.deleteMany();
  await prisma.user.deleteMany();

  console.log('Seeding database...');

  // Create users
  const passwordHash = await bcrypt.hash('password123', 10);

  const user1 = await prisma.user.create({
    data: {
      email: 'user1@example.com',
      passwordHash,
    },
  });

  const user2 = await prisma.user.create({
    data: {
      email: 'user2@example.com',
      passwordHash,
    },
  });

  console.log('Created users:', { user1, user2 });

  // Create airdrops
  const airdrop1 = await prisma.airdrop.create({
    data: {
      title: 'Jupiter (JUP)',
      description: 'Jupiter is rewarding users who have used their platform with an airdrop of JUP tokens.',
      criteria: 'Must have used Jupiter DEX aggregator before snapshot',
      deadline: new Date('2025-12-31'),
    },
  });

  const airdrop2 = await prisma.airdrop.create({
    data: {
      title: 'ZKsync (ZKS)',
      description: 'ZKsync is airdropping tokens to early users and testers of their Layer 2 scaling solution.',
      criteria: 'Must have bridged funds to ZKsync Era',
      deadline: new Date('2025-10-15'),
    },
  });

  const airdrop3 = await prisma.airdrop.create({
    data: {
      title: 'Arbitrum (ARB)',
      description: 'Arbitrum governance token airdrop for early adopters.',
      criteria: 'Must have used Arbitrum One before snapshot',
      deadline: new Date('2025-08-20'),
    },
  });

  const airdrop4 = await prisma.airdrop.create({
    data: {
      title: 'Optimism (OP)',
      description: 'Optimism governance token for early users.',
      criteria: 'Must have used Optimism network',
      deadline: new Date('2024-12-01'), // Past deadline to test "missed" status
    },
  });

  console.log('Created airdrops:', { airdrop1, airdrop2, airdrop3, airdrop4 });

  // Create user-airdrop relationships
  const userAirdrop1 = await prisma.userAirdrop.create({
    data: {
      userId: user1.id,
      airdropId: airdrop1.id,
      status: 'eligible',
    },
  });

  const userAirdrop2 = await prisma.userAirdrop.create({
    data: {
      userId: user1.id,
      airdropId: airdrop2.id,
      status: 'claimed',
      claimedAt: new Date(),
    },
  });

  const userAirdrop3 = await prisma.userAirdrop.create({
    data: {
      userId: user1.id,
      airdropId: airdrop3.id,
      status: 'eligible',
    },
  });

  const userAirdrop4 = await prisma.userAirdrop.create({
    data: {
      userId: user1.id,
      airdropId: airdrop4.id,
      status: 'missed',
    },
  });

  // Add some airdrops for user2 as well
  const userAirdrop5 = await prisma.userAirdrop.create({
    data: {
      userId: user2.id,
      airdropId: airdrop1.id,
      status: 'eligible',
    },
  });

  console.log('Created user-airdrop relationships:', {
    userAirdrop1, userAirdrop2, userAirdrop3, userAirdrop4, userAirdrop5
  });

  // Create portfolio holdings
  const holding1 = await prisma.portfolioHolding.create({
    data: {
      userId: user1.id,
      tokenSymbol: 'ETH',
      tokenName: 'Ethereum',
      currentAmount: 2.5,
    },
  });

  const holding2 = await prisma.portfolioHolding.create({
    data: {
      userId: user1.id,
      tokenSymbol: 'BTC',
      tokenName: 'Bitcoin',
      currentAmount: 0.1,
    },
  });

  const holding3 = await prisma.portfolioHolding.create({
    data: {
      userId: user2.id,
      tokenSymbol: 'SOL',
      tokenName: 'Solana',
      currentAmount: 50,
    },
  });

  console.log('Created portfolio holdings:', { holding1, holding2, holding3 });

  // Create transactions
  const transaction1 = await prisma.transaction.create({
    data: {
      holdingId: holding1.id,
      type: 'BUY',
      amount: 1.5,
      pricePerToken: 3000,
      totalValue: 4500,
      date: new Date('2025-01-15'),
    },
  });

  const transaction2 = await prisma.transaction.create({
    data: {
      holdingId: holding1.id,
      type: 'BUY',
      amount: 1.0,
      pricePerToken: 3200,
      totalValue: 3200,
      date: new Date('2025-02-20'),
    },
  });

  const transaction3 = await prisma.transaction.create({
    data: {
      holdingId: holding2.id,
      type: 'BUY',
      amount: 0.1,
      pricePerToken: 50000,
      totalValue: 5000,
      date: new Date('2025-03-10'),
    },
  });

  console.log('Created transactions:', { transaction1, transaction2, transaction3 });

  // Create alerts
  const alert1 = await prisma.alert.create({
    data: {
      userId: user1.id,
      type: 'price',
      condition: 'above',
      threshold: 4000,
      tokenSymbol: 'ETH',
      active: true,
    },
  });

  const alert2 = await prisma.alert.create({
    data: {
      userId: user2.id,
      type: 'airdrop',
      condition: 'deadline',
      airdropId: airdrop2.id,
      active: true,
    },
  });

  console.log('Created alerts:', { alert1, alert2 });

  console.log('Database seeding completed!');
}

main()
  .catch((e) => {
    console.error('Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });