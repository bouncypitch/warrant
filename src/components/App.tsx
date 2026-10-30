"use client";

import { type FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { demos } from "@/lib/demos";
import type { Claim, Draft, PilotPack, Profile, Run, RunEvent, Target } from "@/lib/types";
import { evaluate, isSourced, SCOUT_CREDITS } from "@/lib/warrant";
import { MarketMap } from "./MarketMap";

const CREDITS = 500;
const TABS = ["Map", "Leads", "Pilot Pack", "Review", "Approve", "Pipeline"] as const;
type Tab = (typeof TABS)[number];
type Log = { text: string; hot?: boolean };
type Hearing = { from: string; to: string; text: string; tone?: "good" | "bad" };
type Delivery = { email: string };
type Attempt = { text: string; supported: boolean; reason: string; checkedBy: string };

type Session = {
  company: string;
  act: string;
  prepared: boolean;
  researchedOn: string | null;
  profile: Profile | null;
  targets: Target[];
  pack: PilotPack | null;
  draft: Draft | null;
  running: boolean;
  error: string | null;
  spent: number;
  hearing: Hearing[];
};

const blank = (company: string, prepared: boolean, act: string): Session => ({
  company,
  act,
  prepared,
  researchedOn: null,
  profile: null,
  targets: [],
  pack: null,
  draft: null,
  running: true,
  error: null,
  spent: 0,
  hearing: [],
});

const preparedHearing = (run: Run): Hearing[] => {
  const removed = run.draft.claims.filter((claim) => !isSourced(claim)).length;
  return [
    { from: "Planner", to: "Builder", text: `Draft outreach for ${run.pack.title} using the verified evidence.` },
    { from: "Builder", to: "Reviewer", text: `Draft ready with ${run.draft.claims.length} claims.` },
    { from: "Reviewer", to: "Builder", text: `${removed} claim had no source and was removed.`, tone: "bad" },
    { from: "Security", to: "Reviewer", text: "Links in the draft came from the saved research.", tone: "good" },
    { from: "Reviewer", to: "Founder", text: "Ready for human approval. Nothing sends without it.", tone: "good" },
  ];
};

function Connections() {
  const [status, setStatus] = useState<Record<string, boolean> | null>(null);
  useEffect(() => {
    void fetch("/api/status").then(async (response) => setStatus(await response.json()));
  }, []);
  if (!status) return null;
  return (
    <div className="connections">
      {Object.entries(status).map(([name, ready]) => (
        <span key={name} className={ready ? "ok" : ""}>{ready ? "●" : "○"} {name}</span>
      ))}
    </div>
  );
}

export function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [logs, setLogs] = useState<Log[]>([]);
  const [tab, setTab] = useState<Tab>("Map");
  const [company, setCompany] = useState("");
  const [approved, setApproved] = useState(false);
  const [replied, setReplied] = useState(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const request = useRef<AbortController | null>(null);

  const reset = (next: Session | null) => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    request.current?.abort();
    setSession(next);
    setLogs([]);
    setTab("Map");
    setApproved(false);
    setReplied(false);
  };

  const patch = (change: Partial<Session> | ((current: Session) => Partial<Session>)) =>
    setSession((current) =>
      current ? { ...current, ...(typeof change === "function" ? change(current) : change) } : current,
    );

  const playDemo = (run: Run) => {
    reset(blank(run.company, true, run.act));
    const later = (ms: number, task: () => void) => {
      timers.current.push(setTimeout(task, ms));
    };
    setLogs([{ text: `Prepared run for ${run.company}`, hot: true }]);
    later(500, () => patch({ profile: run.profile, researchedOn: run.researchedOn, spent: 10 }));
    run.targets.forEach((target, index) => {
      later(1100 + index * 550, () => {
        setLogs((items) => [...items, { text: `Scout returned: ${target.name}` }]);
        patch((current) => ({
          targets: [...current.targets, target],
          spent: current.spent + SCOUT_CREDITS,
        }));
      });
    });
    later(1700 + run.targets.length * 550, () => {
      const passed = run.targets.filter((target) => evaluate(target).passed).length;
      setLogs((items) => [
        ...items,
        { text: `${passed} passed, ${run.targets.length - passed} refused`, hot: true },
      ]);
      patch({ pack: run.pack, draft: run.draft, running: false, hearing: preparedHearing(run) });
      void fetch("/api/band", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: `Warrant: ${run.pack.title}`, hearing: preparedHearing(run) }),
      });
      void fetch("/api/graph", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(run),
      });
      void fetch("/api/credits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ credits: 10 + run.targets.length * SCOUT_CREDITS, stage: "demo.replayed" }),
      });
    });
  };

  const handle = (event: RunEvent) => {
    if (event.type === "log") setLogs((items) => [...items, event]);
    if (event.type === "profile") patch({ profile: event.profile });
    if (event.type === "target") patch((current) => ({ targets: [...current.targets, event.target] }));
    if (event.type === "credits") patch({ spent: event.spent });
    if (event.type === "hearing") {
      patch((current) => ({ hearing: [...current.hearing, event] }));
    }
    if (event.type === "error") patch({ error: event.message, running: false });
    if (event.type === "done") {
      patch({
        pack: event.run.pack,
        draft: event.run.draft,
        researchedOn: event.run.researchedOn,
        company: event.run.company,
        targets: event.run.targets,
        running: false,
      });
      void fetch("/api/graph", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(event.run),
      });
    }
  };

  const runLive = async (event: FormEvent) => {
    event.preventDefault();
    const name = company.trim();
    if (!name) return;
    reset(blank(name, false, "Live run"));
    const controller = new AbortController();
    request.current = controller;

    try {
      const response = await fetch("/api/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ company: name }),
        signal: controller.signal,
      });
      if (!response.ok || !response.body) {
        const body = (await response.json()) as { error?: string };
        patch({ error: body.error ?? "The run could not start.", running: false });
        return;
      }
      const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
      let buffer = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += value;
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        lines.filter(Boolean).forEach((line) => handle(JSON.parse(line) as RunEvent));
      }
    } catch (error) {
      if (!controller.signal.aborted) {
        patch({ error: error instanceof Error ? error.message : "The run failed.", running: false });
      }
    }
  };

  return (
    <div className="app">
      <header>
        <button className="home" onClick={() => reset(null)}>
          <span className="mark" aria-hidden="true" />
          <span className="brand">Warrant - GTM Engine for Physical AI</span>
        </button>
        {session && <CreditMeter spent={session.spent} />}
      </header>

      <form className="enter" onSubmit={runLive}>
        <input
          id="company"
          aria-label="Company name"
          placeholder="Enter any robotics company"
          value={company}
          onChange={(event) => setCompany(event.target.value)}
        />
        <button className="primary" type="submit">Run live</button>
        <div className="demos">
          {demos.map((demo) => (
            <button key={demo.company} type="button" className="ghost" onClick={() => playDemo(demo)}>
              {demo.act}: {demo.company}
            </button>
          ))}
        </div>
      </form>

      {!session ? (
        <section className="intro">
          <Connections />
          <h1>From site, to pilot, to <span className="grad">first order.</span></h1>
          <p>Warrant finds where a robot should go next, builds the pilot plan, and refuses to contact anyone until the evidence holds up.</p>
        </section>
      ) : (
        <Workspace
          session={session}
          logs={logs}
          tab={tab}
          setTab={setTab}
          approved={approved}
          setApproved={setApproved}
          replied={replied}
          setReplied={setReplied}
        />
      )}
    </div>
  );
}

