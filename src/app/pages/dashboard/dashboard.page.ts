import { Component, OnDestroy, OnInit } from '@angular/core';
import { Router } from '@angular/router';
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
  petName: string;
  species: string;
  breed: string;
  birthDate: string;
  petPhotoUrl: string;
  careReceiverAge: number | null;
  sex: string;
  weightKg: number | null;
  neutered: string;
  microchipNumber: string;
  nationalRegistryNumber: string;
  vaccinesStatus: string;
  vaccineCardUrl: string;
  dataConsentAccepted: boolean;
  veterinaryClinicName: string;
  veterinaryClinicCommune: string;
  treatingVetName: string;
  treatingVetContact: string;
  chronicConditionsAllergies: string;
  currentMedications: string;
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
  public employeePetId: string | null = null;
  public employeeCompanyId: string | null = null;
  public employeeCareIntakeUpdatedAt: string | null = null;

  public benefitPlan: { name: string; monthlyAllowance: number; usedThisMonth: number; remaining: number } | null = null;
  public employeePets: { id: string; name: string; species: string; breed: string | null; pet_photo_url: string | null }[] = [];

  public inviteModalOpen = false;
  public inviteEmail = '';
  public inviteRole: 'employee' | 'hr_admin' | 'manager' = 'employee';
  public inviteSending = false;
  private companyId: string | null = null;

  public companyInfo: {
    name: string;
    legal_name: string;
    tax_id: string;
    address: string;
    phone: string;
    billing_email: string;
    industry: string;
    employee_count: number | null;
  } | null = null;

  public editingCompany = false;
  public companyForm: {
    name: string;
    legal_name: string;
    address: string;
    phone: string;
    billing_email: string;
    industry: string;
  } = { name: '', legal_name: '', address: '', phone: '', billing_email: '', industry: '' };

  public teamMembers: { user_id: string; full_name: string; email: string; member_role: string }[] = [];
  public pendingInvitations: { id: string; email: string; role: string; created_at: string }[] = [];
  public loadingTeam = false;
  public employeeCareIntakeDraft: EmployeeCareIntakeDraft = this.createDefaultCareIntakeDraft();
  public selectedPetPhotoFile: File | null = null;
  public selectedVaccineCardFile: File | null = null;
  public saveAndAddAnother = false;

  private unsub?: { data: { subscription: { unsubscribe: () => void } } };

  constructor(
    private readonly supabase: SupabaseService,
    private readonly router: Router,
    public readonly ui: UiService,
  ) {}

  public ngOnInit(): void {
    void this.refresh();
    this.unsub = this.supabase.client.auth.onAuthStateChange(() => void this.refresh());
  }

  public ngOnDestroy(): void {
    this.unsub?.data.subscription.unsubscribe();
  }

  public get calculatedPetAgeLabel(): string {
    const value = this.employeeCareIntakeDraft.birthDate;
    if (!value) return 'No disponible';

    const bd = new Date(`${value}T00:00:00`);
    if (Number.isNaN(bd.getTime())) return 'No disponible';

    const today = new Date();
    let months = (today.getFullYear() - bd.getFullYear()) * 12 + (today.getMonth() - bd.getMonth());
    if (today.getDate() < bd.getDate()) {
      months--;
    }
    if (months < 0) return 'Recién nacido';
    if (months < 12) {
      if (months === 0) {
        const diffDays = Math.ceil(Math.abs(today.getTime() - bd.getTime()) / (1000 * 60 * 60 * 24));
        return diffDays <= 1 ? '1 día' : `${diffDays} días`;
      }
      return months === 1 ? '1 mes' : `${months} meses`;
    }
    const y = Math.floor(months / 12);
    const m = months % 12;
    if (m === 0) return y === 1 ? '1 año' : `${y} años`;
    return `${y} ${y === 1 ? 'año' : 'años'} y ${m} ${m === 1 ? 'mes' : 'meses'}`;
  }

  public syncPetAgeFromBirthDate(): void {
    const age = this.calculateAgeFromBirthDate(this.employeeCareIntakeDraft.birthDate);
    if (age !== null) {
      this.employeeCareIntakeDraft.careReceiverAge = age;
    } else if (!this.employeeCareIntakeDraft.birthDate) {
      this.employeeCareIntakeDraft.careReceiverAge = null;
    }
  }

  public async refresh(): Promise<void> {
    this.loading = true;
    this.companyName = null;
    this.stats = [];
    this.recentRequests = [];
    this.featuredResources = [];
    this.upcomingEvents = [];
    this.employeeCareIntakeId = null;
    this.employeePetId = null;
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

    this.mode = role === 'cuidador' || role === 'admin' || role === 'company_admin' ? 'company' : 'employee';

    const company = await this.getMyCompany(user.id);
    this.companyName = company?.name ?? null;
    this.companyId = company?.id ?? null;

    if (this.mode === 'company') {
      await this.loadCompanyDashboard(this.companyId);
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

  private async syncEmployeeCompany(userId: string): Promise<void> {
    const company = await this.getMyCompany(userId);
    this.employeeCompanyId = company?.id ?? null;
    this.companyName = company?.name ?? this.companyName;
  }

  public openEmployeeCareIntake(): void {
    this.employeeCareIntakeOpen = true;
  }

  public closeEmployeeCareIntake(): void {
    this.employeeCareIntakeOpen = false;
  }

  public onPetPhotoSelected(event: Event): void {
    this.selectedPetPhotoFile = this.extractAllowedPetFile(event, 'foto de la mascota');
  }

  public onVaccineCardSelected(event: Event): void {
    this.selectedVaccineCardFile = this.extractAllowedPetFile(event, 'carnet de vacunas');
  }

  public prepareAddAnotherPet(): void {
    this.saveAndAddAnother = true;
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
    Object.assign(map, {
      veterinary: 'Consulta veterinaria',
      home_care: 'Pet sitter a domicilio',
      daycare: 'Guarderia o cupo diario',
      walking: 'Paseo de mascotas',
      grooming: 'Bano y peluqueria',
      training: 'Entrenamiento',
      nursing: 'Consulta veterinaria',
      dementia: 'Conducta / ansiedad',
      respite: 'Guarderia o cupo diario',
      voucher: 'Servicios o descuentos',
    });
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

  public speciesLabel(value: string | null | undefined): string {
    const map: Record<string, string> = {
      dog: 'Perro',
      cat: 'Gato',
      other: 'Otra especie',
    };
    return map[value ?? ''] ?? value ?? 'Sin dato';
  }

  public vaccinesStatusLabel(value: string | null | undefined): string {
    const map: Record<string, string> = {
      up_to_date: 'Al dia',
      pending: 'Pendientes',
      unknown: 'Sin dato',
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
    const shouldAddAnother = this.saveAndAddAnother;
    this.saveAndAddAnother = false;
    const userId = (await this.supabase.client.auth.getSession()).data.session?.user?.id ?? null;
    if (!userId) return;

    if (!this.employeeCareIntakeDraft.dataConsentAccepted) {
      alert('Debes aceptar el consentimiento de datos para guardar la ficha.');
      return;
    }

    this.loading = true;
    try {
      await this.syncEmployeeCompany(userId);
      const petId = await this.saveEmployeePet(userId);
      const payload = {
        record_type: 'veterinary_pet_profile',
        support_type: this.employeeCareIntakeDraft.careType,
        pet: {
          name: this.employeeCareIntakeDraft.petName.trim() || null,
          species: this.employeeCareIntakeDraft.species,
          breed: this.employeeCareIntakeDraft.breed.trim() || null,
          birth_date: this.employeeCareIntakeDraft.birthDate || null,
          photo_url: this.employeeCareIntakeDraft.petPhotoUrl || null,
          age: this.employeeCareIntakeDraft.careReceiverAge,
          life_stage: this.lifeStageFromAge(this.employeeCareIntakeDraft.careReceiverAge),
          sex: this.employeeCareIntakeDraft.sex,
          weight_kg: this.employeeCareIntakeDraft.weightKg,
          neutered: this.employeeCareIntakeDraft.neutered,
          microchip_number: this.employeeCareIntakeDraft.microchipNumber.trim() || null,
          national_registry_number: this.employeeCareIntakeDraft.nationalRegistryNumber.trim() || null,
        },
        clinical: {
          main_reason: this.employeeCareIntakeDraft.primaryCondition.trim() || null,
          care_priority: this.employeeCareIntakeDraft.dependencyLevel,
          vaccines_status: this.employeeCareIntakeDraft.vaccinesStatus,
          vaccine_card_url: this.employeeCareIntakeDraft.vaccineCardUrl.trim() || null,
          veterinary_clinic_name: this.employeeCareIntakeDraft.veterinaryClinicName.trim() || null,
          veterinary_clinic_commune: this.employeeCareIntakeDraft.veterinaryClinicCommune.trim() || null,
          treating_vet_name: this.employeeCareIntakeDraft.treatingVetName.trim() || null,
          treating_vet_contact: this.employeeCareIntakeDraft.treatingVetContact.trim() || null,
          chronic_conditions_allergies: this.employeeCareIntakeDraft.chronicConditionsAllergies.trim() || null,
          current_medications: this.employeeCareIntakeDraft.currentMedications.trim() || null,
        },
        location: {
          city: this.employeeCareIntakeDraft.city.trim() || null,
          postal_code: this.employeeCareIntakeDraft.postalCode.trim() || null,
        },
        routine: {
          support_network: this.employeeCareIntakeDraft.supportNetwork.trim() || null,
        },
        budget: {
          monthly_max: this.employeeCareIntakeDraft.budgetMonthlyMax,
          funding: this.employeeCareIntakeDraft.funding,
        },
        preferences: {
          preferred_contact: this.employeeCareIntakeDraft.preferredContact,
          data_consent_accepted: this.employeeCareIntakeDraft.dataConsentAccepted,
        },
        urgency: this.employeeCareIntakeDraft.urgency,
        tutor: {
          name: this.employeeCareIntakeDraft.caregiverName.trim() || null,
          relation: this.employeeCareIntakeDraft.caregiverRelation.trim() || null,
          company: this.companyName || null,
        },
        notes: this.employeeCareIntakeDraft.notes.trim() || null,
      };

      const query = this.employeeCareIntakeId
        ? this.supabase.client
            .from('pet_support_requests')
            .update({ details: JSON.stringify(payload), pet_id: petId, company_id: this.employeeCompanyId })
            .eq('id', this.employeeCareIntakeId)
        : this.supabase.client.from('pet_support_requests').insert({
            company_id: this.employeeCompanyId,
            employee_id: userId,
            pet_id: petId,
            request_type: this.petRequestTypeFromCareType(this.employeeCareIntakeDraft.careType),
            channel: this.petChannelFromPreferredContact(this.employeeCareIntakeDraft.preferredContact),
            title: 'Solicitud de apoyo pet',
            details: JSON.stringify(payload),
          } as any);

      const { error } = await query;
      if (error) throw error;
      this.selectedPetPhotoFile = null;
      this.selectedVaccineCardFile = null;

      if (shouldAddAnother) {
        this.employeeCareIntakeId = null;
        this.employeePetId = null;
        this.employeeCareIntakeUpdatedAt = null;
        this.employeeCareIntakeDraft = this.createDefaultCareIntakeDraft();
        this.selectedPetPhotoFile = null;
        this.selectedVaccineCardFile = null;
        alert('Mascota guardada. Puedes registrar otra mascota.');
        return;
      }

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
    const monthStart = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1)).toISOString();

    const [
      openRequests,
      resourcesCount,
      coursesCount,
      communityPostsCount,
      recentRequests,
      featuredResources,
      upcomingEvents,
      benefitPlans,
      benefitUsage,
      petsData,
    ] = await Promise.all([
      this.supabase.client
        .from('pet_support_requests')
        .select('id', { count: 'exact', head: true })
        .eq('employee_id', userId)
        .in('status', ['open', 'assigned', 'in_progress']),
      this.supabase.client.from('resources').select('id', { count: 'exact', head: true }),
      this.supabase.client.from('pet_learning_courses').select('id', { count: 'exact', head: true }),
      companyId
        ? this.supabase.client
            .from('community_posts')
            .select('id', { count: 'exact', head: true })
            .eq('company_id', companyId)
        : Promise.resolve({ count: 0 } as { count: number | null }),
      this.supabase.client
        .from('pet_support_requests')
        .select('id, title, status, channel, created_at')
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
        .from('pet_learning_events')
        .select('id, title, starts_at, format, location, join_url')
        .gte('starts_at', nowIso)
        .order('starts_at', { ascending: true })
        .limit(3),
      companyId
        ? this.supabase.client
            .from('company_benefit_plans')
            .select('name, monthly_allowance_per_employee')
            .eq('company_id', companyId)
            .eq('active', true)
            .maybeSingle()
        : Promise.resolve({ data: null } as { data: { name: string; monthly_allowance_per_employee: number } | null }),
      companyId
        ? this.supabase.client
            .from('benefit_usage')
            .select('amount_claimed')
            .eq('company_id', companyId)
            .eq('employee_id', userId)
            .gte('claimed_at', monthStart)
        : Promise.resolve({ data: [] } as { data: { amount_claimed: number }[] }),
      this.supabase.client
        .from('pets')
        .select('id, name, species, breed, pet_photo_url')
        .eq('owner_id', userId),
    ]);

    this.stats = [
      { label: 'Solicitudes activas',  value: openRequests.count ?? 0,      icon: 'forum' },
      { label: 'Recursos disponibles', value: resourcesCount.count ?? 0,    icon: 'library_books' },
      { label: 'Cursos disponibles',   value: coursesCount.count ?? 0,      icon: 'school' },
      { label: 'En comunidad',         value: communityPostsCount.count ?? 0, icon: 'forum' },
    ];

    this.recentRequests   = this.mapPetSupportRequests(recentRequests.data ?? []);
    this.featuredResources = (featuredResources.data ?? []) as FeaturedResource[];
    this.upcomingEvents    = (upcomingEvents.data   ?? []) as UpcomingEvent[];

    // Benefit plan
    const plan = benefitPlans?.data ?? null;
    const usage = benefitUsage?.data ?? [];
    const usedThisMonth = (usage as { amount_claimed: number }[]).reduce((s, u) => s + Number(u.amount_claimed), 0);
    this.benefitPlan = plan ? {
      name: (plan as { name: string }).name,
      monthlyAllowance: Number((plan as { monthly_allowance_per_employee: number }).monthly_allowance_per_employee),
      usedThisMonth,
      remaining: Number((plan as { monthly_allowance_per_employee: number }).monthly_allowance_per_employee) - usedThisMonth,
    } : null;

    // Pets
    this.employeePets = (petsData.data ?? []) as { id: string; name: string; species: string; breed: string | null; pet_photo_url: string | null }[];

    await this.loadEmployeeCareIntake(userId);
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
      { label: 'Empleados',            value: employeesCount.count ?? 0,  icon: 'group' },
      { label: 'Beneficios activos',   value: vouchersCount.count ?? 0,   icon: 'local_activity' },
      { label: 'Onboarding listo',     value: onboardingDone.count ?? 0,  icon: 'task_alt' },
      { label: 'Eventos (7 días)',      value: analytics7d.count ?? 0,    icon: 'analytics' },
    ];

    const [{ data: recent }, { data: resources }, { data: events }] = await Promise.all([
      this.supabase.client
        .from('pet_support_requests')
        .select('id, title, status, channel, created_at')
        .order('created_at', { ascending: false })
        .limit(5),
      this.supabase.client
        .from('resources')
        .select('id, title, category, summary, external_url, published_at, is_featured')
        .order('is_featured', { ascending: false })
        .order('published_at', { ascending: false })
        .limit(4),
      this.supabase.client
        .from('pet_learning_events')
        .select('id, title, starts_at, format, location, join_url')
        .order('starts_at', { ascending: true })
        .limit(3),
    ]);

    this.recentRequests    = this.mapPetSupportRequests(recent ?? []);
    this.featuredResources = (resources  ?? []) as FeaturedResource[];
    this.upcomingEvents    = (events     ?? []) as UpcomingEvent[];

    await this.loadCompanyData();
  }

  private async loadCompanyData(): Promise<void> {
    if (!this.companyId) return;
    this.loadingTeam = true;

    const [{ data: company }, { data: members }, { data: invitations }] = await Promise.all([
      this.supabase.client
        .from('companies')
        .select('name, legal_name, tax_id, address, phone, billing_email, industry, employee_count')
        .eq('id', this.companyId)
        .maybeSingle(),
      this.supabase.client
        .from('company_members_view')
        .select('user_id, full_name, email, member_role')
        .eq('company_id', this.companyId),
      this.supabase.client
        .from('company_invitations')
        .select('id, email, role, created_at')
        .eq('company_id', this.companyId)
        .eq('status', 'pending')
        .order('created_at', { ascending: false }),
    ]);

    if (company) {
      this.companyInfo = company as typeof this.companyInfo;
      this.companyForm = {
        name: company.name ?? '',
        legal_name: company.legal_name ?? '',
        address: company.address ?? '',
        phone: company.phone ?? '',
        billing_email: company.billing_email ?? '',
        industry: company.industry ?? '',
      };
    }

    this.teamMembers = (members ?? []) as typeof this.teamMembers;
    this.pendingInvitations = (invitations ?? []) as typeof this.pendingInvitations;
    this.loadingTeam = false;
  }

  public toggleEditCompany(): void {
    this.editingCompany = !this.editingCompany;
    if (this.editingCompany && this.companyInfo) {
      this.companyForm = {
        name: this.companyInfo.name,
        legal_name: this.companyInfo.legal_name,
        address: this.companyInfo.address,
        phone: this.companyInfo.phone,
        billing_email: this.companyInfo.billing_email,
        industry: this.companyInfo.industry,
      };
    }
  }

  public async saveCompany(): Promise<void> {
    if (!this.companyId) return;
    await this.supabase.client
      .from('companies')
      .update({
        name: this.companyForm.name,
        legal_name: this.companyForm.legal_name,
        address: this.companyForm.address,
        phone: this.companyForm.phone,
        billing_email: this.companyForm.billing_email,
        industry: this.companyForm.industry,
      })
      .eq('id', this.companyId);

    this.companyInfo = { ...this.companyInfo!, ...this.companyForm, tax_id: this.companyInfo?.tax_id ?? '', employee_count: this.companyInfo?.employee_count ?? null };
    this.companyName = this.companyForm.name;
    this.editingCompany = false;
    alert('Empresa actualizada');
  }

  public async revokeInvitation(invitationId: string): Promise<void> {
    if (!confirm('¿Revocar esta invitación?')) return;
    await this.supabase.client
      .from('company_invitations')
      .update({ status: 'revoked' })
      .eq('id', invitationId);
    this.pendingInvitations = this.pendingInvitations.filter(i => i.id !== invitationId);
  }

  public memberRoleLabel(role: string): string {
    return { employee: 'Empleado', hr_admin: 'RR.HH.', manager: 'Manager' }[role] ?? role;
  }

  public openInviteModal(): void {
    this.inviteEmail = '';
    this.inviteRole = 'employee';
    this.inviteModalOpen = true;
  }

  public closeInviteModal(): void {
    this.inviteModalOpen = false;
    this.inviteSending = false;
  }

  public async sendInvite(): Promise<void> {
    if (!this.inviteEmail.trim() || !this.inviteEmail.includes('@') || !this.companyId) return;
    this.inviteSending = true;
    try {
      const { data: session } = await this.supabase.client.auth.getSession();
      const token = session?.session?.access_token;
      if (!token) throw new Error('No session');

      const res = await fetch(
        'https://pvosygpsptszaxwmtlie.supabase.co/functions/v1/send-company-invitation',
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            companyId: this.companyId,
            email: this.inviteEmail.trim(),
            role: this.inviteRole,
          }),
        },
      );

      const body = await res.json();
      if (!res.ok) throw new Error(body?.error ?? 'Error al enviar invitación');

      alert('Invitación enviada correctamente');
      this.closeInviteModal();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Error al invitar');
    } finally {
      this.inviteSending = false;
    }
  }

  private async loadEmployeeCareIntake(userId: string): Promise<void> {
    const { data, error } = await this.supabase.client
      .from('pet_support_requests')
      .select('id, pet_id, details, updated_at, created_at')
      .eq('employee_id', userId)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw error;
    if (!data?.id) {
      this.employeeCareIntakeId = null;
      this.employeePetId = null;
      this.employeeCareIntakeUpdatedAt = null;
      this.employeeCareIntakeDraft = this.createDefaultCareIntakeDraft();
      return;
    }

    const p = this.parseRequestDetails((data as any).details);
    this.employeeCareIntakeId = data.id as string;
    this.employeePetId = ((data as any).pet_id as string | null | undefined) ?? null;
    this.employeeCareIntakeUpdatedAt =
      (data.updated_at as string | undefined) ?? (data.created_at as string | undefined) ?? null;

    this.employeeCareIntakeDraft = {
      careType:         p?.support_type ?? p?.care_type ?? p?.clinical_profile ?? 'guidance',
      petName:          p?.pet?.name ?? '',
      species:          p?.pet?.species ?? 'dog',
      breed:            p?.pet?.breed ?? '',
      birthDate:         p?.pet?.birth_date ?? '',
      petPhotoUrl:       p?.pet?.photo_url ?? p?.pet?.pet_photo_url ?? '',
      careReceiverAge:  p?.pet?.age ?? p?.care_receiver?.age ?? p?.family?.age ?? null,
      sex:              p?.pet?.sex ?? 'unknown',
      weightKg:         p?.pet?.weight_kg ?? null,
      neutered:         p?.pet?.neutered ?? 'unknown',
      microchipNumber:  p?.pet?.microchip_number ?? '',
      nationalRegistryNumber: p?.pet?.national_registry_number ?? '',
      vaccinesStatus:   p?.clinical?.vaccines_status ?? 'unknown',
      vaccineCardUrl:    p?.clinical?.vaccine_card_url ?? '',
      dataConsentAccepted: p?.preferences?.data_consent_accepted ?? false,
      veterinaryClinicName: p?.clinical?.veterinary_clinic_name ?? '',
      veterinaryClinicCommune: p?.clinical?.veterinary_clinic_commune ?? '',
      treatingVetName:   p?.clinical?.treating_vet_name ?? '',
      treatingVetContact:p?.clinical?.treating_vet_contact ?? '',
      chronicConditionsAllergies: p?.clinical?.chronic_conditions_allergies ?? '',
      currentMedications:p?.clinical?.current_medications ?? '',
      primaryCondition: p?.clinical?.main_reason ?? p?.care_receiver?.primary_condition ?? '',
      dependencyLevel:  p?.clinical?.care_priority ?? p?.care_receiver?.dependency_level ?? 'medium',
      city:             p?.location?.city ?? p?.location?.comuna ?? '',
      postalCode:       p?.location?.postal_code ?? '',
      supportNetwork:   p?.routine?.support_network ?? p?.family_context?.support_network ?? '',
      budgetMonthlyMax: p?.budget?.monthly_max ?? p?.budget?.weekly_max ?? null,
      funding:          p?.budget?.funding ?? 'self_funder',
      preferredContact: p?.preferences?.preferred_contact ?? 'chat',
      urgency:          p?.urgency ?? 'immediate',
      caregiverName:    p?.tutor?.name ?? p?.caregiver?.name ?? '',
      caregiverRelation:p?.tutor?.relation ?? p?.caregiver?.relation ?? '',
      notes:            p?.notes ?? '',
      amenities:        { ensuite: false, garden: false, library: false, pets: false },
    };
  }

  private mapPetSupportRequests(rows: any[]): RecentRequest[] {
    return rows.map((row) => ({
      id: row.id,
      topic: row.title,
      status: row.status,
      channel: row.channel,
      created_at: row.created_at,
    }));
  }

  private parseRequestDetails(value: unknown): any {
    if (!value) return {};
    if (typeof value !== 'string') return value;
    try {
      return JSON.parse(value);
    } catch {
      return { notes: value };
    }
  }

  private petRequestTypeFromCareType(value: string): string {
    const map: Record<string, string> = {
      guidance: 'other',
      home_care: 'walking',
      residential: 'daycare',
      veterinary: 'veterinary',
      daycare: 'daycare',
      walking: 'walking',
      grooming: 'grooming',
      training: 'training',
      voucher: 'voucher',
      nursing: 'veterinary',
      dementia: 'veterinary',
      respite: 'daycare',
    };
    return map[value] || 'other';
  }

  private petChannelFromPreferredContact(value: string): string {
    const map: Record<string, string> = {
      chat: 'chat',
      phone: 'call',
      video: 'video',
    };
    return map[value] || 'portal';
  }

  private async saveEmployeePet(userId: string): Promise<string | null> {
    this.syncPetAgeFromBirthDate();

    const uploadedPetPhotoUrl = await this.uploadPetFile(userId, this.selectedPetPhotoFile, 'photo');
    const uploadedVaccineCardUrl = await this.uploadPetFile(userId, this.selectedVaccineCardFile, 'vaccines');
    if (uploadedPetPhotoUrl) this.employeeCareIntakeDraft.petPhotoUrl = uploadedPetPhotoUrl;
    if (uploadedVaccineCardUrl) this.employeeCareIntakeDraft.vaccineCardUrl = uploadedVaccineCardUrl;

    const petPayload = {
      owner_id: userId,
      company_id: this.employeeCompanyId,
      name: this.employeeCareIntakeDraft.petName.trim() || 'Mascota sin nombre',
      species: this.employeeCareIntakeDraft.species,
      breed: this.employeeCareIntakeDraft.breed.trim() || null,
      birth_date: this.employeeCareIntakeDraft.birthDate || null,
      pet_photo_url: this.employeeCareIntakeDraft.petPhotoUrl || null,
      approximate_age: this.employeeCareIntakeDraft.careReceiverAge,
      life_stage: this.lifeStageFromAge(this.employeeCareIntakeDraft.careReceiverAge),
      sex: this.employeeCareIntakeDraft.sex,
      weight_kg: this.employeeCareIntakeDraft.weightKg,
      neutered: this.employeeCareIntakeDraft.neutered,
      microchip_number: this.employeeCareIntakeDraft.microchipNumber.trim() || null,
      national_registry_number: this.employeeCareIntakeDraft.nationalRegistryNumber.trim() || null,
      vaccine_status: this.employeeCareIntakeDraft.vaccinesStatus,
      vaccine_card_url: this.employeeCareIntakeDraft.vaccineCardUrl.trim() || null,
      data_consent_accepted: this.employeeCareIntakeDraft.dataConsentAccepted,
      data_consent_accepted_at: this.employeeCareIntakeDraft.dataConsentAccepted ? new Date().toISOString() : null,
      veterinary_clinic_name: this.employeeCareIntakeDraft.veterinaryClinicName.trim() || null,
      veterinary_clinic_commune: this.employeeCareIntakeDraft.veterinaryClinicCommune.trim() || null,
      treating_vet_name: this.employeeCareIntakeDraft.treatingVetName.trim() || null,
      treating_vet_contact: this.employeeCareIntakeDraft.treatingVetContact.trim() || null,
      chronic_conditions_allergies: this.employeeCareIntakeDraft.chronicConditionsAllergies.trim() || null,
      current_medications: this.employeeCareIntakeDraft.currentMedications.trim() || null,
      notes: this.employeeCareIntakeDraft.notes.trim() || null,
    };

    if (this.employeePetId) {
      const { data, error } = await this.supabase.client
        .from('pets')
        .update(petPayload as any)
        .eq('id', this.employeePetId)
        .select('id')
        .single();
      if (error) throw error;
      return (data?.id as string | undefined) ?? this.employeePetId;
    }

    const { data, error } = await this.supabase.client
      .from('pets')
      .insert(petPayload as any)
      .select('id')
      .single();
    if (error) throw error;
    this.employeePetId = (data?.id as string | undefined) ?? null;
    return this.employeePetId;
  }

  private extractAllowedPetFile(event: Event, label: string): File | null {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    if (!file) return null;

    const allowedTypes = new Set(['image/jpeg', 'image/png', 'image/webp', 'application/pdf']);
    const maxBytes = 8 * 1024 * 1024;
    if (!allowedTypes.has(file.type)) {
      input.value = '';
      alert(`El archivo para ${label} debe ser JPG, PNG, WEBP o PDF.`);
      return null;
    }
    if (file.size > maxBytes) {
      input.value = '';
      alert(`El archivo para ${label} supera 8 MB.`);
      return null;
    }
    return file;
  }

  private async uploadPetFile(userId: string, file: File | null, kind: 'photo' | 'vaccines'): Promise<string | null> {
    if (!file) return null;
    const safeName = file.name
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9._-]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .toLowerCase();
    const path = `${userId}/${kind}/${Date.now()}-${safeName || 'archivo'}`;
    const { error } = await this.supabase.client.storage
      .from('pet-files')
      .upload(path, file, {
        cacheControl: '3600',
        contentType: file.type || undefined,
        upsert: false,
      });
    if (error) throw error;
    return path;
  }

  private lifeStageFromAge(age: number | null): string | null {
    if (age === null || age === undefined) return null;
    if (age < 1) return 'puppy';
    if (age >= 8) return 'senior';
    return 'adult';
  }

  private calculateAgeFromBirthDate(value: string): number | null {
    if (!value) return null;

    const birthDate = new Date(`${value}T00:00:00`);
    if (Number.isNaN(birthDate.getTime())) return null;

    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const hasHadBirthdayThisYear =
      today.getMonth() > birthDate.getMonth() ||
      (today.getMonth() === birthDate.getMonth() && today.getDate() >= birthDate.getDate());

    if (!hasHadBirthdayThisYear) age -= 1;
    return Math.max(age, 0);
  }

  private createDefaultCareIntakeDraft(): EmployeeCareIntakeDraft {
    return {
      careType:         'guidance',
      petName:          '',
      species:          'dog',
      breed:            '',
      birthDate:         '',
      petPhotoUrl:       '',
      careReceiverAge:  null,
      sex:              'unknown',
      weightKg:         null,
      neutered:         'unknown',
      microchipNumber:  '',
      nationalRegistryNumber: '',
      vaccinesStatus:   'unknown',
      vaccineCardUrl:    '',
      dataConsentAccepted: false,
      veterinaryClinicName: '',
      veterinaryClinicCommune: '',
      treatingVetName:   '',
      treatingVetContact:'',
      chronicConditionsAllergies: '',
      currentMedications:'',
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
