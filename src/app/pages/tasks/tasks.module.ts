import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { TasksPageRoutingModule } from './tasks-routing.module';

import { TasksPage } from './tasks.page';
import { MatIconModule } from '@angular/material/icon';
import { SiteHeaderComponent } from '../../shared/components/site-header/site-header.component';
import { SiteFooterComponent } from '../../shared/components/site-footer/site-footer.component';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    TasksPageRoutingModule,
    MatIconModule,
    SiteHeaderComponent,
    SiteFooterComponent
  ],
  declarations: [TasksPage]
})
export class TasksPageModule {}
