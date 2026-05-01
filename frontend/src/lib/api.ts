import type { Occupancy } from "./types";

const RAW_BASE = import.meta.env.VITE_API_BASE_URL ?? "http://127.0.0.1:8000";
export const API_BASE_URL = RAW_BASE.replace(/\/$/, "");

export class ApiError extends Error {
  readonly kind: "network" | "http" | "missing_seed";
  readonly status?: number;

  constructor(
    message: string,
    kind: "network" | "http" | "missing_seed",
    status?: number,
  ) {
    super(message);
    this.name = "ApiError";
    this.kind = kind;
    this.status = status;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const url = `${API_BASE_URL}${path}`;

  let response: Response;
  try {
    response = await fetch(url, init);
  } catch {
    throw new ApiError(
      `Could not reach the SwiftPark backend at ${API_BASE_URL}.`,
      "network",
    );
  }

  if (!response.ok) {
    let detail = `${response.status} ${response.statusText}`;
    try {
      const body = await response.json();
      if (body && typeof body.detail === "string") {
        detail = body.detail;
      }
    } catch {
      // Ignore non-JSON error bodies.
    }

    const isMissingSeed =
      response.status === 404 && /seed/i.test(detail);

    throw new ApiError(
      detail,
      isMissingSeed ? "missing_seed" : "http",
      response.status,
    );
  }

  return response.json() as Promise<T>;
}

export function fetchOccupancy(): Promise<Occupancy> {
  return request<Occupancy>("/demo/occupancy");
}

export function simulateDetection(): Promise<Occupancy> {
  return request<Occupancy>("/demo/simulate-detection", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  });
}
