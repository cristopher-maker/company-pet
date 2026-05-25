import { Component, OnDestroy, OnInit, ChangeDetectorRef } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { SupabaseService } from '../../core/services/supabase.service';
import { UiService } from '../../core/services/ui.service';

type CompanyTab = 'general' | 'employees' | 'vouchers' | 'admin';

type CompanyRow = {
  id: string;
  name: string;
  legal_name?: string | null;
  tax_id: string | null;
  domain: string | null;
  plan_tier?: string | null;
  industry?: string | null;
  employee_count?: number | null;
  billing_email?: string | null;
  phone?: string | null;
  address?: string | null;
  operational_status?: 'onboarding' | 'active' | 'paused' | 'inactive';
};

type CompanyMemberRole = 'employee' | 'manager' | 'hr_admin' | 'company_admin';

type CompanyMember = {
  user_id: string;
  email: string;
  full_name: string | null;
  member_role: CompanyMemberRole;
};

type VoucherRow = {
  id: string;
  code: string;
  title: string;
  description: string | null;
  discount_type: 'percentage' | 'fixed_amount';
  discount_value: number;
  active: boolean;
};

type VoucherDraft = Omit<VoucherRow, 'id'> & { id: string | null };

type CompanyContactType = 'hr' | 'billing' | 'legal' | 'operations' | 'executive' | 'other';

type CompanyContact = {
  id: string;
  company_id: string;
  full_name: string;
  role_title: string | null;
  email: string | null;
  phone: string | null;
  contact_type: CompanyContactType;
  is_primary: boolean;
  notes: string | null;
};

type CompanyContactDraft = Omit<CompanyContact, 'id' | 'company_id'> & { id: string | null };

type CompanyContractStatus = 'draft' | 'active' | 'pending_renewal' | 'expired' | 'cancelled';

type CompanyContract = {
  id: string;
  company_id: string;
  plan_tier: string;
  status: CompanyContractStatus;
  starts_at: string | null;
  renews_at: string | null;
  ends_at: string | null;
  billing_cycle: 'monthly' | 'annual' | 'custom';
  amount: number | null;
  currency: string;
  document_id: string | null;
  notes: string | null;
};

type CompanyContractDraft = Omit<CompanyContract, 'id' | 'company_id'> & { id: string | null };

type CompanyDocumentOption = {
  id: string;
  title: string;
  document_type: string;
  status: string;
};

type OnboardingProjectSummary = {
  id: string;
  title: string;
  status: string;
};

type CompanySubscriptionStatus = 'draft' | 'pending' | 'active' | 'past_due' | 'suspended' | 'cancelled';
type PaymentReturnStatus = 'success' | 'failure' | 'pending';

type CompanySubscription = {
  id: string;
  company_id: string;
  contract_id: string | null;
  provider: 'stripe' | 'flow' | 'mercadopago' | 'manual';
  plan_tier: string;
  status: CompanySubscriptionStatus;
  payment_url: string | null;
  current_period_start: string | null;
  current_period_end: string | null;
};

type CompanyInvoice = {
  id: string;
  company_id: string;
  subscription_id: string | null;
  status: 'draft' | 'open' | 'paid' | 'overdue' | 'void' | 'uncollectible';
  amount_due: number;
  amount_paid: number;
  currency: string;
  due_at: string | null;
  paid_at: string | null;
  hosted_invoice_url: string | null;
  invoice_pdf_url: string | null;
};

@Component({
  selector: 'app-company',
  templateUrl: './company.page.html',
  styleUrls: ['./company.page.scss'],
})
export class CompanyPage implements OnInit, OnDestroy {
  public loading = true;
  public saving = false;
  public error: string | null = null;
  public company: CompanyRow | null = null;
  public members: CompanyMember[] = [];
  public vouchers: VoucherRow[] = [];
  public contacts: CompanyContact[] = [];
  public contracts: CompanyContract[] = [];
  public documents: CompanyDocumentOption[] = [];
  public onboardingProjects: OnboardingProjectSummary[] = [];
  public subscriptions: CompanySubscription[] = [];
  public invoices: CompanyInvoice[] = [];
  public requestsSummary = { total: 0, open: 0, resolved: 0 };
  public currentTab: CompanyTab = 'admin';
  public showInviteModal = false;
  public inviteEmail = '';
  public inviteRole: CompanyMemberRole = 'employee';
  public showVoucherModal = false;
  public voucherDraft: VoucherDraft = this.createVoucherDraft();
  public showContactModal = false;
  public contactDraft: CompanyContactDraft = this.createContactDraft();
  public showContractModal = false;
  public contractDraft: CompanyContractDraft = this.createContractDraft();
  public requestingPaymentLink = false;
  public selectedPaymentPlan: 'empresa' | 'premium' = 'empresa';
  public selectedIntake: any | null = null;
  public paymentReturnStatus: PaymentReturnStatus | null = null;

