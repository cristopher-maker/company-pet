import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';

import { CompanyPageRoutingModule } from './company-routing.module';
import { CompanyPage } from './company.page';
import { SiteHeaderComponent } from '../../shared/components/site-header/site-header.component';
import { SiteFooterComponent } from '../../shared/components/site-footer/site-footer.component';

@NgModule({
  imports: [
    CommonModule, 
    FormsModule, 
    CompanyPageRoutingModule,
    MatIconModule,
    SiteHeaderComponent,
    SiteFooterComponent,
  ],
  declarations: [CompanyPage],
})
export class CompanyPageModule {}
