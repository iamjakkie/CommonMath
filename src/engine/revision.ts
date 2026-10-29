export interface ResponseIdentity {
  id: string;
  revision: number;
}

/** A worker reply is current only when both the request id and the input revision match. */
export function responseIsCurrent(response: ResponseIdentity, current: ResponseIdentity): boolean {
  return response.id === current.id && response.revision === current.revision;
}
