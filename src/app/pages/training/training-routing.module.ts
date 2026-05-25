import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

import { TrainingPage } from './training.page';

const routes: Routes = [
  {
    path: '',
    component: TrainingPage,
  },
  {
    path: 'admin',
    loadChildren: () =>
      import('./admin/training-admin.module').then((m) => m.TrainingAdminPageModule),
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class TrainingPageRoutingModule {}
