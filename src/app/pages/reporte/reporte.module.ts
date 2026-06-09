import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { ReportePageRoutingModule } from './reporte-routing.module';

import { MatIconModule } from '@angular/material/icon';
import { SiteHeaderComponent } from '../../shared/components/site-header/site-header.component';
import { SiteFooterComponent } from '../../shared/components/site-footer/site-footer.component';

import { ReportePage } from './reporte.page';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    ReportePageRoutingModule,
    MatIconModule,
    SiteHeaderComponent,
    SiteFooterComponent,
  ],
  declarations: [ReportePage],
})
export class ReportePageModule {}
