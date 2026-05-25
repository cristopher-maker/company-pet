import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

import { CompanyRequestsPage } from './company-requests.page';

const routes: Routes = [
  {
    path: '',
    component: CompanyRequestsPage,
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class CompanyRequestsPageRoutingModule {}
