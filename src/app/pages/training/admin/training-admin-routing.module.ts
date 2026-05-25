import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

import { TrainingAdminPage } from './training-admin.page';

const routes: Routes = [
  {
    path: '',
    component: TrainingAdminPage,
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class TrainingAdminPageRoutingModule {}

