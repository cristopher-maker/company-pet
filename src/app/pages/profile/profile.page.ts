import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';

import { AuthService, ProfileRole } from '../../core/services/auth.service';
import { UiService } from '../../core/services/ui.service';
import { SupabaseService } from '../../core/services/supabase.service';

@Component({
  selector: 'app-profile',
  templateUrl: './profile.page.html',
  styleUrls: ['./profile.page.scss'],
})
export class ProfilePage implements OnInit {
  public loading = true;
  public saving = false;
  public fullName = '';
  public company = '';
  public companyTaxId = '';
  public email = '';
  public role: ProfileRole | null = null;

  constructor(
    public readonly auth: AuthService,
    private readonly supabase: SupabaseService,
    private readonly router: Router,
    public readonly ui: UiService
  ) {}

  public async ngOnInit(): Promise<void> {
    await this.loadProfile();
  }

  public roleLabel(value: ProfileRole | null): string {
    switch (value) {
      case 'admin':
        return 'Admin';
      case 'company_admin':
        return 'Administrador empresa';
      case 'manager':
        return 'Manager';
      case 'pet_expert':
        return 'Pet Expert';
      case 'employee':
        return 'Empleado';
      default:
        return 'Sin rol';
    }
  }

  public async save(): Promise<void> {
    const userId = this.auth.user?.id;
    if (!userId) {
      await this.router.navigateByUrl('/login');
      return;
    }

    this.saving = true;
    try {
      const { error } = await this.supabase.client
        .from('profiles')
        .update({
          full_name: this.fullName.trim() || null,
          company: this.company.trim() || null,
        } as any)
        .eq('id', userId);
      if (error) throw error;
      alert('Perfil actualizado.');
    } catch (err: any) {
      alert(err?.message ?? 'No se pudo guardar el perfil.');
    } finally {
      this.saving = false;
    }
  }

  public async sendResetPassword(): Promise<void> {
    const email = this.email.trim();
    if (!email) return;

    try {
      const redirectTo = `${window.location.origin}/#/reset-password`;
      await this.auth.sendPasswordReset(email, redirectTo);
      alert('Te enviamos un correo para restablecer contraseña.');
    } catch (err: any) {
      alert(err?.message ?? 'No se pudo enviar el correo de recuperación.');
    }
  }

  private async loadProfile(): Promise<void> {
    const userId = this.auth.user?.id;
    if (!userId) {
      this.loading = false;
      await this.router.navigateByUrl('/login');
      return;
    }

    this.loading = true;
    try {
      const { data, error } = await this.supabase.client
        .from('profiles')
        .select('full_name, email, company, role')
        .eq('id', userId)
        .maybeSingle();
      if (error) throw error;

      this.fullName = (data?.full_name as string | undefined) ?? '';
      this.email = (data?.email as string | undefined) ?? this.auth.user?.email ?? '';
      this.company = (data?.company as string | undefined) ?? '';
      this.role = ((data?.role as ProfileRole | undefined) ?? null);

      const { data: membership } = await this.supabase.client
        .from('company_members')
        .select('company_id')
        .eq('user_id', userId)
        .maybeSingle();

      const companyId = (membership?.company_id as string | undefined) ?? null;
      if (companyId) {
        const { data: companyData } = await this.supabase.client
          .from('companies')
          .select('name, tax_id')
          .eq('id', companyId)
          .maybeSingle();

        if (companyData?.name && !this.company) {
          this.company = companyData.name as string;
        }
        this.companyTaxId = (companyData?.tax_id as string | undefined) ?? '';
      } else {
        this.companyTaxId = '';
      }
    } finally {
      this.loading = false;
    }
  }
}
