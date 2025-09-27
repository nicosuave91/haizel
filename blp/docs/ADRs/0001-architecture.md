# ADR 0001: High-Level Architecture

- **Status**: Accepted
- **Context**: Define the baseline architecture for the Broker-Lender Platform MVP.
- **Decision**: Adopt a monorepo with a NestJS core API, FastAPI rules engine, Temporal workers, connector services, and PostgreSQL with RLS.
- **Consequences**: Enables cohesive development across services with shared tooling while keeping service boundaries explicit.
