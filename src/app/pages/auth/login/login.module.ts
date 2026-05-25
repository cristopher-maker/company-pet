import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';

import { LoginPageRoutingModule } from './login-routing.module';
import { LoginPage } from './login.page';

@NgModule({
  imports: [CommonModule, FormsModule, MatIconModule, LoginPageRoutingModule],
  declarations: [LoginPage],
})
export class LoginPageModule {}
