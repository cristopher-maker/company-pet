import { inject } from '@angular/core';
import { CanMatchFn, Router, UrlTree } from '@angular/router';

import { SupabaseService } from '../services/supabase.service';

export const internalAdminGuard: CanMatchFn = async (): Promise<boolean | UrlTree> => {
  const supabase = inject(SupabaseService);
  const router = inject(Router);

  const { data: userData } = await supabase.client.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) return router.createUrlTree(['/login']);

  const { data: profile, error } = await supabase.client
    .from('profiles')
    .select('role')
    .eq('id', userId)
    .maybeSingle();

  if (error || profile?.role !== 'admin') {
    return router.createUrlTree(['/company']);
  }

  return true;
};
