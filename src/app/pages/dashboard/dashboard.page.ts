import { Component, OnDestroy, OnInit } from '@angular/core';
import { SupabaseService } from '../../core/services/supabase.service';
import { UiService } from '../../core/services/ui.service';

type DashboardMode = 'public' | 'employee' | 'company';

type DashboardStat = {
  label: string;
  value: string | number;
  icon: string;
};

type RecentRequest = {
  id: string;
  topic: string;
  status: string;
  channel: string;
  created_at: string;
};

type FeaturedResource = {
  id: string;
  title: string;
  category: string;
  summary: string | null;
  external_url: string | null;
};

type UpcomingEvent = {
  id: string;
  title: string;
  starts_at: string | null;
  format: string;
  location: string | null;
  join_url: string | null;
};

type EmployeeCareIntakeDraft = {
  careType: string;
  careReceiverAge: number | null;
  primaryCondition: string;
  dependencyLevel: string;
  city: string;
  postalCode: string;
  supportNetwork: string;
  budgetMonthlyMax: number | null;
  funding: string;
  preferredContact: string;
  urgency: string;
  caregiverName: string;
  caregiverRelation: string;
  notes: string;
  amenities: { ensuite: boolean; garden: boolean; library: boolean; pets: boolean };
};

@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.page.html',
  styleUrls: ['./dashboard.page.scss'],
})
export class DashboardPage implements OnInit, OnDestroy {
  public loading = true;
  public mode: DashboardMode = 'public';
  public displayName = 'Usuario';
  public companyName: string | null = null;

  public stats: DashboardStat[] = [];
  public recentRequests: RecentRequest[] = [];
  public featuredResources: FeaturedResource[] = [];
  public upcomingEvents: UpcomingEvent[] = [];

  public employeeCareIntakeOpen = false;
  public employeeCareIntakeId: string | null = null;
  public employeeCompanyId: string | null = null;
  public employeeCareIntakeUpdatedAt: string | null = null;
  public employeeCareIntakeDraft: EmployeeCareIntakeDraft = this.createDefaultCareIntakeDraft();

  private unsub?: { data: { subscription: { unsubscribe: () => void } } };

  constructor(
    private readonly supabase: SupabaseService,
    public readonly ui: UiService,
  ) {}

  public ngOnInit(): void {
    void this.refresh();
    this.unsub = this.supabase.client.auth.onAuthStateChange(() => void this.refresh());
  }

  public ngOnDestroy(): void {
    this.unsub?.data.subscription.unsubscribe();
  }

  public async refresh(): Promise<void> {
    this.loading = true;
    this.companyName = null;
    this.stats = [];
    this.recentRequests = [];
    this.featuredResources = [];
    this.upcomingEvents = [];
    this.employeeCareIntakeId = null;
    this.employeeCompanyId = null;
    this.employeeCareIntakeUpdatedAt = null;
    this.employeeCareIntakeOpen = false;
    this.employeeCareIntakeDraft = this.createDefaultCareIntakeDraft();

    const { data: sessionData } = await this.supabase.client.auth.getSession();
    const user = sessionData.session?.user;

    if (!user) {
      this.mode = 'public';
      this.displayName = 'Usuario';
      this.loading = false;
      return;
    }

    const { data: profile } = await this.supabase.client
      .from('profiles')
      .select('full_name, role')
      .eq('id', user.id)
      .maybeSingle();

    const role = (profile?.role ?? 'employee') as string;
    this.displayName = profile?.full_name?.trim() ? profile.full_name : 'Usuario';
    this.mode = role === 'admin' || role === 'company_admin' ? 'company' : 'employee';

    const company = await this.getMyCompany(user.id);
    this.companyName = company?.name ?? null;

    if (this.mode === 'company') {
      await this.loadCompanyDashboard(company?.id ?? null);
    } else {
      this.employeeCompanyId = company?.id ?? null;
      await this.loadEmployeeDashboard(user.id, company?.id ?? null);
    }

    this.loading = false;
  }

