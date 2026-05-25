import { Component, OnDestroy } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Subscription } from 'rxjs';

import { AuthService } from '../../../core/services/auth.service';

type RegisterRole = 'employee' | 'company_admin';

@Component({
  selector: 'app-register',
  templateUrl: './register.page.html',
  styleUrls: ['./register.page.scss'],
})
export class RegisterPage implements OnDestroy {
  public role: RegisterRole = 'employee';

  public fullName = '';
  public companyName = '';
  public companyRut = '';
  public email = '';
  public password = '';
  public showPassword = false;
  public loading = false;
  public error: string | null = null;
  public success: string | null = null;

  private readonly sessionSub: Subscription;

  constructor(
    private readonly auth: AuthService,
    private readonly router: Router,
    private readonly route: ActivatedRoute
  ) {
    this.setRoleFromQuery();

    this.sessionSub = this.route.queryParamMap.subscribe(() => {
      this.setRoleFromQuery();
    });
  }

  public ngOnDestroy(): void {
    this.sessionSub.unsubscribe();
  }

  private setRoleFromQuery(): void {
    const q = (this.route.snapshot.queryParamMap.get('role') ?? 'employee').toLowerCase();
    this.role = q === 'company' || q === 'company_admin' ? 'company_admin' : 'employee';
  }

  public async submit(): Promise<void> {
    this.error = null;
    this.success = null;
    this.loading = true;

    try {
      const email = this.email.trim();
      const passwordRaw = (this.password ?? '').toString();
      const password = passwordRaw.trim();
      let fullName = this.fullName.trim();
      const companyName = this.companyName.trim();
      const companyRut = this.normalizeRut(this.companyRut);

      if (!email) throw new Error('Ingresa tu email.');
      if (!password) throw new Error('Ingresa una contraseña.');
      if (password.length < 6) throw new Error('La contraseña debe tener al menos 6 caracteres.');

      if (this.role === 'company_admin') {
        if (!companyRut) throw new Error('Ingresa el RUT de la empresa.');
        if (!this.isRutValid(companyRut)) throw new Error('RUT inválido.');
        if (!companyName) throw new Error('Ingresa el nombre de tu empresa.');
        if (!fullName) fullName = `Admin ${companyName}`;
      } else {
        if (!fullName) throw new Error('Ingresa tu nombre.');
      }

      const { data, error } = await this.auth.signUpWithMeta(email, password, {
        full_name: fullName,
        role: this.role,
        company_name: this.role === 'company_admin' ? companyName : undefined,
      });
      if (error) throw error;

      if (!data.session) {
        this.auth.savePendingRegistration({
          role: this.role,
          fullName,
          companyName: this.role === 'company_admin' ? companyName : null,
          companyTaxId: this.role === 'company_admin' ? companyRut : null,
        });

        this.success =
          'Cuenta creada. Revisa tu email, inicia sesión para completar la configuración.';
        return;
      }

      await this.auth.completeRegistration({
        role: this.role,
        fullName,
        companyName: this.role === 'company_admin' ? companyName : null,
        companyTaxId: this.role === 'company_admin' ? companyRut : null,
      });

      await this.router.navigateByUrl('/dashboard');
    } catch (e: any) {
      this.error = e?.message ?? 'No se pudo crear la cuenta.';
    } finally {
      this.loading = false;
    }
  }

  private normalizeRut(value: string): string {
    return (value ?? '').toString().trim().toUpperCase().replace(/\./g, '').replace(/\s+/g, '');
  }

  private isRutValid(value: string): boolean {
    // Accept both 12345678-9 and 123456789 formats; validate with modulo 11.
    const cleaned = value.includes('-') ? value : value.replace(/^(\d+)([0-9K])$/, '$1-$2');
    const m = cleaned.match(/^(\d{7,8})-([0-9K])$/);
    if (!m) return false;

    const body = m[1];
    const dv = m[2];

    let sum = 0;
    let multiplier = 2;
    for (let i = body.length - 1; i >= 0; i--) {
      sum += Number(body[i]) * multiplier;
      multiplier = multiplier === 7 ? 2 : multiplier + 1;
    }

    const mod = 11 - (sum % 11);
    const expected = mod === 11 ? '0' : mod === 10 ? 'K' : String(mod);
    return expected === dv;
  }
}
