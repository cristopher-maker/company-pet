import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';

import { RequestsPageRoutingModule } from './requests-routing.module';
import { RequestsPage } from './requests.page';
import { SiteHeaderComponent } from '../../shared/components/site-header/site-header.component';
import { SiteFooterComponent } from '../../shared/components/site-footer/site-footer.component';

@NgModule({
  imports: [CommonModule, RequestsPageRoutingModule, MatIconModule, SiteHeaderComponent, SiteFooterComponent],
  declarations: [RequestsPage],
})
export class RequestsPageModule {}
