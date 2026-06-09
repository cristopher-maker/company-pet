import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

import { ReportePage } from './reporte.page';

const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    redirectTo: '/tasks',
  },
  {
    path: ':reservaId',
    component: ReportePage,
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class ReportePageRoutingModule {}
