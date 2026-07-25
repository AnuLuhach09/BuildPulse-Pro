import { PrismaClient, Role } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

/**
 * Database Seed Script
 *
 * Creates:
 * - 1 Admin user (admin@buildpulse.io / Admin@123456)
 * - 1 Developer user (dev@buildpulse.io / Dev@123456)
 * - Sample repositories and pipeline runs for UI testing
 *
 * Run: npm run db:seed
 */
async function main() {
  console.log('🌱 Seeding database...');

  // ── Admin User ─────────────────────────────────────────────────────────────
  const adminPassword = await bcrypt.hash('Admin@123456', 12);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@buildpulse.io' },
    update: {},
    create: {
      email: 'admin@buildpulse.io',
      name: 'Admin User',
      role: Role.ADMIN,
      passwordHash: adminPassword,
      notifications: {
        create: { emailEnabled: true, onFailure: true, onSuccess: true },
      },
    },
  });
  console.log(`✅ Admin: ${admin.email}`);

  // ── Developer User ─────────────────────────────────────────────────────────
  const devPassword = await bcrypt.hash('Dev@123456', 12);
  const dev = await prisma.user.upsert({
    where: { email: 'dev@buildpulse.io' },
    update: {},
    create: {
      email: 'dev@buildpulse.io',
      name: 'Jane Developer',
      role: Role.DEVELOPER,
      passwordHash: devPassword,
      avatarUrl: 'https://avatars.githubusercontent.com/u/1?v=4',
      notifications: {
        create: { emailEnabled: true, onFailure: true },
      },
    },
  });
  console.log(`✅ Developer: ${dev.email}`);

  // ── Sample Repository ──────────────────────────────────────────────────────
  const repo = await prisma.repository.upsert({
    where: { fullName: 'buildpulse-demo/api-service' },
    update: {},
    create: {
      githubId: 999001,
      name: 'api-service',
      fullName: 'buildpulse-demo/api-service',
      description: 'Sample API service for BuildPulse demo',
      url: 'https://github.com/buildpulse-demo/api-service',
      defaultBranch: 'main',
      isPrivate: false,
      webhookSecret: 'demo-webhook-secret',
      healthScore: 82.5,
      language: 'TypeScript',
      members: {
        create: [
          { userId: admin.id, role: 'OWNER' },
          { userId: dev.id, role: 'DEVELOPER' },
        ],
      },
    },
  });
  console.log(`✅ Repository: ${repo.fullName}`);

  console.log('✅ Seed complete!');
  console.log('\n🔑 Login credentials:');
  console.log('   Admin:     admin@buildpulse.io / Admin@123456');
  console.log('   Developer: dev@buildpulse.io   / Dev@123456');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
