# 08 Saga (orchestration)

**Run:** `npx tsx src/08-saga/broken.ts`, then `fixed.ts`

**Break:** three steps called in sequence, step 2 fails, nothing undoes step 1.

**Fix:** an orchestrator that persists progress (`saga_instances`), compensates in reverse order on
failure, and survives a crash because every step and compensation is idempotent (primary key on
`saga_effects`).

**Extend it yourself:** make a compensation fail and retry it; add a timeout per step; add a second
orchestrator instance and prevent both from running the same saga (lock the saga row).

**Say it aloud (90 s):** why distributed transactions are avoided, orchestration vs choreography,
what compensation can and cannot undo (you can refund, you cannot un-send an email), why idempotency
is mandatory.

**Interview questions:** What is a saga? Orchestration vs choreography? What if a compensation fails?
What if the orchestrator crashes mid-saga?
