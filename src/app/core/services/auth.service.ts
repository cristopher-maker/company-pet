import { Injectable } from '@angular/core';
import type { Session, User } from '@supabase/supabase-js';
import { BehaviorSubject, Observable } from 'rxjs';

import { SupabaseService } from './supabase.service';

type RegisterRole = 'employee' | 'company_admin';

type PendingRegistration = {
  role: RegisterRole;
  fullName: string;
  companyName: string | null;
  companyTaxId: string | null;
  savedAt: number;
};

export type ProfileRole = 'employee' | 'admin' | 'company_admin' | 'manager' | 'pet_expert';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly sessionSubject = new BehaviorSubject<Session | null>(null);
  public readonly session$: Observable<Session | null> = this.sessionSubject.asObservable();

  private readonly pendingRegistrationKey = 'companypet:pendingRegistration:v1';

  constructor(private readonly supabase: SupabaseService) {
    void this.initSessionTracking();
  }

  public get session(): Session | null {
    return this.sessionSubject.value;
  }

  public get user(): User | null {
    return this.sessionSubject.value?.user ?? null;
  }

  private async initSessionTracking(): Promise<void> {
    const { data } = await this.supabase.client.auth.getSession();
    this.sessionSubject.next(data.session ?? null);

    this.supabase.client.auth.onAuthStateChange((_event, session) => {
      this.sessionSubject.next(session);
    });
  }

  public async signInWithPassword(email: string, password: string): Promise<void> {
    const { error } = await this.supabase.client.auth.signInWithPassword({ email, password });
    if (error) throw error;
  }

  public async signUp(email: string, password: string): Promise<void> {
    const { error } = await this.supabase.client.auth.signUp({ email, password });
    if (error) throw error;
  }

  public async signUpWithMeta(
    email: string,
    password: string,
    meta: { full_name?: string; role?: RegisterRole; company_name?: string }
  ): Promise<{ data: any; error: any }> {
    return await this.supabase.client.auth.signUp({
      email,
      password,
      options: { data: meta },
    });
  }

  public async sendMagicLink(email: string, redirectTo: string): Promise<void> {
    const { error } = await this.supabase.client.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: redirectTo },
    });
    if (error) throw error;
  }

  public async sendPasswordReset(email: string, redirectTo: string): Promise<void> {
    const { error } = await this.supabase.client.auth.resetPasswordForEmail(email, {
      redirectTo,
    });
    if (error) throw error;
  }

  public async updateUserPassword(password: string): Promise<void> {
    const { error } = await this.supabase.client.auth.updateUser({ password });
    if (error) throw error;
  }

  public async signOut(): Promise<void> {
    const { error } = await this.supabase.client.auth.signOut();
    if (error) throw error;
  }

  public async getCurrentProfileRole(): Promise<ProfileRole | null> {
    const user = this.user;
    if (!user) return null;

    const { data, error } = await this.supabase.client
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle();

    if (error) throw error;
    return (data?.role as ProfileRole | undefined) ?? null;
  }

  public savePendingRegistration(input: Omit<PendingRegistration, 'savedAt'>): void {
    try {
      const payload: PendingRegistration = { ...input, savedAt: Date.now() };
      window.localStorage.setItem(this.pendingRegistrationKey, JSON.stringify(payload));
    } catch {
      // ignore
    }
  }

  private loadPendingRegistration(): PendingRegistration | null {
    try {
      const raw = window.localStorage.getItem(this.pendingRegistrationKey);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as PendingRegistration;
      if (!parsed?.role || !parsed?.fullName) return null;
      return parsed;
    } catch {
      return null;
    }
  }

  private clearPendingRegistration(): void {
    try {
      window.localStorage.removeItem(this.pendingRegistrationKey);
    } catch {
      // ignore
    }
  }

  public async completePendingRegistrationIfAny(): Promise<void> {
    const pending = this.loadPendingRegistration();
    if (!pending) return;

    try {
      await this.completeRegistration({
        role: pending.role,
        fullName: pending.fullName,
        companyName: pending.companyName,
        companyTaxId: pending.companyTaxId,
      });
    } finally {
      this.clearPendingRegistration();
    }
  }

  public async completeRegistration(input: {
    role: RegisterRole;
    fullName: string;
    companyName: string | null;
    companyTaxId: string | null;
  }): Promise<void> {
    const { data: userData, error: userError } = await this.supabase.client.auth.getUser();
    if (userError) throw userError;
    const user = userData.user;
    if (!user) throw new Error('No hay sesión activa.');

    const fullName = input.fullName.trim();
    if (!fullName) throw new Error('Nombre inválido.');

    // 1) Ensure profile role + name.
    const { error: profileError } = await this.supabase.client
      .from('profiles')
      .update({ full_name: fullName, role: input.role })
      .eq('id', user.id);
    if (profileError) throw profileError;

    // 2) If company admin: ensure company + membership.
    if (input.role === 'company_admin') {
      const companyName = (input.companyName ?? '').trim();
      if (!companyName) throw new Error('Nombre de empresa inválido.');
      const companyTaxId = (input.companyTaxId ?? '').trim();
      if (!companyTaxId) throw new Error('RUT de empresa inválido.');
      await this.ensureCompanyMembership(user, companyName, companyTaxId);
    }
  }

  private async ensureCompanyMembership(user: User, companyName: string, companyTaxId: string): Promise<void> {
    const { data: membership } = await this.supabase.client
      .from('company_members')
      .select('company_id')
      .eq('user_id', user.id)
      .maybeSingle();

    const existingCompanyId = (membership?.company_id as string | undefined) ?? null;
    if (existingCompanyId) return;

    const { data: companyId, error } = await this.supabase.client.rpc('register_company_for_current_user', {
      company_name: companyName,
      company_tax_id: companyTaxId,
    });

    if (error) throw error;
    if (!companyId) {
      throw new Error('No se pudo crear la empresa.');
    }
  }
}
