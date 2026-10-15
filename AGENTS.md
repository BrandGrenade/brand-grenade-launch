
- Partner Hub events are queued by database triggers on Room status/document/sign-off changes into a private outbox and sent by a server sender; why: fires identically for every stage and model without touching stage logic.
- Score-line parsers must accept the cleaned form "N/10 (revised from M/10)." and be tested on text passed through stripDocumentMetadata; why: the cleaner rewrites review markers before parsing, and a raw-text-only test let Jaguar downloads break twice.
- Keep the public methodology headline in platform-metrics separate from the audited register count; why: public copy updates must not change the underlying inventory or other platform metrics.
- Repository visitor passwords are bcrypt-only (no scrypt fallback, no readable column); why: readable passwords must never be stored or shown — admins reset, never view.
