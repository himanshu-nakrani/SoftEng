/**
 * Stuffing view — six password guesses against one account, from three
 * IPs. A token bucket on the IP lets the rotation through; a bucket on
 * the username does not.
 */

export type StuffPolicy = "none" | "ip" | "user";

export type StuffResult = "pending" | "try" | "ok" | "fail" | "block";

export interface StuffAttempt {
  n: number;
  user: string;
  ip: string;
  result: StuffResult;
  active: boolean;
}

export interface StuffBucket {
  key: string;
  tokens: number;
  cap: number;
}

export interface StuffingState {
  policy: StuffPolicy;
  attempts: StuffAttempt[];
  buckets: StuffBucket[];
  stamp: string;
}
