import { Component, OnDestroy } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Subscription } from 'rxjs';

import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-register',
  templateUrl: './register.page.html',
  styleUrls: ['./register.page.scss'],
})
export class RegisterPage implements OnDestroy {
  public fullName = '';
  public email = '';
  public password = '';
  public showPassword = false;
  public loading = false;
  public error: string | null = null;
  public success: string | null = null;

  public selectedRole: 'company_admin' | 'employee' | 'cuidador' = 'company_admin';
  public tipoCuidador: string = 'cuidador_domiciliario';
  public companyName = '';
  public companyTaxId = '';

  private readonly sessionSub: Subscription;

  constructor(
    private readonly auth: AuthService,
    private readonly router: Router,
    private readonly route: ActivatedRoute
  ) {
    this.sessionSub = this.route.queryParamMap.subscribe((params) => {
      const roleParam = params.get('role');
      if (roleParam === 'company' || roleParam === 'company_admin') {
        this.selectedRole = 'company_admin';
      } else if (roleParam === 'cuidador') {
        this.selectedRole = 'cuidador';
      } else if (roleParam === 'employee') {
        this.selectedRole = 'employee';
      }
    });
  }

  public ngOnDestroy(): void {
    this.sessionSub.unsubscribe();
  }

  public async submit(): Promise<void> {
    this.error = null;
    this.success = null;
    this.loading = true;

    try {
      const email = this.email.trim();
      const passwordRaw = (this.password ?? '').toString();
      const password = passwordRaw.trim();
      const fullName = this.fullName.trim();

      if (!email) throw new Error('Ingresa tu email.');
      if (!fullName) throw new Error('Ingresa tu nombre y apellido.');
      if (!password) throw new Error('Ingresa una contraseña.');
      if (password.length < 6) throw new Error('La contraseña debe tener al menos 6 caracteres.');

      if (this.selectedRole === 'company_admin' && !this.companyName.trim()) {
        throw new Error('Ingresa el nombre de tu empresa.');
      }

      const meta: Record<string, string> = {
        full_name: fullName,
        role: this.selectedRole,
      };

      if (this.selectedRole === 'company_admin') {
        meta['company_name'] = this.companyName.trim();
        meta['company_tax_id'] = this.companyTaxId.trim();
      }
      if (this.selectedRole === 'cuidador') {
        meta['tipo_cuidador'] = this.tipoCuidador;
      }

      const { data, error } = await this.auth.signUpWithMeta(email, password, meta);
      if (error) throw error;

      if (!data.session) {
        this.auth.savePendingRegistration({
          role: this.selectedRole,
          fullName,
          companyName: this.selectedRole === 'company_admin' ? this.companyName.trim() : null,
          companyTaxId: this.selectedRole === 'company_admin' ? this.companyTaxId.trim() : null,
          tipoCuidador: this.selectedRole === 'cuidador' ? this.tipoCuidador : null,
        });

        this.success =
          'Cuenta creada. Revisa tu email, inicia sesión para completar la configuración.';
        return;
      }

      await this.auth.completeRegistration({
        role: this.selectedRole,
        fullName,
        companyName: this.selectedRole === 'company_admin' ? this.companyName.trim() : null,
        companyTaxId: this.selectedRole === 'company_admin' ? this.companyTaxId.trim() : null,
        tipoCuidador: this.selectedRole === 'cuidador' ? this.tipoCuidador : null,
      });

      const defaultUrl =
        this.selectedRole === 'company_admin' ? '/company' : '/dashboard';
      await this.router.navigateByUrl(defaultUrl);
    } catch (e: any) {
      this.error = e?.message ?? 'No se pudo crear la cuenta.';
    } finally {
      this.loading = false;
    }
  }
}
