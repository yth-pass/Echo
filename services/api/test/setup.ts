/**
 * Global setup for API integration tests.
 *
 * Sets environment variables so tests can run without a real database
 * or external services. Individual test files may override these mocks.
 */

// Force test environment
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-integration';
process.env.JWT_ACCESS_TTL = '15m';
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/echo_test';
process.env.REDIS_URL = 'redis://localhost:6379/15';

// Silence console during tests (uncomment to debug)
// jest.spyOn(console, 'log').mockImplementation(() => {});
jest.spyOn(console, 'warn').mockImplementation(() => {});
