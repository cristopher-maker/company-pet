import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';

import { CompanyPageRoutingModule } from './company-routing.module';
import { CompanyPage } from './company.page';
import { AdminDashboardModule } from '../admin-dashboard/admin-dashboard.module';

@NgModule({
  imports: [
    CommonModule, 
    FormsModule, 
    CompanyPageRoutingModule,
    MatIconModule,
    AdminDashboardModule
  ],
  declarations: [CompanyPage],
})
export class CompanyPageModule {}