  private async getMyCompany(userId: string): Promise<{ id: string; name: string } | null> {
    const { data: membership } = await this.supabase.client
      .from('company_members')
      .select('company_id')
      .eq('user_id', userId)
      .maybeSingle();

    const companyId = (membership?.company_id as string | undefined) ?? null;
    if (!companyId) return null;

    const { data: company } = await this.supabase.client
      .from('companies')
      .select('id, name')
      .eq('id', companyId)
      .maybeSingle();

    if (!company?.id) return null;
    return { id: company.id as string, name: company.name as string };
  }

  public openEmployeeCareIntake(): void {
    this.employeeCareIntakeOpen = true;
  }

  public closeEmployeeCareIntake(): void {
    this.employeeCareIntakeOpen = false;
  }

  public careTypeLabel(value: string | null | undefined): string {
    const map: Record<string, string> = {
      guidance:    'Orientación general',
      home_care:   'Cuidados a domicilio',
      residential: 'Hotel para mascotas',
      nursing:     'Enfermería',
      dementia:    'Demencia / Alzheimer',
      respite:     'Cuidado de respiro',
    };
    return map[value ?? ''] ?? value ?? 'Sin perfil';
  }

  public dependencyLevelLabel(value: string | null | undefined): string {
    const map: Record<string, string> = {
      low:    'Baja',
      medium: 'Media',
      high:   'Alta',
      full:   'Dependencia total',
    };
    return map[value ?? ''] ?? value ?? 'Sin dato';
  }

  public preferredContactLabel(value: string | null | undefined): string {
    const map: Record<string, string> = {
      chat:  'Chat',
      phone: 'Llamada',
      video: 'Videollamada',
    };
    return map[value ?? ''] ?? value ?? 'Sin dato';
  }

  public async saveEmployeeCareIntake(): Promise<void> {
    const userId = (await this.supabase.client.auth.getSession()).data.session?.user?.id ?? null;
    if (!userId) return;

    if (!this.employeeCompanyId) {
      alert('No encontramos una empresa asociada a tu usuario.');
      return;
    }

    this.loading = true;
    try {
      const payload = {
        care_type: this.employeeCareIntakeDraft.careType,
        care_receiver: {
          age: this.employeeCareIntakeDraft.careReceiverAge,
          primary_condition: this.employeeCareIntakeDraft.primaryCondition.trim() || null,
          dependency_level: this.employeeCareIntakeDraft.dependencyLevel,
        },
        location: {
          city: this.employeeCareIntakeDraft.city.trim() || null,
          postal_code: this.employeeCareIntakeDraft.postalCode.trim() || null,
        },
        family_context: {
          support_network: this.employeeCareIntakeDraft.supportNetwork.trim() || null,
        },
        budget: {
          monthly_max: this.employeeCareIntakeDraft.budgetMonthlyMax,
          funding: this.employeeCareIntakeDraft.funding,
        },
        preferences: {
          preferred_contact: this.employeeCareIntakeDraft.preferredContact,
        },
        urgency: this.employeeCareIntakeDraft.urgency,
        caregiver: {
          name: this.employeeCareIntakeDraft.caregiverName.trim() || null,
          relation: this.employeeCareIntakeDraft.caregiverRelation.trim() || null,
          company: this.companyName || null,
        },
        notes: this.employeeCareIntakeDraft.notes.trim() || null,
      };

      const query = this.employeeCareIntakeId
        ? this.supabase.client
            .from('care_intakes')
            .update({ payload })
            .eq('id', this.employeeCareIntakeId)
        : this.supabase.client.from('care_intakes').insert({
            company_id: this.employeeCompanyId,
            employee_id: userId,
            created_by: userId,
            payload,
          } as any);

      const { error } = await query;
      if (error) throw error;

      if (!this.employeeCareIntakeId && this.employeeCompanyId) {
        try {
          const profileRes = await this.supabase.client
            .from('profiles')
            .select('full_name')
            .eq('id', userId)
            .maybeSingle();

          const userName = profileRes.data?.full_name || 'Empleado';
          const careType = this.careTypeLabel(this.employeeCareIntakeDraft.careType);

          await this.supabase.client.functions.invoke('hubspot-integration', {
            body: {
              action: 'create_deal',
              companyId: this.employeeCompanyId,
              dealname: `Solicitud: ${userName} (${careType})`,
              employee_id: userId,
              comuna: this.employeeCareIntakeDraft.city,
              dependency: this.employeeCareIntakeDraft.dependencyLevel,
            },
          });
        } catch (hubspotErr) {
          console.warn('No se pudo sincronizar con HubSpot:', hubspotErr);
        }
      }

      await this.loadEmployeeCareIntake(userId);
      this.employeeCareIntakeOpen = false;
    } catch (err: any) {
      alert(`No se pudo guardar tu ficha: ${err?.message ?? String(err)}`);
    } finally {
      this.loading = false;
    }
  }

