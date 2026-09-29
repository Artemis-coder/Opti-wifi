'use client';

import { useEffect, useState } from 'react';

export interface ConnectionInfo {
  /** Estimated downlink in Mbit/s, from the Network Information API. */
  downlink: number | null;
  /** Round trip time in milliseconds. */
  rtt: number | null;
  effectiveType: string | null;
  type: string | null;
  saveData: boolean;
  /** True when the browser exposes navigator.connection (Chromium / Android WebView). */
  isSupported: boolean;
}

export interface TrafficCounters {
  /** Bytes sent in request bodies, measured by the fetch interceptor. */
  sent: number;
  /** Bytes received in responses, measured by the fetch interceptor. */
  received: number;
}

interface NetworkInformation extends EventTarget {
  downlink?: number;
  rtt?: number;
  effectiveType?: string;
  type?: string;
  saveData?: boolean;
}

function getConnection(): NetworkInformation | null {
  if (typeof navigator === 'undefined') return null;
  const nav = navigator as Navigator & {
    connection?: NetworkInformation;
    mozConnection?: NetworkInformation;
    webkitConnection?: NetworkInformation;
  };
  return nav.connection ?? nav.mozConnection ?? nav.webkitConnection ?? null;
}

export function readConnection(): ConnectionInfo {
  const c = getConnection();
  return {
    downlink: typeof c?.downlink === 'number' ? c.downlink : null,
    rtt: typeof c?.rtt === 'number' ? c.rtt : null,
    effectiveType: c?.effectiveType ?? null,
    type: c?.type ?? null,
    saveData: c?.saveData === true,
    isSupported: c !== null,
  };
}

// ---------------------------------------------------------------------------
// Traffic counters
//
// There is no browser API for real-time byte counters, so the numbers are
// measured by wrapping window.fetch: request bodies give the bytes we send,
// response bodies give the bytes we receive. Content-Length is used when the
// server exposes it (CORS-safelisted), otherwise the body is measured on a
// clone so the original response stays untouched for the caller.
// ---------------------------------------------------------------------------

const counters = { sent: 0, received: 0 };
let installed = false;

function bodySize(body: BodyInit | null | undefined): number {
  if (body == null) return 0;
  if (typeof body === 'string') return new TextEncoder().encode(body).length;
  if (body instanceof URLSearchParams) {
    return new TextEncoder().encode(body.toString()).length;
  }
  if (body instanceof Blob) return body.size;
  if (body instanceof ArrayBuffer) return body.byteLength;
  if (ArrayBuffer.isView(body)) return body.byteLength;
  return 0;
}

function measureResponse(response: Response): void {
  const declared = Number(response.headers.get('content-length'));
  if (Number.isFinite(declared) && declared > 0) {
    counters.received += declared;
    return;
  }
  void response
    .clone()
    .arrayBuffer()
    .then((buffer) => {
      counters.received += buffer.byteLength;
    })
    .catch(() => {
      // Body already consumed or opaque: nothing to count.
    });
}

function installFetchCounter(): void {
  if (installed || typeof window === 'undefined') return;
  installed = true;

  const original = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    try {
      counters.sent += bodySize(init?.body);
    } catch {
      // Exotic body types are simply not counted.
    }
    const response = await original(input, init);
    try {
      measureResponse(response);
    } catch {
      // Never let measurement break a real request.
    }
    return response;
  };
}

function readCounters(): TrafficCounters {
  return { sent: counters.sent, received: counters.received };
}

/** Live connection quality plus measured traffic for this app session. */
export function useNetworkMetrics(pollMs = 4000) {
  const [connection, setConnection] = useState<ConnectionInfo>(readConnection);
  const [traffic, setTraffic] = useState<TrafficCounters>({ sent: 0, received: 0 });

  useEffect(() => {
    installFetchCounter();

    // The document itself counts as received bytes too.
    const navigation = performance.getEntriesByType('navigation')[0] as
      | PerformanceNavigationTiming
      | undefined;
    if (navigation?.transferSize) {
      counters.received += navigation.transferSize;
    }

    const interval = setInterval(() => {
      setTraffic(readCounters());
      setConnection(readConnection());
    }, pollMs);

    return () => clearInterval(interval);
  }, [pollMs]);

  return { connection, traffic };
}

export function formatBytes(bytes: number): string {
  if (bytes <= 0) return '0 o';
  const units = ['o', 'ko', 'Mo', 'Go'];
  const exp = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / 1024 ** exp;
  return `${value >= 100 || exp === 0 ? Math.round(value) : value.toFixed(1)} ${units[exp]}`;
}