  public readonly paymentPlanOptions = [
    {
      id: 'empresa' as const,
      label: 'Plataforma',
      description: 'Portal, empleados, solicitudes, documentos y seguimiento.',
      price: '$199.000',
    },
    {
      id: 'premium' as const,
      label: 'Acompañamiento',
      description: 'Plataforma mas soporte prioritario y acompanamiento operativo.',
      price: '$499.000',
    },
  ];

  public readonly tabs: { id: CompanyTab; label: string }[] = [
    { id: 'admin', label: 'Resumen' },
    { id: 'employees', label: 'Empleados' },
    { id: 'vouchers', label: 'Vouchers' },
    { id: 'general', label: 'Configuración' },
  ];

  private unsub?: { data: { subscription: { unsubscribe: () => void } } };

  constructor(
    private readonly route: ActivatedRoute,
    private readonly supabase: SupabaseService,
    public readonly ui: UiService,
    private readonly cdr: ChangeDetectorRef
  ) {}

  public getTabLabel(id: CompanyTab): string {
    return this.tabs.find((t) => t.id === id)?.label || 'Panel';
  }

  public get activeVoucherCount(): number {
    return this.vouchers.filter((voucher) => voucher.active).length;
  }

  public get adminCount(): number {
    return this.members.filter((member) => member.member_role === 'hr_admin' || member.member_role === 'manager').length;
  }

  public get employeeCount(): number {
    return this.members.filter((member) => member.member_role === 'employee').length;
  }

  public get primaryContact(): CompanyContact | null {
    return this.contacts.find((contact) => contact.is_primary) || this.contacts[0] || null;
  }

  public get activeContract(): CompanyContract | null {
    return this.contracts.find((contract) => contract.status === 'active') || this.contracts[0] || null;
  }

  public get currentSubscription(): CompanySubscription | null {
    return this.subscriptions.find((subscription) => subscription.status === 'active') || this.subscriptions[0] || null;
  }

  public get selectedPlanSubscription(): CompanySubscription | null {
    return this.subscriptions.find((subscription) => subscription.plan_tier === this.selectedPaymentPlan) || null;
  }

  public get latestInvoice(): CompanyInvoice | null {
    return this.invoices[0] || null;
  }

  public get paymentUrl(): string | null {
    return this.selectedPlanSubscription?.payment_url || null;
  }

  public get invoiceUrl(): string | null {
    return this.latestInvoice?.invoice_pdf_url || this.latestInvoice?.hosted_invoice_url || null;
  }

  public get invoiceHelperText(): string {
    if (this.invoiceUrl) {
      return this.latestInvoice?.status === 'paid'
        ? 'La boleta ya esta disponible para revision.'
        : 'La factura de este cobro ya fue emitida.';
    }

    if (this.latestInvoice) {
      return 'El cobro existe, pero aun no tiene boleta publicada.';
    }

    return 'La boleta se genera cuando Mercado Pago confirma el cobro.';
  }

  public get paymentReturnTitle(): string {
    if (this.paymentReturnStatus === 'success') return '¡Felicidades! Tu pago fue aprobado.';
    if (this.paymentReturnStatus === 'pending') return 'Tu pago quedo pendiente de confirmacion.';
    return 'No se pudo completar el pago.';
  }

  public get paymentReturnMessage(): string {
    if (this.paymentReturnStatus === 'success') {
      return 'Estamos activando tu plan. En unos segundos podras disfrutar los beneficios de company pet.';
    }
    if (this.paymentReturnStatus === 'pending') {
      return 'Mercado Pago todavia no confirma la operacion. Cuando se acredite, activaremos los beneficios.';
    }
    return 'Puedes intentar nuevamente con Mercado Pago o elegir otro medio de pago.';
  }

