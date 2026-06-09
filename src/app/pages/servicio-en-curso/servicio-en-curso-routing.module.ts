import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

import { ServicioEnCursoPage } from './servicio-en-curso.page';

const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    redirectTo: '/tasks',
  },
  {
    path: ':reservaId',
    component: ServicioEnCursoPage,
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class ServicioEnCursoPageRoutingModule {}
