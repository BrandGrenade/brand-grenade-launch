import { useEffect, useRef, useState } from 'react';
import { useServerFn } from '@tanstack/react-start';
import { checkClientRunLinks } from '@/lib/run-links.functions';
import { Button } from '@/components/ui/button';

type Check = { run_id: string; room: string; open_url: string; result: string };
export function RunLinkCheck({ clients }: { clients: { id: string; name: string }[] }) {
  const check = useServerFn(checkClientRunLinks);
  const [client, setClient] = useState('');
  const [rows, setRows] = useState<Check[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const frame = useRef<HTMLIFrameElement>(null);
  const pending = useRef<{ id: string; done: (message: string) => void } | null>(null);
  useEffect(() => {
    const receive = (e: MessageEvent) => {
      if (e.origin !== window.location.origin || e.source !== frame.current?.contentWindow || !pending.current) return;
      if (e.data?.type === 'bg-run-loaded' && e.data.run_id === pending.current.id) pending.current.done('Pass');
    };
    window.addEventListener('message', receive);
    return () => window.removeEventListener('message', receive);
  }, []);
  async function runCheck() {
    setBusy(true); setError(''); setRows([]);
    try {
      const runs = await check({ data: { clientId: client } });
      setRows(runs.map(r => ({ ...r, result: 'Queued' })));
      for (const r of runs) {
        setRows(prev => prev.map(x => x.run_id === r.run_id ? { ...x, result: 'Checking' } : x));
        const result = await new Promise<string>(resolve => {
          const timer = setTimeout(() => { pending.current = null; resolve('Failed: saved run did not load within 30 seconds'); }, 30000);
          pending.current = { id: r.run_id, done: msg => { clearTimeout(timer); pending.current = null; resolve(msg); } };
          if (frame.current) frame.current.src = new URL(r.open_url).pathname + new URL(r.open_url).search;
        });
        setRows(prev => prev.map(x => x.run_id === r.run_id ? { ...x, result } : x));
      }
    } catch (e) { setError(e instanceof Error ? e.message : 'Link check failed.'); }
    finally { setBusy(false); }
  }
  return <section className="mt-8 border-t border-border pt-6"><h2 className="text-h3">Run link check</h2>
    <div className="mt-3 flex gap-3"><select aria-label="Link check client" className="rounded-md border border-input bg-background p-2" value={client} onChange={e => setClient(e.target.value)} disabled={busy}><option value="">Select client</option>{clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select><Button disabled={!client || busy} onClick={() => void runCheck()}>{busy ? 'Checking links…' : 'Check run links'}</Button></div>
    {error && <p role="alert" className="mt-3 text-destructive">{error}</p>}
    {!!rows.length && <table className="mt-4 w-full text-body-sm"><thead><tr><th className="text-left">Room</th><th className="text-left">Run</th><th className="text-left">Result</th></tr></thead><tbody>{rows.map(r => <tr key={r.run_id}><td>{r.room}</td><td className="break-all"><a href={r.open_url}>{r.run_id}</a></td><td>{r.result}</td></tr>)}</tbody></table>}
    <iframe ref={frame} title="Run link verification" className="hidden" />
  </section>;
}