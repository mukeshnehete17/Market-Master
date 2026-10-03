# ADR-003: Supabase PostgreSQL Single Source of Truth & RLS Lockdown

## 1. Context & Problem
Previous iterations experienced state discrepancies where in-memory state or mock tables diverged from the persistent database, causing "Question not found" or "Game not found" errors upon navigation. In addition, permitting public anon clients to query Supabase directly would risk answer leakage and unauthorized balance alterations.

## 2. Decision
1. Declare Supabase PostgreSQL as the **Single Source of Truth**. All entities must be persisted before confirming operations to clients.
2. Enable Row Level Security (RLS) in **deny-by-default** mode across all 12 application tables (`002_rls_lockdown.sql`).
3. Disallow all direct browser client communication with Supabase. All traffic routes through the Flask backend via the service-role client.

## 3. Consequences
- **Positive**: Complete defense-in-depth against data breaches, guaranteed answer secrecy, and zero synchronization drift.
- **Negative**: All queries incur the slight overhead of passing through the Flask API gateway.
