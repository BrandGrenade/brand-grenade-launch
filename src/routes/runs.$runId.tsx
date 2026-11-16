import { createFileRoute, Link } from '@tanstack/react-router';
import { useServerFn } from '@tanstack/react-start';
import { useEffect, useState } from 'react';
import { TopNav } from '@/components/TopNav';
import { Button } from '@/components/ui/button';
import { readSavedRun } from '@/lib/run-links.functions';

export const Route = createFileRoute('/runs/$runId')({
  validateSearch: (s: Record<string, unknown>) => ({ stage: s.stage == null ? undefined : String(s.stage).toUpperCase() }),
  head: () => ({ meta: [{ title: 'Saved run — Brand Grenade' }, { name: 'description', content: 'Saved Brand Grenade run evidence and completed stages.' }, { property: 'og:title', content: 'Saved run — Brand Grenade' }, { property: 'og:description', content: 'Saved Brand Grenade run evidence and completed stages.' }, { property: 'og:type', content: 'website' }, { name: 'twitter:card', content: 'summary' }] }),
  component: SavedRun,
});
const ROOMS: Record<string, string> = { room00: 'Research Synthesiser', room01: 'Intelligence Lab', room02: 'Briefing Room', room03: 'Strategy Pipeline', room04: 'Creative Engine' };
function SavedRun() {
  const { runId } = Route.useParams();
  const { stage } = Route.useSearch();
  const read = useServerFn(readSavedRun);
  const [run, setRun] = useState<Awaited<ReturnType<typeof readSavedRun>> | null>(null);
  const [error, setError] = useState('');
  const [attempt, retry] = useState(0);
  useEffect(() => {
    let active = true;
    setRun(null); setError('');
    const timer = setTimeout(() => { if (active) setError('Saved run is taking too long to load. Try again.'); }, 25000);
    void read({ data: { id: runId, stage } }).then(r => {
      if (!active) return;
      clearTimeout(timer); setError(''); setRun(r);
      window.parent.postMessage({ type: 'bg-run-loaded', run_id: r.id, room: r.room }, window.location.origin);
    }).catch(e => { if (active) { clearTimeout(timer); setError(e instanceof Error ? e.message : 'Saved run could not be loaded.'); } });
    return () => { active = false; clearTimeout(timer); };
  }, [read, runId, stage, attempt]);
  return <><TopNav /><main className="mx-auto max-w-5xl px-6 py-10" data-run-id={run?.id}>
    <Link to="/dashboard" className="text-text-secondary underline">Back to runs</Link>
    {error ? <div role="alert" className="mt-6"><p>{error}</p><Button className="mt-3" onClick={() => retry(n => n + 1)}>Retry</Button></div> : !run ? <p className="mt-6">Loading saved run…</p> : <>
      <p className="mt-6 text-text-secondary">{ROOMS[run.room]} · {run.status}</p>
      <h1 className="mt-2 text-h2">{run.brand}</h1>
      <p className="mt-2 text-text-secondary">Run {run.id}</p>
      {!!run.stages.length && <nav className="my-6 flex flex-wrap gap-3" aria-label="Saved stages">{run.stages.map(s => <Link key={s} to="/runs/$runId" params={{ runId }} search={{ stage: s }} aria-current={s === run.selected ? 'page' : undefined} className="underline">Stage {s}</Link>)}</nav>}
      {run.selected && <h2 className="mt-6 text-h3">Stage {run.selected}</h2>}
      {!run.sections.length && <p className="mt-6">No saved output is available for this run.</p>}
      {run.sections.map((s, i) => <section key={i} className="mt-8 border-t border-border pt-6"><h3 className="text-h4">{s.title}</h3><pre className="mt-3 whitespace-pre-wrap break-words font-sans text-body-sm">{s.text}</pre></section>)}
    </>}
  </main></>;
}