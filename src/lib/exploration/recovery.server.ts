import type { JobDomain } from '../reliability/supervisor.server';

/** Recovery only re-dispatches durable work, never runs a model inside the supervisor. */
export const explorationDomains: JobDomain[] = (['projection','exploration'] as const).map(name => {
  const table = name === 'projection' ? 'bg_projection_jobs' : 'bg_exploration_jobs';
  return {
    name, timeoutMs: 300000, maxAttempts: 2, maxTotalAttempts: 2,
    async list(admin) {
      const {data,error} = await admin.from(table).select('id,status,lease_token,lease_until,created_at').in('status',['queued','running']);
      if(error) throw new Error(`${name.toUpperCase()}_RECOVERY_READ_FAILED: ${error.message}`);
      return (data ?? []).map((row: Record<string, unknown>) => ({
        jobId: String(row['id']), row,
        quietMs: Date.now() - (row['lease_until'] ? Date.parse(String(row['lease_until'])) - 240000 : Date.parse(String(row['created_at']))),
        detail: `${name} interrupted background job`,
      }));
    },
    async recover(admin,job) {
      let q = admin.from(table).update({status:'queued',lease_token:null,lease_until:null}).eq('id',job.jobId).eq('status',job.row?.['status']);
      q = job.row?.['lease_token'] ? q.eq('lease_token',job.row['lease_token']) : q.is('lease_token',null);
      const {error} = await q;
      if(error) throw new Error(`${name.toUpperCase()}_RECOVERY_FAILED: ${error.message}`);
    },
    async escalate(admin,job,message) {
      let q = admin.from(table).update({status:'failed',error:`${name.toUpperCase()}_RECOVERY_EXHAUSTED: ${message}`,lease_until:null}).eq('id',job.jobId).eq('status',job.row?.['status']);
      q=job.row?.['lease_token']?q.eq('lease_token',job.row['lease_token']):q.is('lease_token',null);
      const {error}=await q;
      if(error) throw new Error(`${name.toUpperCase()}_RECOVERY_FAILED: ${error.message}`);
    },
  };
});