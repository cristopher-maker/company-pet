import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';

import { ResourcesPageRoutingModule } from './resources-routing.module';
import { ResourcesPage } from './resources.page';
import { SiteHeaderComponent } from '../../shared/components/site-header/site-header.component';
import { SiteFooterComponent } from '../../shared/components/site-footer/site-footer.component';

@NgModule({
  imports: [CommonModule, MatIconModule, ResourcesPageRoutingModule, SiteHeaderComponent, SiteFooterComponent],
  declarations: [ResourcesPage],
})
export class ResourcesPageModule {}
