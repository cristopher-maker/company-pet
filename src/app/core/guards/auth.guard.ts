import { inject } from '@angular/core';
import { CanMatchFn, Router, UrlTree } from '@angular/router';

import { SupabaseService } from '../services/supabase.service';

export const authGuard: CanMatchFn = async (_route, segments): Promise<boolean | UrlTree> => {
  const supabase = inject(SupabaseService);
  const router = inject(Router);

  const { data, error } = await supabase.client.auth.getSession();
  if (error) return router.createUrlTree(['/login']);
  if (data.session) return true;

  const returnUrl = '/' + segments.map((s) => s.path).join('/');
  return router.createUrlTree(['/login'], { queryParams: { returnUrl } });
};

