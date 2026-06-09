import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';

import { TrainingAdminPageRoutingModule } from './training-admin-routing.module';
import { TrainingAdminPage } from './training-admin.page';

@NgModule({
  imports: [CommonModule, FormsModule, MatIconModule, TrainingAdminPageRoutingModule],
  declarations: [TrainingAdminPage],
})
export class TrainingAdminPageModule {}

