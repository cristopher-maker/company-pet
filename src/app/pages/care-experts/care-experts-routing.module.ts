import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

import { CareExpertsPage } from './care-experts.page';

const routes: Routes = [
  {
    path: '',
    component: CareExpertsPage,
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class CareExpertsPageRoutingModule {}