  public get connectedModules(): { label: string; value: string; detail: string }[] {
    return [
      { label: 'Empleados', value: String(this.members.length), detail: `${this.adminCount} admins RR.HH.` },
      { label: 'Vouchers', value: String(this.activeVoucherCount), detail: `${this.vouchers.length} creados` },
      { label: 'Documentos', value: String(this.documents.length), detail: `${this.documents.filter((doc) => doc.status === 'approved').length} aprobados` },
      { label: 'Onboarding', value: String(this.onboardingProjects.filter((project) => project.status === 'active').length), detail: `${this.onboardingProjects.length} proyectos` },
      { label: 'Solicitudes', value: String(this.requestsSummary.open), detail: `${this.requestsSummary.total} historicas` },
      { label: 'Pago', value: this.subscriptionStatusLabel(this.currentSubscription?.status || null), detail: this.planTierLabel(this.currentSubscription?.plan_tier || this.activeContract?.plan_tier || this.company?.plan_tier || null) },
    ];
  }

  public ngOnInit(): void {
    this.route.queryParamMap.subscribe((params) => {
      const payment = params.get('payment');
      this.paymentReturnStatus = this.normalizePaymentReturnStatus(payment);
      if (this.paymentReturnStatus === 'success' || this.paymentReturnStatus === 'pending') {
        window.setTimeout(() => void this.refresh(), 1500);
      }
    });
    void this.refresh();
    this.unsub = this.supabase.client.auth.onAuthStateChange(() => void this.refresh());
  }

  public ngOnDestroy(): void {
    this.unsub?.data.subscription.unsubscribe();
  }

  public dismissPaymentReturn(): void {
    this.paymentReturnStatus = null;
  }

  private normalizePaymentReturnStatus(value: string | null): PaymentReturnStatus | null {
    return value === 'success' || value === 'failure' || value === 'pending' ? value : null;
  }

  private createVoucherDraft(): VoucherDraft {
    return {
      id: null,
      code: Math.random().toString(36).substring(2, 10).toUpperCase(),
      title: '',
      description: '',
      discount_type: 'percentage',
      discount_value: 10,
      active: true,
    };
  }

  private createContactDraft(): CompanyContactDraft {
    return {
      id: null,
      full_name: '',
      role_title: '',
      email: '',
      phone: '',
      contact_type: 'operations',
      is_primary: this.contacts.length === 0,
      notes: '',
    };
  }

  private createContractDraft(): CompanyContractDraft {
    return {
      id: null,
      plan_tier: this.normalizePlanTier(this.company?.plan_tier),
      status: 'active',
      starts_at: new Date().toISOString().slice(0, 10),
      renews_at: '',
      ends_at: '',
      billing_cycle: 'monthly',
      amount: null,
      currency: 'CLP',
      document_id: null,
      notes: '',
    };
  }

