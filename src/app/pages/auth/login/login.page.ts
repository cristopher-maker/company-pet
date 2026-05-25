import { Component, OnDestroy } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Subscription } from 'rxjs';

import { AuthService } from '../../../core/services/auth.service';

type Mode = 'Ingresar' | 'Magic link';

@Component({
  selector: 'app-login',
  templateUrl: './login.page.html',
  styleUrls: ['./login.page.scss'],
})
export class LoginPage implements OnDestroy {
  public mode: Mode = 'Ingresar';
  public email = '';
  public password = '';
  public showPassword = false;
  public rememberMe = true;
  public loading = false;
  public error: string | null = null;
  public success: string | null = null;

  private readonly sessionSub: Subscription;

  constructor(
    private readonly auth: AuthService,
    private readonly router: Router,
    private readonly route: ActivatedRoute
  ) {
    this.sessionSub = this.auth.session$.subscribe((session) => {
      if (!session) return;

      void (async () => {
        await this.auth.completePendingRegistrationIfAny();
        const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl') ?? '/dashboard';
        await this.router.navigateByUrl(returnUrl);
      })();
    });
  }

  public ngOnDestroy(): void {
    this.sessionSub.unsubscribe();
  }

  public goRegister(): void {
    void this.router.navigate(['/register'], { queryParams: { role: 'employee' } });
  }

  public togglePasswordVisibility(): void {
    this.showPassword = !this.showPassword;
  }

  public async submit(): Promise<void> {
    this.error = null;
    this.success = null;
    this.loading = true;

    try {
      const email = this.email.trim();
      const password = this.password;

      if (!email) throw new Error('Ingresa tu email.');

      if (this.mode === 'Magic link') {
        const redirectTo = `${window.location.origin}/dashboard`;
        await this.auth.sendMagicLink(email, redirectTo);
        this.success = 'Te enviamos un link a tu email para ingresar.';
        return;
      }

      if (!password) throw new Error('Ingresa tu contraseña.');
      await this.auth.signInWithPassword(email, password);
    } catch (e: any) {
      this.error = e?.message ?? 'No se pudo ingresar.';
    } finally {
      this.loading = false;
    }
  }

  public async forgotPassword(): Promise<void> {
    this.error = null;
    this.success = null;

    try {
      const email = this.email.trim();
      if (!email) throw new Error('Ingresa tu email para enviarte el link.');

      const redirectTo = `${window.location.origin}/reset-password`;
      await this.auth.sendPasswordReset(email, redirectTo);
      this.success = 'Te enviamos un link para cambiar tu contraseña.';
    } catch (e: any) {
      this.error = e?.message ?? 'No se pudo enviar el link.';
    }
  }
}