function CreditMeter({ spent }: { spent: number }) {
  const [balance, setBalance] = useState<number | null>(null);

  useEffect(() => {
    const read = async () => {
      const response = await fetch("/api/credits");
      const body = (await response.json()) as { left: number | null; live: boolean };
      if (body.live) setBalance(body.left);
    };
    void read();
    const timer = setInterval(read, 4000);
    return () => clearInterval(timer);
  }, []);

  const left = balance ?? Math.max(0, CREDITS - spent);
  return (
    <div className="meter">
      <span>{balance === null ? "Credits" : "Flexprice credits"}</span>
      <div className="bar"><i style={{ width: `${Math.min(100, (left / CREDITS) * 100)}%` }} /></div>
      <span>{Math.round(left)} / {CREDITS}</span>
    </div>
  );
}

type WorkspaceProps = {
  session: Session;
  logs: Log[];
  tab: Tab;
  setTab: (tab: Tab) => void;
  approved: boolean;
  setApproved: (value: boolean) => void;
  replied: boolean;
  setReplied: (value: boolean) => void;
};

function Workspace({ session, logs, tab, setTab, approved, setApproved, replied, setReplied }: WorkspaceProps) {
  const hero = session.targets.find((target) => target.id === session.pack?.targetId) ?? null;

  return (
    <main className="workspace">
      <div className="status">
        <div>
          <div className="eyebrow">{session.act}</div>
          <h2>{session.company}</h2>
        </div>
        <span className={session.prepared ? "pill" : "pill warn"}>
          {session.prepared ? `Prepared run, researched ${session.researchedOn ?? "2026-10-30"}` : "Live run"}
        </span>
      </div>
      {session.error && <p className="notice" role="alert">{session.error}</p>}
      <nav className="tabs">
        {TABS.map((name) => (
          <button key={name} className={name === tab ? "on" : ""} onClick={() => setTab(name)}>{name}</button>
        ))}
      </nav>

      {tab === "Map" && (
        <div className="split">
          <div className="mapwrap">
            <MarketMap targets={session.targets} />
            <div className="legend">
              <span><i style={{ background: "var(--green)" }} />Passed</span>
              <span><i style={{ background: "var(--red)" }} />Refused</span>
            </div>
          </div>
          <div className="stack">
            <div className="panel log">
              <div className="eyebrow">Agent activity</div>
              {logs.map((log, index) => <p key={index} className={log.hot ? "hot" : ""}>{log.text}</p>)}
              {session.running && <p className="hot">Working…</p>}
            </div>
            {session.profile && <ProfilePanel profile={session.profile} />}
          </div>
        </div>
      )}
      {tab === "Leads" && <Leads targets={session.targets} />}
      {tab === "Pilot Pack" && <Pack pack={session.pack} hero={hero} />}
      {tab === "Review" && <Review draft={session.draft} hearing={session.hearing} />}
      {tab === "Approve" && (
        <Approve company={session.company} hero={hero} draft={session.draft} approved={approved} setApproved={setApproved} />
      )}
      {tab === "Pipeline" && (
        <Pipeline session={session} hero={hero} approved={approved} replied={replied} setReplied={setReplied} />
      )}
    </main>
  );
}