  public async refresh(): Promise<void> {
    this.loading = true;
    this.error = null;
    try {
      const { data: sessionData } = await this.supabase.client.auth.getSession();
      const userId = sessionData.session?.user?.id;
      if (!userId) throw new Error('No hay sesión activa.');

      const { data: membership, error: memberError } = await this.supabase.client
        .from('company_members')
        .select('company_id, member_role')
        .eq('user_id', userId)
        .maybeSingle();

      if (memberError) throw memberError;
      if (!membership?.company_id || !['hr_admin', 'company_admin'].includes(membership.member_role)) {
        throw new Error('No tienes permisos para administrar esta empresa.');
      }

      const companyId = membership.company_id;
      const [
        companyRes,
        membersRes,
        vouchersRes,
        contactsRes,
        contractsRes,
        documentsRes,
        onboardingRes,
        subscriptionsRes,
        invoicesRes,
      ] = await Promise.all([
        this.supabase.client.from('companies').select('*').eq('id', companyId).single(),
        this.supabase.client.from('company_members_view').select('*').eq('company_id', companyId),
        this.supabase.client.from('vouchers').select('*').eq('company_id', companyId).order('created_at'),
        this.supabase.client
          .from('company_contacts')
          .select('*')
          .eq('company_id', companyId)
          .order('is_primary', { ascending: false })
          .order('created_at', { ascending: true }),
        this.supabase.client
          .from('company_contracts')
          .select('*')
          .eq('company_id', companyId)
          .order('status', { ascending: true })
          .order('starts_at', { ascending: false }),
        this.supabase.client
          .from('company_documents')
          .select('id,title,document_type,status')
          .eq('company_id', companyId)
          .order('created_at', { ascending: false }),
        this.supabase.client
          .from('onboarding_projects')
          .select('id,title,status')
          .eq('company_id', companyId)
          .order('created_at', { ascending: false }),
        this.supabase.client
          .from('company_subscriptions')
          .select('id,company_id,contract_id,provider,plan_tier,status,payment_url,current_period_start,current_period_end')
          .eq('company_id', companyId)
          .order('created_at', { ascending: false }),
        this.supabase.client
          .from('company_invoices')
          .select('id,company_id,subscription_id,status,amount_due,amount_paid,currency,due_at,paid_at,hosted_invoice_url,invoice_pdf_url')
          .eq('company_id', companyId)
          .order('created_at', { ascending: false })
          .limit(5),
      ]);

      if (companyRes.error) throw companyRes.error;
      this.company = companyRes.data as CompanyRow;

      if (membersRes.error) throw membersRes.error;
      this.members = (membersRes.data ?? []) as CompanyMember[];

      if (vouchersRes.error) throw vouchersRes.error;
      this.vouchers = (vouchersRes.data ?? []) as VoucherRow[];

      if (contactsRes.error) throw contactsRes.error;
      this.contacts = (contactsRes.data ?? []) as CompanyContact[];

      if (contractsRes.error) throw contractsRes.error;
      this.contracts = (contractsRes.data ?? []) as CompanyContract[];

      if (documentsRes.error) throw documentsRes.error;
      this.documents = (documentsRes.data ?? []) as CompanyDocumentOption[];

      if (onboardingRes.error) throw onboardingRes.error;
      this.onboardingProjects = (onboardingRes.data ?? []) as OnboardingProjectSummary[];

      if (subscriptionsRes.error) throw subscriptionsRes.error;
      this.subscriptions = (subscriptionsRes.data ?? []) as CompanySubscription[];

      if (invoicesRes.error) throw invoicesRes.error;
      this.invoices = (invoicesRes.data ?? []) as CompanyInvoice[];
      this.selectedPaymentPlan = this.normalizePlanTier(
        this.currentSubscription?.plan_tier || this.activeContract?.plan_tier || this.company?.plan_tier
      );

      await this.loadRequestsSummary(companyId);
    } catch (err: any) {
      this.error = err.message;
    } finally {
      this.loading = false;
      this.cdr.detectChanges();
    }
  }

  private async loadRequestsSummary(companyId: string): Promise<void> {
    this.requestsSummary = { total: 0, open: 0, resolved: 0 };
    const { data: companyMembers } = await this.supabase.client
      .from('company_members')
      .select('user_id')
      .eq('company_id', companyId);

    const employeeIds = (companyMembers ?? []).map((member: { user_id: string }) => member.user_id);
    if (employeeIds.length === 0) return;

    const { data, error } = await this.supabase.client
      .from('care_requests')
      .select('status')
      .in('employee_id', employeeIds);

    if (error) return;
    const statuses = (data ?? []) as { status: string }[];
    this.requestsSummary = {
      total: statuses.length,
      open: statuses.filter((request) => !['resolved', 'closed'].includes(request.status)).length,
      resolved: statuses.filter((request) => ['resolved', 'closed'].includes(request.status)).length,
    };
  }

  public async saveCompany(): Promise<void> {
    if (!this.company) return;
    this.saving = true;
    try {
      const { error } = await this.supabase.client
        .from('companies')
        .update({
          name: this.company.name,
          legal_name: this.company.legal_name,
          tax_id: this.company.tax_id,
          domain: this.company.domain,
          industry: this.company.industry,
          employee_count: this.company.employee_count,
          billing_email: this.company.billing_email,
          phone: this.company.phone,
          address: this.company.address,
          operational_status: this.company.operational_status || 'onboarding',
        })
        .eq('id', this.company.id);
      if (error) throw error;
      // Aquí podrías mostrar una notificación de éxito
    } catch (err: any) {
      this.error = `Error al guardar: ${err.message}`;
    } finally {
      this.saving = false;
      this.cdr.detectChanges();
    }
  }

