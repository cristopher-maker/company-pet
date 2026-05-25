import { AfterViewInit, Component, HostListener, OnDestroy } from '@angular/core';

import { SupabaseService } from '../../core/services/supabase.service';
import { UiService } from '../../core/services/ui.service';

@Component({
  selector: 'app-home',
  templateUrl: './home.page.html',
  styleUrls: ['./home.page.scss'],
})
export class HomePage implements AfterViewInit, OnDestroy {
  public isNavScrolled = false;
  private stepsObserver?: IntersectionObserver;

  constructor(
    private readonly supabase: SupabaseService,
    public readonly ui: UiService
  ) {}

  @HostListener('window:scroll')
  public onWindowScroll(): void {
    this.isNavScrolled = window.scrollY > 80;
  }

  public ngAfterViewInit(): void {
    const cards = Array.from(document.querySelectorAll<HTMLElement>('.step-card'));

    if (!('IntersectionObserver' in window)) {
      cards.forEach((card) => card.classList.add('step-card--visible'));
      return;
    }

    this.stepsObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) {
            return;
          }

          entry.target.classList.add('step-card--visible');
          this.stepsObserver?.unobserve(entry.target);
        });
      },
      { threshold: 0.24, rootMargin: '0px 0px -80px' }
    );

    cards.forEach((card, index) => {
      card.style.setProperty('--step-delay', `${index * 90}ms`);
      this.stepsObserver?.observe(card);
    });
  }

  public ngOnDestroy(): void {
    this.stepsObserver?.disconnect();
  }

  public scrollTo(sectionId: string, event?: Event): void {
    event?.preventDefault();
    document.getElementById(sectionId)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}
