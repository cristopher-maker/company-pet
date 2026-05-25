import { Component, HostListener, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router, NavigationEnd } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { filter } from 'rxjs/operators';

import { AuthService } from '../../../core/services/auth.service';
import { UiService } from '../../../core/services/ui.service';

@Component({
  selector: 'app-site-header',
  standalone: true,
  imports: [CommonModule, RouterModule, MatIconModule],
  templateUrl: './site-header.component.html',
  styleUrls: ['./site-header.component.scss'],
})
export class SiteHeaderComponent implements OnInit {
  isScrolled = false;
  isTransparentPage = false;
  isLightPage = false;

  constructor(
    public readonly auth: AuthService,
    public readonly ui: UiService,
    private router: Router
  ) {}

  ngOnInit() {
    this.checkIfTransparent(this.router.url);

    this.router.events
      .pipe(filter((event) => event instanceof NavigationEnd))
      .subscribe((event: any) => {
        this.checkIfTransparent(event.urlAfterRedirects);
      });
  }

  private checkIfTransparent(url: string) {
    this.isTransparentPage = url.includes('/home') || url === '/';
    this.isLightPage = false;
  }

  public async scrollTo(sectionId: string, event?: Event): Promise<void> {
    event?.preventDefault();

    if (!this.router.url.includes('/home')) {
      await this.router.navigateByUrl('/home');
      setTimeout(() => this.scrollToElement(sectionId), 0);
      return;
    }

    this.scrollToElement(sectionId);
  }

  private scrollToElement(sectionId: string): void {
    document.getElementById(sectionId)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  @HostListener('window:scroll', [])
  onWindowScroll() {
    this.isScrolled = window.scrollY > 50;
  }
}
