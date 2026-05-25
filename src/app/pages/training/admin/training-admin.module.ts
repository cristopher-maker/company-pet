import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { TrainingAdminPageRoutingModule } from './training-admin-routing.module';
import { TrainingAdminPage } from './training-admin.page';

@NgModule({
  imports: [CommonModule, FormsModule, TrainingAdminPageRoutingModule],
  declarations: [TrainingAdminPage],
})
export class TrainingAdminPageModule {}
