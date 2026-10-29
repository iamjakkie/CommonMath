import type { Operation } from "../commands/operation";
import type { EngineResult } from "../engine/run";

export interface ComputeJob {
  id: string;
  revision: number;
  latex: string;
  operation: Operation;
  timeoutMs: number;
}

interface PendingJob extends ComputeJob {
  resolve: (result: EngineResult) => void;
  hardTimer: ReturnType<typeof setTimeout> | null;
  graceTimer: ReturnType<typeof setTimeout> | null;
}

const HARD_GRACE_MS = 750;
const ABORT_GRACE_MS = 200;

/**
 * One worker per component. A new Compute Engine is created for every request
 * inside the worker. Killing the worker stops work that does not observe an abort.
 */
export class ComputeClient {
  private worker: Worker | null = null;
  private pending = new Map<string, PendingJob>();
  private queue: PendingJob[] = [];
  private activeId: string | null = null;
  private disposed = false;

  run(job: ComputeJob): Promise<EngineResult> {
    if (this.disposed) {
      return Promise.resolve({ status: "cancelled", message: "Cancelled." });
    }
    return new Promise((resolve) => {
      const pending: PendingJob = { ...job, resolve, hardTimer: null, graceTimer: null };
      this.queue.push(pending);
      this.pending.set(job.id, pending);
      this.pump();
    });
  }

  abort(id: string): void {
    const queuedIndex = this.queue.findIndex((job) => job.id === id);
    if (queuedIndex >= 0) {
      const [job] = this.queue.splice(queuedIndex, 1);
      if (job) this.finish(job, { status: "cancelled", message: "Cancelled." });
      return;
    }
    const active = this.pending.get(id);
    if (!active || this.activeId !== id) return;
    this.worker?.postMessage({ type: "abort", id });
    active.graceTimer = setTimeout(() => {
      if (this.pending.has(id) && this.activeId === id) {
        this.failActive(id, { status: "cancelled", message: "Cancelled." });
      }
    }, ABORT_GRACE_MS);
  }

  dispose(): void {
    this.disposed = true;
    this.failAll({ status: "cancelled", message: "Cancelled." });
    this.worker?.terminate();
    this.worker = null;
  }

  private pump(): void {
    if (this.disposed || this.activeId || this.queue.length === 0) return;
    const job = this.queue.shift();
    if (!job) return;
    this.activeId = job.id;
    this.ensureWorker();
    job.hardTimer = setTimeout(() => {
      if (this.activeId === job.id) {
        this.failActive(job.id, {
          status: "timeout",
          message: "The calculation took too long and was stopped.",
        });
      }
    }, job.timeoutMs + HARD_GRACE_MS);
    this.worker?.postMessage({
      type: "run",
      id: job.id,
      revision: job.revision,
      latex: job.latex,
      operation: job.operation,
      timeoutMs: job.timeoutMs,
    });
  }

  private ensureWorker(): void {
    if (this.worker) return;
    const worker = new Worker(new URL("./compute.worker.ts", import.meta.url), { type: "module" });
    worker.addEventListener("message", (event: MessageEvent<{ id?: string; result?: EngineResult }>) => {
      const id = event.data?.id;
      const result = event.data?.result;
      if (!id || !result) return;
      const job = this.pending.get(id);
      if (!job) return;
      this.finish(job, result);
      if (this.activeId === id) {
        this.activeId = null;
        this.pump();
      }
    });
    worker.addEventListener("error", () => {
      const id = this.activeId;
      if (!id) return;
      this.failActive(id, {
        status: "invalid",
        message: "The calculation stopped because of an engine error.",
      });
    });
    this.worker = worker;
  }

  private failActive(id: string, result: EngineResult): void {
    const job = this.pending.get(id);
    if (!job) return;
    this.worker?.terminate();
    this.worker = null;
    this.activeId = null;
    this.finish(job, result);
    this.pump();
  }

  private finish(job: PendingJob, result: EngineResult): void {
    if (job.hardTimer) clearTimeout(job.hardTimer);
    if (job.graceTimer) clearTimeout(job.graceTimer);
    this.pending.delete(job.id);
    job.resolve(result);
  }

  private failAll(result: EngineResult): void {
    const jobs = [...this.pending.values()];
    this.queue = [];
    this.activeId = null;
    for (const job of jobs) this.finish(job, result);
  }
}