function ProfilePanel({ profile }: { profile: Profile }) {
  return (
    <div className="panel icp">
      <div className="eyebrow">Inferred customer</div>
      <p>{profile.summary}</p>
      {profile.icp.map((field) => (
        <div className="field" key={field.label}>
          <span>{field.label}</span>
          <b>{field.value}</b>
          <span className="conf">{field.confidence.toFixed(2)}</span>
        </div>
      ))}
      {profile.competitors.length > 0 && (
        <p className="tag">Competitors: {profile.competitors.join(", ")}</p>
      )}
      {profile.expansion.length > 0 && (
        <p className="tag">Adjacent markets: {profile.expansion.join(", ")}</p>
      )}
    </div>
  );
}

function Leads({ targets }: { targets: Target[] }) {
  if (targets.length === 0) return <p className="empty">Scouts are still working. Targets appear here as they report back.</p>;
  return (
    <div className="panel scroll">
      <table>
        <thead>
          <tr><th>Target</th><th>Fit</th><th>Why now</th><th>Way in</th><th>Est. value</th><th>Decision</th></tr>
        </thead>
        <tbody>
          {targets.map((target) => {
            const decision = evaluate(target);
            return (
              <tr key={target.id} className={decision.passed ? "" : "dead"}>
                <td><b>{target.name}</b><small>{target.kind}, {target.location}</small></td>
                <td>{target.fit}</td>
                <td>
                  {target.reason ? (
                    <a href={target.reason.url} target="_blank" rel="noreferrer">{target.reason.text}</a>
                  ) : "No sourced reason"}
                </td>
                <td>{target.pathNote}<small>Buyer: {target.buyerRole}{target.buyerConfirmed ? "" : " (hypothesis)"}</small></td>
                <td>${decision.expectedValue.toLocaleString("en-US")}</td>
                <td>{decision.passed ? <span className="pill ok">Passed</span> : <span className="pill bad" title={decision.refusal ?? ""}>Refused</span>}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function Pack({ pack, hero }: { pack: PilotPack | null; hero: Target | null }) {
  const [pct, setPct] = useState(30);
  if (!pack) return <p className="empty">The Pilot Pack appears once a target passes every check.</p>;
  const saved = Math.round((pack.baselineValue * pct) / 100);

  return (
    <div className="split even">
      <div className="panel">
        <div className="eyebrow">Pilot Pack{hero ? ` for ${hero.name}` : ""}</div>
        <h3>{pack.title}</h3>
        <div className="nums">
          <div><b>{pack.baselineValue.toLocaleString("en-US")}</b><span>{pack.baselineLabel}, estimate ({pack.baselineUnit})</span></div>
          <div><b>{saved.toLocaleString("en-US")}</b><span>Saved at {pct}%, estimate ({pack.baselineUnit})</span></div>
        </div>
        <div className="slider">
          <label htmlFor="pct"><span>Improvement, placeholder input</span><b>{pct}%</b></label>
          <input id="pct" type="range" min="10" max="60" value={pct} onChange={(event) => setPct(Number(event.target.value))} />
        </div>
      </div>
      <div className="panel">
        <div className="eyebrow">What the pilot must prove</div>
        <ul className="list">
          <li>Success test <span>{pack.successTest.replaceAll("{pct}", String(pct))}</span></li>
          <li>Approvers <span>{pack.approvers.join(", ")}</span></li>
          <li>Risks <span>{pack.risks.join("; ")}</span></li>
          <li>Path to order <span>{pack.pathToOrder}</span></li>
        </ul>
        <p className="tag">Assumptions: {pack.assumptions.join(" ")}</p>
      </div>
    </div>
  );
}

function Review({ draft, hearing }: { draft: Draft | null; hearing: Hearing[] }) {
  const [claim, setClaim] = useState("Your biggest competitor already signed with us.");
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const evidence = useMemo(
    () =>
      (draft?.claims ?? [])
        .filter(isSourced)
        .map((item) => ({ url: item.url as string, quote: item.quote as string })),
    [draft],
  );
  if (!draft) return <p className="empty">The draft appears once a target passes every check.</p>;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const text = claim.trim();
    if (!text) return;
    const response = await fetch("/api/claim", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ claim: text, evidence }),
    });
    const result = (await response.json()) as Omit<Attempt, "text">;
    setAttempts((items) => [{ text, ...result }, ...items]);
  };

  return (
    <div className="split even">
      <div className="panel draft">
        <div className="eyebrow">Draft under review</div>
        <h3>{draft.subject}</h3>
        {draft.claims.map((item: Claim) =>
          isSourced(item) ? (
            <p key={item.text}>
              <a className="cite" href={item.url as string} target="_blank" rel="noreferrer" title={item.quote as string}>{item.text}</a>
            </p>
          ) : (
            <p key={item.text}><span className="struck">{item.text}</span><br /><small className="bad">Removed: no source supports this claim.</small></p>
          ),
        )}
        <p>{draft.ask}</p>
      </div>
      <div className="panel draft">
        <div className="eyebrow">Agents working</div>
        {hearing.map((line, index) => (
          <p key={index} className={line.tone === "bad" ? "bad" : line.tone === "good" ? "ok" : ""}>
            <b>{line.from}</b> <span className="at">@{line.to}</span> {line.text}
          </p>
        ))}
        <div className="eyebrow">Try to make it lie</div>
        <form className="lie" onSubmit={submit}>
          <input id="claim" aria-label="Claim to add" value={claim} onChange={(event) => setClaim(event.target.value)} />
          <button className="ghost" type="submit">Add claim</button>
        </form>
        {attempts.map((attempt, index) => (
          <p key={index} className={attempt.supported ? "ok" : "bad"}>
            {attempt.supported ? "Allowed" : "Blocked"}: “{attempt.text}” {attempt.reason}
            <small> Checked by {attempt.checkedBy === "reviewer" ? "the Reviewer" : "saved-evidence rule"}.</small>
          </p>
        ))}
      </div>
    </div>
  );
}

function Approve({ company, hero, draft, approved, setApproved }: { company: string; hero: Target | null; draft: Draft | null; approved: boolean; setApproved: (value: boolean) => void }) {
  const [delivery, setDelivery] = useState<Delivery | null>(null);
  const [problem, setProblem] = useState<string | null>(null);

  if (!hero || !draft) return <p className="empty">Nothing is ready for approval yet.</p>;
  const decision = evaluate(hero);
  const clean = draft.claims.filter(isSourced);

  const approve = async () => {
    setApproved(true);
    const response = await fetch("/api/approve", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ company, target: hero, draft, approvedBy: "human" }),
    });
    if (!response.ok) {
      const body = (await response.json()) as { error?: string };
      setProblem(body.error ?? "Approval failed.");
      return;
    }
    setDelivery((await response.json()) as Delivery);
  };

  return (
    <div className="split even">
      <div className={approved ? "panel warrant glow" : "panel warrant"}>
        <div className="eyebrow">Warrant for {hero.name}</div>
        {decision.checks.map((check) => (
          <div className="field" key={check.label}>
            <span>{check.label}</span>
            <b>{check.detail}</b>
            <span className={check.pass ? "ok" : "bad"}>{check.pass ? "Pass" : "Fail"}</span>
          </div>
        ))}
        {hero.contact && (
          <div className="field">
            <span>Contact</span>
            <b>{hero.contact.position ?? "Role unknown"}, found by Hunter</b>
            <span className="conf">{hero.contact.confidence.toFixed(2)}</span>
          </div>
        )}
        <p className="body">{clean.map((item) => item.text).join(" ")} {draft.ask}</p>
      </div>
      <div className="stack">
        <button className="primary sign" disabled={!decision.passed || approved} onClick={approve}>
          {approved ? "Approved" : "Approve warrant"}
        </button>
        {problem && <p className="bad">{problem}</p>}
        <p className="tag">
          {!approved && "Nothing goes out without a person approving it. Email only ever goes to your test inbox."}
          {approved && !delivery && !problem && "Approved. Delivering…"}
          {delivery && `Test email: ${delivery.email}.`}
        </p>
      </div>
    </div>
  );
}

