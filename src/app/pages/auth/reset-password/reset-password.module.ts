import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { ResetPasswordPageRoutingModule } from './reset-password-routing.module';
import { ResetPasswordPage } from './reset-password.page';

@NgModule({
  imports: [CommonModule, FormsModule, ResetPasswordPageRoutingModule],
  declarations: [ResetPasswordPage],
})
export class ResetPasswordPageModule {}
