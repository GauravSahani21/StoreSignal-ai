# ADR 005: Structure-Aware Knowledge Retrieval (RAG) and Deliberate Abstention Gaps

## Status
Accepted

## Context
Floor coaching and shopper intelligence require grounded retail specifications (mileage, prices, service schedules, warranty terms). Hallucinated figures or out-of-context answers are unacceptable. The system must retrieve traceable chunks with exact source citations and deliberately abstain on unverified facts.

## Decision
1. **Structure-Aware Chunking:**
   - Tabular documents (CSV/XLSX) are chunked per row with column headers prepended to each row chunk, preserving tabular context without token bloat.
   - Markdown documents are split along heading boundaries (`#`, `##`, `###`), maintaining parent heading paths in location metadata.
2. **Traceable Citations:** Every retrieved chunk includes `chunkId`, `documentId`, `filename`, `score`, and `locationMetadata` (`row`, `heading`, `section`).
3. **Retrieval Failure vs. Empty Results:** The system explicitly distinguishes empty results (`status: 'empty'`) from upstream service failures (`status: 'failed'`), preventing agents from falsely claiming they verified the knowledge base when an outage occurred.
4. **Deliberate Knowledge Gaps & Conflict:** The seeded catalogue incorporates 3 deliberate gaps (accessory pricing, 5-year maintenance cost, exact interest rate) and 1 deliberate policy conflict (portable charger warranty) to test abstention and conflict detection in downstream agents.

## Consequences
- Guaranteed zero invented numbers for product questions.
- High hit-rate on gold retail queries with traceable citations.