function Pipeline({ session, hero, approved, replied, setReplied }: { session: Session; hero: Target | null; approved: boolean; replied: boolean; setReplied: (value: boolean) => void }) {
  const decided = session.targets.map((target) => ({ target, decision: evaluate(target) }));
  const refused = decided.filter(({ decision }) => !decision.passed);
  const matched = decided.filter(({ target, decision }) => decision.passed && !(approved && target.id === hero?.id));
  const unsourced = session.draft?.claims.filter((claim) => !isSourced(claim)).length ?? 0;
  const share = decided.length ? Math.round((refused.length / decided.length) * 100) : 0;

  return (
    <div className="stack">
      <div className="kan">
        <div className="col"><h4>Matched</h4>{matched.map(({ target }) => <div className="card" key={target.id}>{target.name}<small>Agent</small></div>)}</div>
        <div className="col"><h4>Contacted</h4>{approved && !replied && hero && <div className="card live">{hero.name}<small>Agent drafted, you approved. Not sent yet.</small><button className="ghost" onClick={() => setReplied(true)}>Log reply</button></div>}</div>
        <div className="col"><h4>Replied</h4>{replied && hero && <div className="card live">{hero.name}<small>Logged by you</small></div>}</div>
        <div className="col"><h4>Meeting booked</h4></div>
        <div className="col"><h4>Closed or lost</h4>{refused.map(({ target }) => <div className="card" key={target.id}>{target.name}<small>Refused</small></div>)}</div>
      </div>
      <div className="split even">
        <div className="stats">
          <div className="panel stat"><b>{share}%</b><span>Targets refused</span></div>
          <div className="panel stat"><b>{unsourced}</b><span>Unsourced claims removed</span></div>
          <div className="panel stat"><b>{session.spent}</b><span>Credits used</span></div>
        </div>
        <div className="panel refusals">
          <div className="eyebrow">Refusal log</div>
          {refused.length === 0 && <p className="tag">No refusals yet.</p>}
          {refused.map(({ target, decision }) => (
            <div key={target.id}>{target.name}<span>{decision.refusal}</span></div>
          ))}
        </div>
      </div>
    </div>
  );
}