  public async sendInvite(): Promise<void> {
    if (!this.company || !this.inviteEmail) return;
    this.saving = true;
    try {
      const { error } = await this.supabase.client.functions.invoke('send-company-invitation', {
        body: {
          companyId: this.company.id,
          email: this.inviteEmail.trim().toLowerCase(),
          role: this.inviteRole,
        },
      });
      if (error) throw error;
      this.showInviteModal = false;
      this.inviteEmail = '';
      // Aquí podrías mostrar una notificación de éxito
    } catch (err: any) {
      this.error = await this.getFunctionErrorMessage(err, 'Error al invitar.');
    } finally {
      this.saving = false;
      this.cdr.detectChanges();
    }
  }

  private async getFunctionErrorMessage(error: any, fallback: string): Promise<string> {
    const response = error?.context;
    if (response && typeof response.json === 'function') {
      const body = await response.json().catch(() => null);
      if (body?.error) return `${fallback} ${body.error}`;
    }
    return `${fallback} ${error?.message || ''}`.trim();
  }

  public async removeMember(member: CompanyMember): Promise<void> {
    if (!confirm(`¿Seguro que quieres eliminar a ${member.full_name || member.email}?`)) return;
    this.saving = true;
    try {
      const { error } = await this.supabase.client
        .from('company_members')
        .delete()
        .eq('user_id', member.user_id)
        .eq('company_id', this.company?.id);
      if (error) throw error;
      await this.refresh();
    } catch (err: any) {
      this.error = `Error al eliminar: ${err.message}`;
    } finally {
      this.saving = false;
      this.cdr.detectChanges();
    }
  }
  
  public newVoucher(): void {
    this.voucherDraft = this.createVoucherDraft();
    this.showVoucherModal = true;
  }

  public editVoucher(voucher: VoucherRow): void {
    this.voucherDraft = { ...voucher };
    this.showVoucherModal = true;
  }

  public async saveVoucher(): Promise<void> {
    if (!this.company) return;
    this.saving = true;
    try {
      const payload = {
        company_id: this.company.id,
        code: this.voucherDraft.code,
        title: this.voucherDraft.title,
        description: this.voucherDraft.description,
        discount_type: this.voucherDraft.discount_type,
        discount_value: this.voucherDraft.discount_value,
        active: this.voucherDraft.active,
      };
      const query = this.voucherDraft.id
        ? this.supabase.client.from('vouchers').update(payload).eq('id', this.voucherDraft.id)
        : this.supabase.client.from('vouchers').insert(payload);
      
      const { error } = await query;
      if (error) throw error;
      
      this.showVoucherModal = false;
      await this.refresh();
    } catch (err: any) {
      this.error = `Error al guardar voucher: ${err.message}`;
    } finally {
      this.saving = false;
      this.cdr.detectChanges();
    }
  }

  public async toggleVoucherActive(voucher: VoucherRow): Promise<void> {
    this.saving = true;
    try {
      const { error } = await this.supabase.client
        .from('vouchers')
        .update({ active: !voucher.active })
        .eq('id', voucher.id);
      if (error) throw error;
      await this.refresh();
    } catch (err: any) {
      this.error = `Error al actualizar voucher: ${err.message}`;
    } finally {
      this.saving = false;
      this.cdr.detectChanges();
    }
  }

  public newContact(): void {
    this.contactDraft = this.createContactDraft();
    this.showContactModal = true;
  }

  public editContact(contact: CompanyContact): void {
    this.contactDraft = { ...contact };
    this.showContactModal = true;
  }

