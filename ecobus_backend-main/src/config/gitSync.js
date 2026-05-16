/**
 * gitSync was a development shortcut that pulled new code from GitHub on
 * a 60-second interval directly on the production host. It is removed
 * because:
 *   - It is a major security risk (tokenised git URL on disk, arbitrary
 *     code execution on every poll).
 *   - It crashes production if a bad commit is pushed.
 *   - It violates standard CI/CD practice; deploys should be reproducible
 *     and atomic.
 *
 * Use a real pipeline instead (GitHub Actions → registry → container
 * deploy, or `git pull` triggered by a webhook with code review gates).
 *
 * The exports below are intentional no-ops so any leftover imports don't
 * crash the server while you migrate.
 */
import { logger } from '../utils/logger.js';

export const gitSyncConfig = { enabled: false, removed: true };

export const startGitSync = () => {
  if (process.env.GIT_SYNC_ENABLED === 'true') {
    logger.warn(
      'git-sync is permanently disabled — set up a real CI/CD pipeline. '
      + 'GIT_SYNC_ENABLED is being ignored.',
    );
  }
  return { stop: () => {} };
};