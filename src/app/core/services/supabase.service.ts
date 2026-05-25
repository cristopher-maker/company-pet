import { Injectable } from '@angular/core';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class SupabaseService {
  public readonly client: SupabaseClient;

  constructor() {
    this.client = createClient(environment.supabaseUrl, environment.supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        // Prevent noisy unhandled lock errors in dev when the auth lock is busy (e.g., multiple tabs/reloads).
        // When acquireTimeout is 0 (Supabase uses this for auto-refresh ticks), we skip the operation if the lock
        // isn't immediately available, instead of throwing.
        lock: async <R>(name: string, acquireTimeout: number, fn: () => Promise<R>) => {
          const nav: any = (globalThis as any)?.navigator;
          const request: any = nav?.locks?.request;
          if (typeof request !== 'function') return await fn();

          if (acquireTimeout === 0) {
            try {
              return await request.call(
                nav.locks,
                name,
                { mode: 'exclusive', ifAvailable: true },
                async (lock: any) => {
                  if (!lock) return undefined as unknown as R;
                  return await fn();
                }
              );
            } catch {
              return undefined as unknown as R;
            }
          }

          const abortController = new (globalThis as any).AbortController();
          if (acquireTimeout > 0) {
            setTimeout(() => abortController.abort(), acquireTimeout);
          }

          try {
            return await request.call(
              nav.locks,
              name,
              { mode: 'exclusive', signal: abortController.signal },
              async (_lock: any) => await fn()
            );
          } catch {
            // Fallback: run without the lock if acquisition fails.
            return await fn();
          }
        },
      },
    });
  }
}
