import { Component } from '@angular/core';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-reset-password',
  templateUrl: './reset-password.page.html',
  styleUrls: ['./reset-password.page.scss'],
})
export class ResetPasswordPage {
  public loading = false;
  public password = '';
  public confirmPassword = '';
  public error: string | null = null;
  public success: string | null = null;

  constructor(private readonly auth: AuthService) {}

  public async submit(): Promise<void> {
    if (this.password !== this.confirmPassword) {
      this.error = 'Las contraseñas no coinciden.';
      return;
    }
    if (this.password.length < 6) {
      this.error = 'La contraseña debe tener al menos 6 caracteres.';
      return;
    }

    this.loading = true;
    this.error = null;
    this.success = null;

    try {
      await this.auth.updateUserPassword(this.password);
      this.success = 'Tu contraseña ha sido actualizada con éxito.';
    } catch (err: any) {
      this.error = err?.message ?? 'No se pudo actualizar la contraseña.';
    } finally {
      this.loading = false;
    }
  }
}