import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { RouterModule } from '@angular/router';

import { CommunityPage } from './community.page';
import { CommunityRoutingModule } from './community-routing.module';
import { SiteHeaderComponent } from '../../shared/components/site-header/site-header.component';
import { SiteFooterComponent } from '../../shared/components/site-footer/site-footer.component';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    MatIconModule,
    RouterModule,
    CommunityRoutingModule,
    SiteHeaderComponent,
    SiteFooterComponent,
  ],
  declarations: [CommunityPage],
})
export class CommunityPageModule {}
