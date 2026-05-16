/**
 * In-process bounded job queue.
 *
 * Goals:
 *   - Move slow side-effects (FCM fan-out, bulk DB writes for parent
 *     notifications) OFF the GPS hot path.
 *   - Cap concurrency so a burst of arrivals can never starve the event
 *     loop or saturate the PG pool.
 *   - Keep a single dependency-free implementation that works in dev,
 *     while making it trivial to swap in BullMQ + Redis for true horizontal
 *     scale (multiple API workers, retries, dead-letter queues).
 *
 * To switch to BullMQ:
 *   - npm i bullmq ioredis
 *   - replace `enqueue` with `queue.add(name, data)`
 *   - move job handlers into a separate worker process
 *   - the call sites stay identical.
 */
import { logger } from '../utils/logger.js';

const MAX_CONCURRENCY = Number(process.env.JOB_QUEUE_CONCURRENCY || 16);
const MAX_QUEUED = Number(process.env.JOB_QUEUE_MAX || 5000);

const queue = [];
let inFlight = 0;
let dropped = 0;

const drain = () => {
  while (inFlight < MAX_CONCURRENCY && queue.length > 0) {
    const job = queue.shift();
    inFlight += 1;
    Promise.resolve()
      .then(() => job.run())
      .catch((err) => logger.error(`job.${job.name} failed`, { err: err.message }))
      .finally(() => {
        inFlight -= 1;
        if (queue.length > 0) drain();
      });
  }
};

/**
 * Schedule a job. Returns immediately (fire-and-forget). The caller MUST
 * NOT await this — that would defeat the whole purpose.
 */
export const enqueue = (name, run) => {
  if (queue.length >= MAX_QUEUED) {
    dropped += 1;
    if (dropped % 100 === 1) {
      logger.warn('jobQueue: queue full, dropping job', {
        name, queued: queue.length, dropped,
      });
    }
    return;
  }
  queue.push({ name, run });
  drain();
};

export const queueStats = () => ({
  queued: queue.length,
  inFlight,
  dropped,
  maxConcurrency: MAX_CONCURRENCY,
});