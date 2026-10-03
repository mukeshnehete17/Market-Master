# ADR-006: Jittered HTTP Polling vs. WebSockets for MVP

## 1. Context & Problem
Multiplayer synchronization can be implemented using WebSockets, Server-Sent Events (SSE), or HTTP Polling. While WebSockets offer low latency, they introduce stateful connection management complexity, load balancer stickiness requirements, firewall/proxy drops on school Wi-Fi networks, and increased architectural overhead.

## 2. Decision
Adopt **Jittered HTTP Polling** (1.5s interval $\pm 200\text{ms}$) as the authoritative synchronization strategy for the MVP:
1. Students poll `GET /api/game/current` while in `waiting` or `question` state.
2. The endpoint reads indexed PostgreSQL tables in $\le 10\text{ms}$ and returns the synchronized phase.
3. Jitter breaks thundering-herd synchrony across 140+ concurrent clients.
4. Server-authoritative timestamps (`deadline`, `time_remaining`) drive the UI countdown, making timer accuracy independent of polling latency.

## 3. Consequences
- **Positive**: Extremely robust, 100% firewall/proxy compatible, completely stateless backend, trivial to scale behind standard HTTP edge caching/proxies.
- **Negative**: Polling generates regular HTTP traffic (~70-90 requests per second across 140 active students), requiring indexed database queries.
