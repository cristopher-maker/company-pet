import { Component } from '@angular/core';
import { Router, RouterLink } from '@angular/router';

@Component({
  selector: 'app-site-footer',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './site-footer.component.html',
  styleUrls: ['./site-footer.component.scss'],
})
export class SiteFooterComponent {
  constructor(private readonly router: Router) {}

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
}
