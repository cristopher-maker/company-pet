import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { AdminDashboardComponent } from './admin-dashboard.component';
import { MatIconModule } from '@angular/material/icon';

const routes: Routes = [{ path: '', component: AdminDashboardComponent }];

@NgModule({
  imports: [RouterModule.forChild(routes), MatIconModule],
  exports: [RouterModule]
})
export class AdminDashboardRoutingModule { }
