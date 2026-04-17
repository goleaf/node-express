import path from 'node:path';
import { tmpdir } from 'node:os';

process.env.NODE_ENV = 'test';
process.env.DATABASE_PATH = path.join(tmpdir(), 'node-express-jest.sqlite');
