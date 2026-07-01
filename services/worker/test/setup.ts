/**
 * Global setup for Worker integration tests (REQ-09).
 */

process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/echo_test';
process.env.REDIS_URL = 'redis://localhost:6379/15';
// Prevents real LLM / FCM calls during tests
process.env.DEEPSEEK_API_KEY = '';

jest.spyOn(console, 'warn').mockImplementation(() => {});