  public async saveContact(): Promise<void> {
    if (!this.company) return;
    this.saving = true;
    try {
      const payload = {
        company_id: this.company.id,
        full_name: this.contactDraft.full_name,
        role_title: this.contactDraft.role_title,
        email: this.contactDraft.email,
        phone: this.contactDraft.phone,
        contact_type: this.contactDraft.contact_type,
        is_primary: this.contactDraft.is_primary,
        notes: this.contactDraft.notes,
      };

      const query = this.contactDraft.id
        ? this.supabase.client.from('company_contacts').update(payload).eq('id', this.contactDraft.id)
        : this.supabase.client.from('company_contacts').insert(payload);

      const { error } = await query;
      if (error) throw error;

      this.showContactModal = false;
      await this.refresh();
    } catch (err: any) {
      this.error = `Error al guardar contacto: ${err.message}`;
    } finally {
      this.saving = false;
      this.cdr.detectChanges();
    }
  }

  public async deleteContact(contact: CompanyContact): Promise<void> {
    if (!confirm(`¿Eliminar el contacto ${contact.full_name}?`)) return;
    this.saving = true;
    try {
      const { error } = await this.supabase.client.from('company_contacts').delete().eq('id', contact.id);
      if (error) throw error;
      await this.refresh();
    } catch (err: any) {
      this.error = `Error al eliminar contacto: ${err.message}`;
    } finally {
      this.saving = false;
      this.cdr.detectChanges();
    }
  }

  public newContract(): void {
    this.contractDraft = this.createContractDraft();
    this.showContractModal = true;
  }

  public editContract(contract: CompanyContract): void {
    this.contractDraft = { ...contract };
    this.showContractModal = true;
  }

  public async saveContract(): Promise<void> {
    if (!this.company) return;
    this.saving = true;
    try {
      if (this.contractDraft.status === 'active') {
        let activeQuery = this.supabase.client
          .from('company_contracts')
          .update({ status: 'expired' })
          .eq('company_id', this.company.id)
          .eq('status', 'active');

        if (this.contractDraft.id) {
          activeQuery = activeQuery.neq('id', this.contractDraft.id);
        }

        const { error: activeError } = await activeQuery;
        if (activeError) throw activeError;
      }

      const payload = {
        company_id: this.company.id,
        plan_tier: this.contractDraft.plan_tier,
        status: this.contractDraft.status,
        starts_at: this.contractDraft.starts_at || null,
        renews_at: this.contractDraft.renews_at || null,
        ends_at: this.contractDraft.ends_at || null,
        billing_cycle: this.contractDraft.billing_cycle,
        amount: this.contractDraft.amount,
        currency: this.contractDraft.currency || 'CLP',
        document_id: this.contractDraft.document_id || null,
        notes: this.contractDraft.notes,
      };

      const query = this.contractDraft.id
        ? this.supabase.client.from('company_contracts').update(payload).eq('id', this.contractDraft.id)
        : this.supabase.client.from('company_contracts').insert(payload);

      const { error } = await query;
      if (error) throw error;

      if (payload.status === 'active') {
        this.company.plan_tier = payload.plan_tier;
        const { error: planError } = await this.supabase.client
          .from('companies')
          .update({ plan_tier: payload.plan_tier })
          .eq('id', this.company.id);
        if (planError) throw planError;
      }

      this.showContractModal = false;
      await this.refresh();
    } catch (err: any) {
      this.error = `Error al guardar contrato: ${err.message}`;
    } finally {
      this.saving = false;
      this.cdr.detectChanges();
    }
  }

  public async deleteContract(contract: CompanyContract): Promise<void> {
    if (!confirm(`¿Eliminar el contrato ${this.planTierLabel(contract.plan_tier)}?`)) return;
    this.saving = true;
    try {
      const { error } = await this.supabase.client.from('company_contracts').delete().eq('id', contract.id);
      if (error) throw error;
      await this.refresh();
    } catch (err: any) {
      this.error = `Error al eliminar contrato: ${err.message}`;
    } finally {
      this.saving = false;
      this.cdr.detectChanges();
    }
  }

  public async requestPaymentLink(): Promise<void> {
    if (!this.company) return;
    this.requestingPaymentLink = true;
    try {
      const { data, error } = await this.supabase.client.functions.invoke('mercadopago-create-preference', {
        body: {
          companyId: this.company.id,
          planTier: this.selectedPaymentPlan,
        },
      });

      if (error) throw error;
      const paymentUrl = (data as { paymentUrl?: string | null } | null)?.paymentUrl;
      if (paymentUrl) {
        window.open(paymentUrl, '_blank', 'noopener');
      }
      await this.refresh();
    } catch (err: any) {
      this.error = `Error al generar link Mercado Pago: ${await this.describeFunctionError(err)}`;
    } finally {
      this.requestingPaymentLink = false;
      this.cdr.detectChanges();
    }
  }

