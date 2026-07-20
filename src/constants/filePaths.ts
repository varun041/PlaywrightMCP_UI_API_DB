import path from 'path';

const REPO_ROOT = path.resolve(__dirname, '..', '..');

export const FilePaths = {
  REPO_ROOT,
  TESTDATA_DIR: path.join(REPO_ROOT, 'testdata'),
  /** The never-mutated source seed DB (tests/DB/banking.db — 151 customers / 452 accounts / 150 transactions). */
  SEED_DB_PATH: path.join(REPO_ROOT, 'tests', 'DB', 'banking.db'),
  /** Per-run working copy directory; global-setup copies SEED_DB_PATH here and points the backend's DB_PATH at it. */
  RUNTIME_DB_DIR: path.join(REPO_ROOT, 'tests', 'DB', '.runtime'),
  BACKEND_DIR: path.join(REPO_ROOT, 'banking-app', 'backend'),
  BACKEND_ENTRY: path.join(REPO_ROOT, 'banking-app', 'backend', 'server.js'),
  FRONTEND_DIR: path.join(REPO_ROOT, 'banking-app', 'frontend'),
} as const;
