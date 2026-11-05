/**
 * Node-safe entry. The browser element stays on the package root.
 * Hosts that grade an exam import this and run the same operations as the editor.
 */
export { parseAction, type ParsedAction } from "./commands/parse-action";
export type { Operation } from "./commands/operation";
export { runOperation, type EngineRequest, type EngineResult } from "./engine/run";
