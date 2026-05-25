import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';

import { VouchersPageRoutingModule } from './vouchers-routing.module';
import { VouchersPage } from './vouchers.page';
import { SiteHeaderComponent } from '../../shared/components/site-header/site-header.component';
import { SiteFooterComponent } from '../../shared/components/site-footer/site-footer.component';

@NgModule({
  imports: [CommonModule, MatIconModule, VouchersPageRoutingModule, SiteHeaderComponent, SiteFooterComponent],
  declarations: [VouchersPage],
})
export class VouchersPageModule {}