  private async loadEmployeeDashboard(userId: string, companyId: string | null): Promise<void> {
    const nowIso = new Date().toISOString();

    const [
      openRequests,
      providersCount,
      resourcesCount,
      vouchersCount,
      recentRequests,
      featuredResources,
      upcomingEvents,
    ] = await Promise.all([
      this.supabase.client
        .from('care_requests')
        .select('id', { count: 'exact', head: true })
        .eq('employee_id', userId)
        .in('status', ['open', 'assigned', 'in_progress']),
      this.supabase.client
        .from('providers')
        .select('id', { count: 'exact', head: true })
        .eq('active', true),
      this.supabase.client.from('resources').select('id', { count: 'exact', head: true }),
      this.supabase.client
        .from('vouchers')
        .select('id', { count: 'exact', head: true })
        .eq('active', true),
      this.supabase.client
        .from('care_requests')
        .select('id, topic, status, channel, created_at')
        .eq('employee_id', userId)
        .order('created_at', { ascending: false })
        .limit(5),
      this.supabase.client
        .from('resources')
        .select('id, title, category, summary, external_url, published_at, is_featured')
        .order('is_featured', { ascending: false })
        .order('published_at', { ascending: false })
        .limit(4),
      this.supabase.client
        .from('training_events')
        .select('id, title, starts_at, format, location, join_url')
        .gte('starts_at', nowIso)
        .order('starts_at', { ascending: true })
        .limit(3),
    ]);

    this.stats = [
      { label: 'Solicitudes abiertas',  value: openRequests.count ?? 0,   icon: 'forum' },
      { label: 'Proveedores activos',   value: providersCount.count ?? 0, icon: 'verified_user' },
      { label: 'Recursos',              value: resourcesCount.count ?? 0, icon: 'library_books' },
      { label: 'Vouchers disponibles',  value: vouchersCount.count ?? 0,  icon: 'local_activity' },
    ];

    this.recentRequests   = (recentRequests.data   ?? []) as RecentRequest[];
    this.featuredResources = (featuredResources.data ?? []) as FeaturedResource[];
    this.upcomingEvents    = (upcomingEvents.data   ?? []) as UpcomingEvent[];

    if (companyId) {
      await this.loadEmployeeCareIntake(userId);
    }
  }

