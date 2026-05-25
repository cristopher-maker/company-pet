import { LOCALE_ID, NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { RouteReuseStrategy } from '@angular/router';
import { registerLocaleData } from '@angular/common';
import localeEsCl from '@angular/common/locales/es-CL';
import { MatIconModule } from '@angular/material/icon';

import { AppComponent } from './app.component';
import { AppRoutingModule } from './app-routing.module';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';

registerLocaleData(localeEsCl);

@NgModule({
  declarations: [AppComponent],
  imports: [BrowserModule, AppRoutingModule, MatIconModule],
  providers: [{ provide: LOCALE_ID, useValue: 'es-CL' }, provideAnimationsAsync()],
  bootstrap: [AppComponent],
})
export class AppModule {}
