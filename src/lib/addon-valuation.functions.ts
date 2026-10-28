import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';

export const regenerateValuationAddon = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ sessionId: z.string().uuid(), version: z.number().int().positive() }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: admin, error } = await context.supabase.rpc('bg_is_admin', { _uid: context.userId });
    if (error || admin !== true) throw new Error('Forbidden');
    const { assertSessionAccess } = await import('./auth-helpers.server');
    await assertSessionAccess(data.sessionId, context.userId);
    const { regenerateAddonValuation } = await import('./addon-valuation.server');
    return regenerateAddonValuation(data.sessionId, data.version);
  });

export const getValuationAddon = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ sessionId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { assertSessionAccess } = await import('./auth-helpers.server');
    await assertSessionAccess(data.sessionId, context.userId);
    const { readAddonValuation } = await import('./addon-valuation.server');
    return readAddonValuation(data.sessionId);
  });