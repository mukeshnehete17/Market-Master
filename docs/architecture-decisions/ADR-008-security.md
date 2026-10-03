# ADR-008: Comprehensive Security Architecture & Secret Protection

## 1. Context & Problem
Educational quiz competitions are prone to student cheating via browser devtools (inspecting network payloads, React component state, or local storage). Furthermore, service-role keys must be protected against accidental frontend exposure.

## 2. Decision
1. **Server-Side Answer Sanitization**:
   - `build_current_state()` and `api_current()` strictly sanitize question objects before sending them to students.
   - The fields `correct_option` and `explanation` are physically absent from the response dictionary during active rounds.
   - They are only supplied after the host triggers the reveal action (`rounds.status == 'result'`).
2. **Double-Spend Prevention via Unique Constraints**:
   - PostgreSQL unique constraints on `answers(round_id, user_id)` and `positions(round_id, user_id)` guarantee that duplicate network requests or concurrent clicks cannot record multiple positions.
3. **Secret Key Segregation**:
   - `SUPABASE_SERVICE_ROLE_KEY` and `SECRET_KEY` are read exclusively by the Flask backend runtime and never bundled into frontend assets.

## 3. Consequences
- **Positive**: Complete defense against client inspection, cheating, and secret leaks.
- **Negative**: The backend must handle different response projections depending on the round state.
