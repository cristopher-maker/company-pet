import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';

import { ProvidersPageRoutingModule } from './providers-routing.module';
import { ProvidersPage } from './providers.page';
import { SiteHeaderComponent } from '../../shared/components/site-header/site-header.component';
import { SiteFooterComponent } from '../../shared/components/site-footer/site-footer.component';

@NgModule({
  imports: [
    CommonModule, 
    FormsModule, 
    MatIconModule, 
    ProvidersPageRoutingModule,
    SiteHeaderComponent,
    SiteFooterComponent
  ],
  declarations: [ProvidersPage],
})
export class ProvidersPageModule {}
