
- Partner Hub events are queued by database triggers on Room status/document/sign-off changes into a private outbox and sent by a server sender; why: fires identically for every stage and model without touching stage logic.
