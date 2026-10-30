import neo4j from "neo4j-driver";
import type { Run } from "../types";
import { evaluate } from "../warrant";

const uri = process.env.NEO4J_URI;
const user = process.env.NEO4J_USERNAME;
const password = process.env.NEO4J_PASSWORD;

export const graphReady = () => Boolean(uri && user && password);

export async function persistRun(run: Run) {
  if (!uri || !user || !password) return { connected: false, paths: [] as string[] };

  const driver = neo4j.driver(uri, neo4j.auth.basic(user, password));
  const session = driver.session();
  try {
    await session.run(
      `MERGE (seller:Company {name: $seller})
       SET seller.summary = $summary
       WITH seller
       UNWIND $competitors AS competitor
       MERGE (rival:Competitor {name: competitor})
       MERGE (seller)-[:competes_with]->(rival)`,
      { seller: run.company, summary: run.profile.summary, competitors: run.profile.competitors },
    );
    await session.run(
      `MATCH (seller:Company {name: $seller})
       UNWIND $targets AS target
       MERGE (account:Company {name: target.name})
       SET account.kind = target.kind, account.location = target.location
       MERGE (seller)-[match:matched_to]->(account)
       SET match.fit = target.fit, match.passed = target.passed, match.path = target.path
       FOREACH (_ IN CASE WHEN target.signal IS NULL THEN [] ELSE [1] END |
         MERGE (signal:Signal {url: target.url})
         SET signal.text = target.signal, signal.quote = target.quote
         MERGE (account)-[:has_signal]->(signal))`,
      {
        seller: run.company,
        targets: run.targets.map((target) => ({
          name: target.name,
          kind: target.kind,
          location: target.location,
          fit: target.fit,
          passed: evaluate(target).passed,
          path: target.pathType,
          signal: target.reason?.text ?? null,
          url: target.reason?.url ?? null,
          quote: target.reason?.quote ?? null,
        })),
      },
    );
    const result = await session.run(
      `MATCH path = (seller:Company {name: $seller})-[:matched_to]->(:Company)-[:has_signal]->(:Signal)
       WHERE ALL(link IN relationships(path) WHERE type(link) <> 'matched_to' OR link.passed)
       RETURN [node IN nodes(path) | coalesce(node.name, node.text)] AS names
       LIMIT 5`,
      { seller: run.company },
    );
    return {
      connected: true,
      paths: result.records.map((record) => (record.get("names") as string[]).join(" → ")),
    };
  } finally {
    await session.close();
    await driver.close();
  }
}
