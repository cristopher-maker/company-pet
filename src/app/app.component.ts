import { Component, OnDestroy } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { Subscription } from 'rxjs';

import { AuthService, ProfileRole } from './core/services/auth.service';
import { SupabaseService } from './core/services/supabase.service';
import { UiService } from './core/services/ui.service';

type AppPage = { title: string; url: string; icon: string; queryParams?: Record<string, string> };

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
})
export class AppComponent implements OnDestroy {
  public readonly appTitle = 'Company Pet';
  public isMenuOpen = false;
  public profileRole: ProfileRole | null = null;
  public hasBenefitAccess = false;

  private readonly primaryPageUrls = new Set([
    '/home',
    '/admin',
    '/dashboard',
    '/community',
    '/care-experts',
    '/resources',
    '/training',
    '/requests',
    '/vouchers',
    '/company',
  ]);

  private menuSub: Subscription;

  public readonly appPages: AppPage[] = [
    { title: 'Inicio', url: '/home', icon: 'home' },
    { title: 'Admin interno', url: '/admin', icon: 'admin_panel_settings' },
    { title: 'Portal Company Pet', url: '/dashboard', icon: 'dashboard' },
    { title: 'Comunidad', url: '/community', icon: 'forum' },
    { title: 'Pet Experts', url: '/care-experts', icon: 'support_agent' },
    { title: 'Centro de recursos', url: '/resources', icon: 'library_books' },
    { title: 'Formacion pet', url: '/training', icon: 'school' },
    { title: 'Solicitudes', url: '/requests', icon: 'content_paste' },
    { title: 'Beneficios', url: '/vouchers', icon: 'payments' },
    { title: 'Mi empresa', url: '/company', icon: 'business' },
    { title: 'Perfil', url: '/profile', icon: 'account_circle' },
  ];

  public readonly employeePages: AppPage[] = [
    { title: 'Inicio', url: '/home', icon: 'home' },
    { title: 'Portal Company Pet', url: '/dashboard', icon: 'dashboard' },
    { title: 'Comunidad', url: '/community', icon: 'forum' },
    { title: 'Pet Experts', url: '/care-experts', icon: 'support_agent' },
    { title: 'Centro de recursos', url: '/resources', icon: 'library_books' },
    { title: 'Formacion pet', url: '/training', icon: 'school' },
    { title: 'Mis solicitudes', url: '/requests', icon: 'content_paste' },
    { title: 'Beneficios', url: '/vouchers', icon: 'payments' },
    { title: 'Perfil', url: '/profile', icon: 'account_circle' },
  ];

  public readonly companyAdminPages: AppPage[] = [
    { title: 'Inicio', url: '/home', icon: 'home' },
    { title: 'Panel empresa', url: '/dashboard', icon: 'dashboard' },
    { title: 'ERP empresa', url: '/admin', icon: 'space_dashboard' },
    { title: 'Clientes y mascotas', url: '/company', icon: 'pets' },
    { title: 'Solicitudes del equipo', url: '/requests', icon: 'content_paste' },
    { title: 'Beneficios y vouchers', url: '/vouchers', icon: 'payments' },
    { title: 'Perfil', url: '/profile', icon: 'account_circle' },
  ];

  public readonly cuidadorPages: AppPage[] = [
    { title: 'Inicio', url: '/home', icon: 'home' },
    { title: 'Portal cuidador', url: '/dashboard', icon: 'dashboard' },
    { title: 'Solicitudes', url: '/requests', icon: 'content_paste' },
    { title: 'Recursos', url: '/resources', icon: 'library_books' },
    { title: 'Beneficios', url: '/vouchers', icon: 'payments' },
    { title: 'Perfil', url: '/profile', icon: 'account_circle' },
  ];

  public readonly careExpertPages: AppPage[] = [
    { title: 'Inicio', url: '/home', icon: 'home' },
    { title: 'Inbox Pet Experts', url: '/care-experts', icon: 'forum' },
    { title: 'Comunidad', url: '/community', icon: 'forum' },
    { title: 'Formacion', url: '/training', icon: 'school' },
    { title: 'Recursos digitales', url: '/resources', icon: 'library_books' },
    { title: 'Perfil', url: '/profile', icon: 'account_circle' },
  ];

  constructor(
    public readonly auth: AuthService,
    private readonly supabase: SupabaseService,
    private readonly router: Router,
    public readonly ui: UiService
  ) {
    this.auth.session$.subscribe(() => void this.refreshRole());
    this.router.events.subscribe((event) => {
      if (event instanceof NavigationEnd) {
        this.ui.closeMenu();
      }
    });
    this.menuSub = this.ui.menuOpen$.subscribe((isOpen) => (this.isMenuOpen = isOpen));
  }

  public ngOnDestroy(): void {
    this.menuSub.unsubscribe();
  }

  public get visiblePages(): AppPage[] {
    const isAdmin = this.profileRole === 'admin';
    const isCompany = this.profileRole === 'company_admin' || this.profileRole === 'manager';
    const isCareExpert = this.profileRole === 'pet_expert';
    const isEmployee = this.profileRole === 'employee';
    const isCuidador = this.profileRole === 'cuidador';

    if (isAdmin) {
      return this.appPages;
    }

    if (isCompany) {
      return this.companyAdminPages;
    }

    if (isCareExpert) {
      return this.careExpertPages;
    }

    if (isCuidador) {
      return this.cuidadorPages;
    }

    if (isEmployee) {
      return this.employeePages;
    }

    const publicUrls = new Set(['/home']);
    return this.appPages.filter((page) => publicUrls.has(page.url));
  }

  public get primaryPages(): AppPage[] {
    return this.visiblePages.filter((page) => this.primaryPageUrls.has(page.url));
  }

  public get secondaryPages(): AppPage[] {
    return this.visiblePages.filter((page) => !this.primaryPageUrls.has(page.url));
  }

  public closeMenu(): void {
    this.ui.closeMenu();
  }

  public async authAction(): Promise<void> {
    if (this.auth.user) {
      await this.auth.signOut();
      this.profileRole = null;
      this.hasBenefitAccess = false;
      await this.router.navigateByUrl('/home');
      return;
    }

    await this.router.navigateByUrl('/login');
  }

  private async refreshRole(): Promise<void> {
    if (!this.auth.user) {
      this.profileRole = null;
      this.hasBenefitAccess = false;
      return;
    }

    try {
      this.profileRole = await this.auth.getCurrentProfileRole();
      this.hasBenefitAccess = await this.loadBenefitAccess();
    } catch {
      this.profileRole = null;
      this.hasBenefitAccess = false;
    }
  }

  private async loadBenefitAccess(): Promise<boolean> {
    if (!this.auth.user) return false;
    if (this.profileRole === 'admin' || this.profileRole === 'pet_expert') return true;
    if (this.profileRole === 'cuidador') return true;

    const { data: membership, error: membershipError } = await this.supabase.client
      .from('company_members')
      .select('company_id')
      .eq('user_id', this.auth.user.id)
      .maybeSingle();

    if (membershipError || !membership?.company_id) return false;

    const { data, error } = await this.supabase.client.rpc('can_company_use_benefits', {
      target_company_id: membership.company_id,
    });

    if (error) return false;
    return data === true;
  }
}
