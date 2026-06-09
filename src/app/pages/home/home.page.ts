import { AfterViewInit, Component, HostListener, OnDestroy } from '@angular/core';

import { SupabaseService } from '../../core/services/supabase.service';
import { AuthService } from '../../core/services/auth.service';
import { UiService } from '../../core/services/ui.service';

@Component({
  selector: 'app-home',
  templateUrl: './home.page.html',
  styleUrls: ['./home.page.scss'],
})
export class HomePage implements AfterViewInit, OnDestroy {
  public isNavScrolled = false;
  public demoRequest = {
    full_name: '',
    company_name: '',
    work_email: '',
    phone: '',
    message: '',
  };
  public demoSubmitStatus: 'idle' | 'submitting' | 'success' | 'error' = 'idle';
  public demoSubmitMessage = '';
  private stepsObserver?: IntersectionObserver;

  constructor(
    private readonly supabase: SupabaseService,
    public readonly auth: AuthService,
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

  public async submitDemoRequest(): Promise<void> {
    if (this.demoSubmitStatus === 'submitting') {
      return;
    }

    this.demoSubmitStatus = 'submitting';
    this.demoSubmitMessage = '';

    const payload = {
      full_name: this.demoRequest.full_name.trim(),
      company_name: this.demoRequest.company_name.trim(),
      work_email: this.demoRequest.work_email.trim().toLowerCase(),
      phone: this.demoRequest.phone.trim() || null,
      message: this.demoRequest.message.trim() || null,
      source: 'landing',
    };

    const { error } = await this.supabase.client.from('demo_requests').insert(payload);

    if (error) {
      this.demoSubmitStatus = 'error';
      this.demoSubmitMessage = 'No pudimos enviar la solicitud. Intentalo nuevamente.';
      return;
    }

    this.demoRequest = {
      full_name: '',
      company_name: '',
      work_email: '',
      phone: '',
      message: '',
    };
    this.demoSubmitStatus = 'success';
    this.demoSubmitMessage = 'Solicitud enviada. Te contactaremos pronto.';
  }
}
