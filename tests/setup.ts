// Set test DB to in-memory before any imports
process.env.DB_PATH = ':memory:';
process.env.NODE_ENV = 'test';
process.env.SESSION_SECRET = 'test-secret-not-for-production';
process.env.ADMIN_PASSWORD = 'test-admin-pass-123';