  private async loadCompanyDashboard(companyId: string | null): Promise<void> {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    const [employeesCount, vouchersCount, onboardingDone, analytics7d] = await Promise.all([
      companyId
        ? this.supabase.client
            .from('company_members')
            .select('user_id', { count: 'exact', head: true })
            .eq('company_id', companyId)
        : Promise.resolve({ count: 0 } as { count: number | null }),
      companyId
        ? this.supabase.client
            .from('vouchers')
            .select('id', { count: 'exact', head: true })
            .eq('company_id', companyId)
            .eq('active', true)
        : Promise.resolve({ count: 0 } as { count: number | null }),
      companyId
        ? this.supabase.client
            .from('company_onboarding')
            .select('id', { count: 'exact', head: true })
            .eq('company_id', companyId)
            .eq('status', 'done')
        : Promise.resolve({ count: 0 } as { count: number | null }),
      companyId
        ? this.supabase.client
            .from('analytics_events')
            .select('id', { count: 'exact', head: true })
            .eq('company_id', companyId)
            .gte('created_at', sevenDaysAgo)
        : Promise.resolve({ count: 0 } as { count: number | null }),
    ]);

    this.stats = [
      { label: 'Empleados (empresa)',  value: employeesCount.count ?? 0,  icon: 'group' },
      { label: 'Vouchers activos',     value: vouchersCount.count ?? 0,   icon: 'local_activity' },
      { label: 'Onboarding listo',     value: onboardingDone.count ?? 0,  icon: 'task_alt' },
      { label: 'Eventos (7 días)',      value: analytics7d.count ?? 0,    icon: 'analytics' },
    ];

    const [{ data: recent }, { data: resources }, { data: events }] = await Promise.all([
      this.supabase.client
        .from('care_requests')
        .select('id, topic, status, channel, created_at')
        .order('created_at', { ascending: false })
        .limit(5),
      this.supabase.client
        .from('resources')
        .select('id, title, category, summary, external_url, published_at, is_featured')
        .order('is_featured', { ascending: false })
        .order('published_at', { ascending: false })
        .limit(4),
      this.supabase.client
        .from('training_events')
        .select('id, title, starts_at, format, location, join_url')
        .order('starts_at', { ascending: true })
        .limit(3),
    ]);

    this.recentRequests    = (recent     ?? []) as RecentRequest[];
    this.featuredResources = (resources  ?? []) as FeaturedResource[];
    this.upcomingEvents    = (events     ?? []) as UpcomingEvent[];
  }

  private async loadEmployeeCareIntake(userId: string): Promise<void> {
    const { data, error } = await this.supabase.client
      .from('care_intakes')
      .select('id, payload, updated_at, created_at')
      .eq('employee_id', userId)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw error;
    if (!data?.id) {
      this.employeeCareIntakeId = null;
      this.employeeCareIntakeUpdatedAt = null;
      this.employeeCareIntakeDraft = this.createDefaultCareIntakeDraft();
      return;
    }

    const p = (data.payload as any) ?? {};
    this.employeeCareIntakeId = data.id as string;
    this.employeeCareIntakeUpdatedAt =
      (data.updated_at as string | undefined) ?? (data.created_at as string | undefined) ?? null;

    this.employeeCareIntakeDraft = {
      careType:         p?.care_type ?? p?.clinical_profile ?? 'guidance',
      careReceiverAge:  p?.care_receiver?.age ?? p?.family?.age ?? null,
      primaryCondition: p?.care_receiver?.primary_condition ?? '',
      dependencyLevel:  p?.care_receiver?.dependency_level ?? 'medium',
      city:             p?.location?.city ?? p?.location?.comuna ?? '',
      postalCode:       p?.location?.postal_code ?? '',
      supportNetwork:   p?.family_context?.support_network ?? '',
      budgetMonthlyMax: p?.budget?.monthly_max ?? p?.budget?.weekly_max ?? null,
      funding:          p?.budget?.funding ?? 'self_funder',
      preferredContact: p?.preferences?.preferred_contact ?? 'chat',
      urgency:          p?.urgency ?? 'immediate',
      caregiverName:    p?.caregiver?.name ?? '',
      caregiverRelation:p?.caregiver?.relation ?? '',
      notes:            p?.notes ?? '',
      amenities:        { ensuite: false, garden: false, library: false, pets: false },
    };
  }

  private createDefaultCareIntakeDraft(): EmployeeCareIntakeDraft {
    return {
      careType:         'guidance',
      careReceiverAge:  null,
      primaryCondition: '',
      dependencyLevel:  'medium',
      city:             '',
      postalCode:       '',
      supportNetwork:   '',
      budgetMonthlyMax: null,
      funding:          'self_funder',
      preferredContact: 'chat',
      urgency:          'immediate',
      caregiverName:    '',
      caregiverRelation:'',
      notes:            '',
      amenities:        { ensuite: false, garden: false, library: false, pets: false },
    };
  }
}
