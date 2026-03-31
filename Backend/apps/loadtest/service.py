"""
Load Test Service
-----------------
Executes HTTP load tests using asyncio + aiohttp.
All heavy lifting happens here — views stay thin.
"""
import asyncio
import time
import statistics
from collections import defaultdict
from datetime import datetime, timezone
from typing import Any

import aiohttp

from django.conf import settings

# Max bytes to store for sample response body (10 KB)
MAX_SAMPLE_BODY_BYTES = 10_240


async def _send_request(
    session: aiohttp.ClientSession,
    method: str,
    url: str,
    headers: dict,
    body: Any,
    timeout: int,
    capture: bool = False,
) -> dict:
    """Send a single HTTP request and return timing + status info."""
    start = time.perf_counter()
    result = {
        "latency_ms": 0.0,
        "status_code": 0,
        "success": False,
        "error": None,
    }
    try:
        async with session.request(
            method=method,
            url=url,
            headers=headers or {},
            json=body if body and method in ("POST", "PUT", "PATCH") else None,
            timeout=aiohttp.ClientTimeout(total=timeout),
            ssl=False,
        ) as response:
            response_bytes = await response.read()
            elapsed_ms = (time.perf_counter() - start) * 1000
            result["latency_ms"] = round(elapsed_ms, 2)
            result["status_code"] = response.status
            result["success"] = response.status < 400

            if capture and result["success"]:
                try:
                    result["sample_body"] = response_bytes[:MAX_SAMPLE_BODY_BYTES].decode(
                        "utf-8", errors="replace"
                    )
                    result["sample_headers"] = dict(response.headers)
                except Exception:
                    pass

    except asyncio.TimeoutError:
        result["error"] = "timeout"
        result["latency_ms"] = round((time.perf_counter() - start) * 1000, 2)
    except aiohttp.ClientError as exc:
        result["error"] = str(exc)
        result["latency_ms"] = round((time.perf_counter() - start) * 1000, 2)
    except Exception as exc:
        result["error"] = f"unexpected: {exc}"
        result["latency_ms"] = round((time.perf_counter() - start) * 1000, 2)
    return result


async def _run_batch(
    method: str,
    url: str,
    headers: dict,
    body: Any,
    request_count: int,
    concurrency: int,
    timeout: int,
) -> tuple[list[dict], str | None, dict | None]:
    """Run `request_count` requests with `concurrency` workers.
    Returns (results, sample_body, sample_headers).
    """
    connector = aiohttp.TCPConnector(limit=concurrency, ssl=False)
    async with aiohttp.ClientSession(connector=connector) as session:
        semaphore = asyncio.Semaphore(concurrency)

        async def bounded_request(capture: bool = False):
            async with semaphore:
                return await _send_request(session, method, url, headers, body, timeout, capture=capture)

        # First task always attempts to capture the response body
        tasks = [bounded_request(capture=(i == 0)) for i in range(request_count)]
        results = await asyncio.gather(*tasks)

    results = list(results)

    # Extract sample from the first result that has body data
    sample_body: str | None = None
    sample_headers: dict | None = None
    for r in results:
        if r.get("sample_body"):
            sample_body = r.pop("sample_body")
            sample_headers = r.pop("sample_headers", {})
            break
        # Clean up keys even if empty
        r.pop("sample_body", None)
        r.pop("sample_headers", None)

    return results, sample_body, sample_headers


def _compute_percentile(sorted_values: list[float], pct: float) -> float:
    if not sorted_values:
        return 0.0
    idx = int(len(sorted_values) * pct / 100)
    idx = min(idx, len(sorted_values) - 1)
    return sorted_values[idx]


def run_load_test(config) -> dict:
    """
    Execute the load test synchronously (wraps async runner).
    Returns a dict suitable for populating LoadTestResult fields.
    """
    max_requests = getattr(settings, "MAX_TOTAL_REQUESTS", 1000)
    max_concurrency = getattr(settings, "MAX_CONCURRENT_REQUESTS", 50)

    request_count = min(config.request_count, max_requests)
    concurrency = min(config.concurrency, max_concurrency)

    loop = asyncio.new_event_loop()
    try:
        raw_results, sample_body, sample_headers = loop.run_until_complete(
            _run_batch(
                method=config.method,
                url=config.url,
                headers=config.headers or {},
                body=config.body,
                request_count=request_count,
                concurrency=concurrency,
                timeout=config.timeout_seconds,
            )
        )
    finally:
        loop.close()

    latencies = [r["latency_ms"] for r in raw_results]
    sorted_latencies = sorted(latencies)
    status_codes: dict[str, int] = defaultdict(int)
    errors = []
    successes = 0

    for r in raw_results:
        code_key = str(r["status_code"]) if r["status_code"] else "0"
        status_codes[code_key] += 1
        if r["success"]:
            successes += 1
        if r["error"]:
            errors.append(r["error"])

    total = len(raw_results)
    failed = total - successes
    error_rate = (failed / total * 100) if total else 0.0

    avg_latency = statistics.mean(latencies) if latencies else 0.0
    throughput = (concurrency / (avg_latency / 1000)) if avg_latency > 0 else 0.0

    return {
        "total_requests": total,
        "successful_requests": successes,
        "failed_requests": failed,
        "avg_latency_ms": round(avg_latency, 2),
        "min_latency_ms": round(min(latencies), 2) if latencies else 0.0,
        "max_latency_ms": round(max(latencies), 2) if latencies else 0.0,
        "p50_latency_ms": round(_compute_percentile(sorted_latencies, 50), 2),
        "p95_latency_ms": round(_compute_percentile(sorted_latencies, 95), 2),
        "p99_latency_ms": round(_compute_percentile(sorted_latencies, 99), 2),
        "throughput_rps": round(throughput, 2),
        "error_rate": round(error_rate, 2),
        "status_codes": dict(status_codes),
        "raw_latencies": latencies,
        "error_messages": list(set(errors))[:20],
        "sample_response_body": sample_body,
        "sample_response_headers": sample_headers or {},
    }
