import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';

import { CompanyRequestsPageRoutingModule } from './company-requests-routing.module';
import { CompanyRequestsPage } from './company-requests.page';
import { SiteHeaderComponent } from '../../shared/components/site-header/site-header.component';

@NgModule({
  imports: [CommonModule, MatIconModule, CompanyRequestsPageRoutingModule, SiteHeaderComponent],
  declarations: [CompanyRequestsPage],
})
export class CompanyRequestsPageModule {}
