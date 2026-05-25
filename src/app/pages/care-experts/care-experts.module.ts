import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';

import { CareExpertsPageRoutingModule } from './care-experts-routing.module';
import { CareExpertsPage } from './care-experts.page';
import { SiteHeaderComponent } from '../../shared/components/site-header/site-header.component';

@NgModule({
  imports: [CommonModule, FormsModule, MatIconModule, CareExpertsPageRoutingModule, SiteHeaderComponent],
  declarations: [CareExpertsPage],
})
export class CareExpertsPageModule {}