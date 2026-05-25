import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { ResourcesPageRoutingModule } from './resources-routing.module';
import { ResourcesPage } from './resources.page';

@NgModule({
  imports: [CommonModule, ResourcesPageRoutingModule],
  declarations: [ResourcesPage],
})
export class ResourcesPageModule {}
