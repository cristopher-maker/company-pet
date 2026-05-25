import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';

import { HomePageRoutingModule } from './home-routing.module';
import { HomePage } from './home.page';
import { SiteHeaderComponent } from '../../shared/components/site-header/site-header.component';
import { SiteFooterComponent } from '../../shared/components/site-footer/site-footer.component';

@NgModule({
  imports: [CommonModule, FormsModule, HomePageRoutingModule, SiteHeaderComponent, SiteFooterComponent, MatIconModule],
  declarations: [HomePage],
})
export class HomePageModule {}
