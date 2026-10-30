# Architecture

## Pipeline

`POST /api/run` streams newline-delimited events from `src/lib/engine.ts`.

1. **Profile:** web research, then structured extraction into an ICP with confidence scores.
2. **Nominate:** up to 5 candidate targets. This step only nominates.
3. **Scout:** parallel agents verify each candidate with web search. Evidence is kept only if its URL appeared in that scout's search results.
4. **Warrant:** `evaluate()` in `src/lib/warrant.ts` requires a cited reason, a path in, positive expected value, and no disqualifier.
5. **Pilot Pack and draft:** built for the highest-fit passing target.
6. **Review:** the Reviewer checks every claim against the evidence and removes unsupported ones. Security removes links the agents never read.
7. **Human gate:** `POST /api/approve` recomputes the warrant on the server, then delivers to test destinations only.

Web content is treated as untrusted data throughout.

## Reasoning loop

Research and extraction are separate calls. Research uses web tools and returns notes. Extraction turns notes into schema-validated JSON with zod. Code, not the model, makes the final pass or refuse decision.

## Graph ontology

Neo4j stores nodes `Company`, `Competitor`, and `Signal`, with directed edges `competes_with`, `matched_to` (properties `fit`, `passed`, `path`), and `has_signal`. Sources sit on `Signal` nodes.

```cypher
MATCH path = (seller:Company {name: $seller})-[:matched_to]->(:Company)-[:has_signal]->(:Signal)
WHERE ALL(link IN relationships(path) WHERE type(link) <> 'matched_to' OR link.passed)
RETURN path
```

Warm-path edges such as `previously_employed_at` are planned, and need a sourced or permissioned relationship dataset.

## Integrations

| Service | Role | File |
|---|---|---|
| Band | Planner, Builder, Reviewer, and Security post in a shared room under their own identities, using @mentions | `src/lib/integrations/band.ts` |
| Flexprice | Metered credit events priced against a prepaid wallet, whose real-time balance limits scouts | `src/lib/integrations/flexprice.ts` |
| Neo4j | Stores runs and answers path queries | `src/lib/integrations/graph.ts` |
| Hunter | Finds a contact for the top target | `src/lib/integrations/hunter.ts` |
| Resend | Sends approved email to the test inbox | `src/app/api/approve/route.ts` |
| Vapi | Runs the approved browser voice call | `src/components/App.tsx` |
| Snyk | SAST and dependency scans in CI | `.github/workflows/security.yml` |

## Models

Claude Sonnet 5.5 handles research and extraction for speed. Claude Opus 5.5 handles claim review.
