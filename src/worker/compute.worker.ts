/// <reference lib="webworker" />
import type { Operation } from "../commands/operation";
import { runOperation, type EngineResult } from "../engine/run";

export interface RunMessage {
  type: "run";
  id: string;
  revision: number;
  latex: string;
  operation: Operation;
  timeoutMs: number;
}

export interface AbortMessage {
  type: "abort";
  id: string;
}

export interface ResultMessage {
  type: "result";
  id: string;
  revision: number;
  result: EngineResult;
}

const controllers = new Map<string, AbortController>();

self.addEventListener("message", (event: MessageEvent<RunMessage | AbortMessage>) => {
  const message = event.data;
  if (message.type === "abort") {
    controllers.get(message.id)?.abort();
    return;
  }
  const controller = new AbortController();
  controllers.set(message.id, controller);
  void runOperation({
    latex: message.latex,
    operation: message.operation,
    timeoutMs: message.timeoutMs,
    signal: controller.signal,
  })
    .then((result) => {
      controllers.delete(message.id);
      const response: ResultMessage = {
        type: "result",
        id: message.id,
        revision: message.revision,
        result,
      };
      self.postMessage(response);
    })
    .catch(() => {
      controllers.delete(message.id);
      const response: ResultMessage = {
        type: "result",
        id: message.id,
        revision: message.revision,
        result: {
          status: "invalid",
          message: "The calculation stopped because of an engine error.",
        },
      };
      self.postMessage(response);
    });
});