  private async describeFunctionError(err: any): Promise<string> {
    const response = err?.context;
    if (response instanceof Response) {
      const payload = await response.clone().json().catch(() => null);
      const detail = payload?.detail ? ` ${JSON.stringify(payload.detail)}` : '';
      return `${payload?.error || err?.message || 'Error desconocido.'}${detail}`;
    }
    return err?.message || 'Error desconocido.';
  }

  public memberRoleLabel(role: CompanyMemberRole | null): string {
    const labels: Record<string, string> = {
      employee: 'Empleado',
      manager: 'Manager',
      hr_admin: 'Admin RRHH',
      company_admin: 'Admin Empresa',
    };
    return role ? labels[role] || role : 'N/A';
  }

  public contactTypeLabel(type: CompanyContactType | null): string {
    const labels: Record<string, string> = {
      hr: 'RR.HH.',
      billing: 'Facturacion',
      legal: 'Legal',
      operations: 'Operacion',
      executive: 'Ejecutivo',
      other: 'Otro',
    };
    return type ? labels[type] || type : 'Sin tipo';
  }

  public contractStatusLabel(status: CompanyContractStatus | null): string {
    const labels: Record<string, string> = {
      draft: 'Borrador',
      active: 'Activo',
      pending_renewal: 'Por renovar',
      expired: 'Vencido',
      cancelled: 'Cancelado',
    };
    return status ? labels[status] || status : 'Sin contrato';
  }

  public subscriptionStatusLabel(status: CompanySubscriptionStatus | null): string {
    const labels: Record<string, string> = {
      draft: 'Borrador',
      pending: 'Pendiente',
      active: 'Activo',
      past_due: 'Vencido',
      suspended: 'Suspendido',
      cancelled: 'Cancelado',
    };
    return status ? labels[status] || status : 'Sin pago';
  }

  public invoiceStatusLabel(status: CompanyInvoice['status'] | null): string {
    const labels: Record<string, string> = {
      draft: 'Borrador',
      open: 'Pendiente',
      paid: 'Pagada',
      overdue: 'Vencida',
      void: 'Anulada',
      uncollectible: 'Incobrable',
    };
    return status ? labels[status] || status : 'Sin factura';
  }

  public providerLabel(provider: CompanySubscription['provider'] | null | undefined): string {
    const labels: Record<string, string> = {
      stripe: 'Stripe',
      flow: 'Flow',
      mercadopago: 'MercadoPago',
      manual: 'Manual',
    };
    return provider ? labels[provider] || provider : 'Sin proveedor';
  }

  public operationalStatusLabel(status: CompanyRow['operational_status'] | null | undefined): string {
    const labels: Record<string, string> = {
      onboarding: 'Onboarding',
      active: 'Activa',
      paused: 'Pausada',
      inactive: 'Inactiva',
    };
    return status ? labels[status] || status : 'Onboarding';
  }

  public planTierLabel(plan: string | null | undefined): string {
    const labels: Record<string, string> = {
      lite: 'Plataforma',
      empresa: 'Plataforma',
      premium: 'Acompanamiento',
    };
    return plan ? labels[plan] || plan : 'Sin plan';
  }

  private normalizePlanTier(plan: string | null | undefined): 'empresa' | 'premium' {
    return plan === 'premium' ? 'premium' : 'empresa';
  }

  public billingCycleLabel(cycle: CompanyContract['billing_cycle'] | null): string {
    const labels: Record<string, string> = {
      monthly: 'Mensual',
      annual: 'Anual',
      custom: 'Personalizado',
    };
    return cycle ? labels[cycle] || cycle : 'Sin ciclo';
  }

  public documentTitle(documentId: string | null): string {
    return this.documents.find((document) => document.id === documentId)?.title || 'Sin documento asociado';
  }

  public closeIntakeModal(): void {
    this.selectedIntake = null;
  }
}
