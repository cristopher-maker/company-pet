import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';

import { TrainingPageRoutingModule } from './training-routing.module';
import { TrainingPage } from './training.page';
import { SiteHeaderComponent } from '../../shared/components/site-header/site-header.component';
import { SiteFooterComponent } from '../../shared/components/site-footer/site-footer.component';

@NgModule({
  imports: [CommonModule, FormsModule, MatIconModule, TrainingPageRoutingModule, SiteHeaderComponent, SiteFooterComponent],
  declarations: [TrainingPage],
})
export class TrainingPageModule {}
