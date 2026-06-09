import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { ServicioEnCursoPageRoutingModule } from './servicio-en-curso-routing.module';

import { MatIconModule } from '@angular/material/icon';
import { SiteHeaderComponent } from '../../shared/components/site-header/site-header.component';
import { SiteFooterComponent } from '../../shared/components/site-footer/site-footer.component';

import { ServicioEnCursoPage } from './servicio-en-curso.page';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    ServicioEnCursoPageRoutingModule,
    MatIconModule,
    SiteHeaderComponent,
    SiteFooterComponent,
  ],
  declarations: [ServicioEnCursoPage],
})
export class ServicioEnCursoPageModule {}
