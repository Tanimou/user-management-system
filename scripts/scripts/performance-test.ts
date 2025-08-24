import { PrismaClient } from '@prisma/client';
import { performance } from 'perf_hooks';

const prisma = new PrismaClient();

interface PerformanceResult {
  operation: string;
  duration: number;
  benchmark: number;
  status: 'PASS' | 'FAIL';
}

async function measureOperation<T>(
  operation: string,
  benchmark: number,
  fn: () => Promise<T>
): Promise<PerformanceResult> {
  const start = performance.now();
  await fn();
  const end = performance.now();
  const duration = end - start;
  
  return {
    operation,
    duration: Math.round(duration),
    benchmark,
    status: duration <= benchmark ? 'PASS' : 'FAIL'
  };
}

async function runPerformanceTests() {
  console.log('🚀 Database Performance Benchmark Tests');
  console.log('========================================');
  console.log('');

  const results: PerformanceResult[] = [];

  try {
    // Setup test data
    console.log('📋 Setting up test data...');
    
    // Clean existing test data
    await prisma.auditLog.deleteMany({ where: { entity: 'TestUser' } });
    await prisma.user.deleteMany({ where: { email: { contains: 'perftest' } } });

    // Create test users
    const testUsers = [];
    for (let i = 0; i < 100; i++) {
      testUsers.push({
        name: `Performance Test User ${i}`,
        email: `perftest${i}@example.com`,
        password: 'hashedpassword123',
        roles: i % 10 === 0 ? ['user', 'admin'] : ['user'],
        isActive: i % 20 !== 0, // Some inactive users
      });
    }

    const createdUsers = await prisma.user.createMany({
      data: testUsers,
      skipDuplicates: true,
    });

    console.log(`✅ Created ${createdUsers.count} test users`);
    console.log('');

    // Performance Tests
    console.log('🔍 Running performance benchmarks...');
    console.log('');

    // Test 1: User lookup by email (< 10ms)
    const result1 = await measureOperation(
      'User lookup by email',
      10,
      async () => {
        await prisma.user.findUnique({
          where: { email: 'perftest50@example.com' }
        });
      }
    );
    results.push(result1);

    // Test 2: User list with pagination (< 50ms)
    const result2 = await measureOperation(
      'User list with pagination',
      50,
      async () => {
        await prisma.user.findMany({
          take: 10,
          skip: 0,
          orderBy: { createdAt: 'desc' },
        });
      }
    );
    results.push(result2);

    // Test 3: User creation (< 100ms)
    const result3 = await measureOperation(
      'User creation',
      100,
      async () => {
        await prisma.user.create({
          data: {
            name: 'New Performance Test User',
            email: 'newperftest@example.com',
            password: 'hashedpassword123',
            roles: ['user'],
          },
        });
      }
    );
    results.push(result3);

    // Test 4: Complex search queries (< 200ms)
    const result4 = await measureOperation(
      'Complex search queries',
      200,
      async () => {
        await prisma.user.findMany({
          where: {
            AND: [
              { isActive: true },
              {
                OR: [
                  { name: { contains: 'Test', mode: 'insensitive' } },
                  { email: { contains: 'perftest', mode: 'insensitive' } },
                ],
              },
              { roles: { has: 'user' } },
            ],
          },
          orderBy: { createdAt: 'desc' },
          take: 20,
        });
      }
    );
    results.push(result4);

    // Test 5: Active user filtering (< 30ms)
    const result5 = await measureOperation(
      'Active user filtering',
      30,
      async () => {
        await prisma.user.count({
          where: { isActive: true }
        });
      }
    );
    results.push(result5);

    // Test 6: Audit log creation (< 50ms)
    const user = await prisma.user.findFirst({ where: { email: 'perftest0@example.com' } });
    if (user) {
      const result6 = await measureOperation(
        'Audit log creation',
        50,
        async () => {
          await prisma.auditLog.create({
            data: {
              actorId: user.id,
              action: 'PERFORMANCE_TEST',
              entity: 'TestUser',
              entityId: user.id,
              payload: {
                test: 'performance measurement',
                timestamp: new Date().toISOString(),
              },
            },
          });
        }
      );
      results.push(result6);
    }

    // Display results
    console.log('📊 Performance Test Results:');
    console.log('============================');
    console.log('');
    
    const tableHeader = '| Operation                | Duration | Benchmark | Status |';
    const tableSeparator = '|--------------------------|----------|-----------|--------|';
    
    console.log(tableHeader);
    console.log(tableSeparator);
    
    results.forEach(result => {
      const operationPadded = result.operation.padEnd(24);
      const durationPadded = `${result.duration}ms`.padEnd(8);
      const benchmarkPadded = `${result.benchmark}ms`.padEnd(9);
      const status = result.status === 'PASS' ? '✅ PASS' : '❌ FAIL';
      
      console.log(`| ${operationPadded} | ${durationPadded} | ${benchmarkPadded} | ${status}  |`);
    });

    console.log('');

    // Summary
    const totalTests = results.length;
    const passedTests = results.filter(r => r.status === 'PASS').length;
    const failedTests = totalTests - passedTests;

    console.log(`📈 Summary: ${passedTests}/${totalTests} tests passed`);
    
    if (failedTests > 0) {
      console.log('⚠️  Some performance benchmarks failed. Consider:');
      console.log('   - Adding more specific database indexes');
      console.log('   - Optimizing query patterns');
      console.log('   - Checking database connection settings');
      console.log('   - Running tests on production-like environment');
    } else {
      console.log('🎉 All performance benchmarks passed!');
    }

    // Cleanup
    console.log('');
    console.log('🧹 Cleaning up test data...');
    await prisma.auditLog.deleteMany({ where: { entity: 'TestUser' } });
    await prisma.user.deleteMany({ where: { email: { contains: 'perftest' } } });
    await prisma.user.deleteMany({ where: { email: 'newperftest@example.com' } });
    console.log('✅ Cleanup completed');

  } catch (error) {
    console.error('❌ Performance test failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the performance tests
runPerformanceTests().catch(console.error);