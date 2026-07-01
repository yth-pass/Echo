import * as path from 'path';

/**
 * Resolve the shared memory base directory used by both API and Worker.
 *
 * Priority:
 *  1. ECHO_MEMORY_BASE_DIR env var (absolute or relative to cwd)
 *  2. Default: traverse up from services/{api,worker} to repo-root tmp/memory
 */
export function getMemoryBaseDir(): string {
  const envDir = process.env.ECHO_MEMORY_BASE_DIR?.trim();
  if (envDir) {
    return path.isAbsolute(envDir) ? envDir : path.resolve(process.cwd(), envDir);
  }
  // Both API (services/api) and Worker (services/worker) run from their
  // package roots, so ../../tmp/memory resolves to the shared repo-level dir.
  return path.resolve(process.cwd(), '..', '..', 'tmp', 'memory');
}
