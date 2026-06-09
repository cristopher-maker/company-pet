import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { SupabaseService } from '../../core/services/supabase.service';
import { UiService } from '../../core/services/ui.service';

type CobroRow = {
  id: string;
  reserva_id: string;
  tutor_id: string;
  monto: number;
  moneda: string;
  estado: 'pendiente' | 'pagado' | 'vencido' | 'anulado';
  metodo_pago: string | null;
  pagado_at: string | null;
  created_at: string;
  tutor_name: string;
  pet_name: string;
  service_type: string;
  service_title: string;
  service_date: string;
};

type ComprobanteRecord = {
  id: string;
  url: string;
  tipo: string;
  created_at: string;
};

type BenefitPlan = {
  id: string;
  name: string;
  description: string | null;
  monthly_allowance: number | null;
  used_this_month: number;
};

type BenefitUsageRow = {
  id: string;
  amount_claimed: number;
  status: 'pending' | 'approved' | 'rejected' | 'reimbursed';
  claimed_at: string;
  notes: string | null;
  pet?: { name: string | null } | null;
};

type EmployeePet = {
  id: string;
  name: string;
};

@Component({
  selector: 'app-vouchers',
  templateUrl: './vouchers.page.html',
  styleUrls: ['./vouchers.page.scss'],
})
export class VouchersPage implements OnInit {
  loading = true;
  saving = false;
  profileRole: string | null = null;
  cobros: CobroRow[] = [];
  pendingRequestsCount = 0;
  showComprobanteModal = false;
  showCobroModal = false;
  showBenefitRequestModal = false;
  selectedCobroId: string | null = null;
  selectedCobro: CobroRow | null = null;
  comprobantesMap = new Map<string, ComprobanteRecord[]>();
  comprobanteFile: File | null = null;
  comprobanteTipo = 'transferencia';
  serviciosSinCobro: any[] = [];
  showSinCobro = false;
  companyName: string | null = null;

  // Benefits
  benefitPlan: BenefitPlan | null = null;
  benefitUsages: BenefitUsageRow[] = [];
  employeePets: EmployeePet[] = [];
  benefitRequestPetId = '';
  benefitRequestDescription = '';
  benefitRequestAmount: number | null = null;

  // New cobro form
  newCobroReservaId = '';
  newCobroMonto = 0;
  newCobroTutorId = '';

  constructor(
    public ui: UiService,
    private auth: AuthService,
    private supabase: SupabaseService,
    private router: Router
  ) {}

  async ngOnInit() {
    this.profileRole = await this.auth.getCurrentProfileRole();
    await this.loadCobros();
    if (!this.isCuidador) {
      await this.loadBenefits();
    }
  }

  get totalPendiente(): number {
    return this.cobros.filter((c) => c.estado === 'pendiente').length;
  }

  get totalPagado(): number {
    return this.cobros.filter((c) => c.estado === 'pagado').length;
  }

  get montoTotal(): number {
    return this.cobros.reduce((sum, c) => sum + c.monto, 0);
  }

  get montoPendiente(): number {
    return this.cobros.filter((c) => c.estado === 'pendiente').reduce((sum, c) => sum + c.monto, 0);
  }

  get montoPagado(): number {
    return this.cobros.filter((c) => c.estado === 'pagado').reduce((sum, c) => sum + c.monto, 0);
  }

  get isCuidador(): boolean {
    return this.profileRole === 'cuidador';
  }

  get benefitAvailable(): number {
    if (!this.benefitPlan?.monthly_allowance) return 0;
    return this.benefitPlan.monthly_allowance - (this.benefitPlan.used_this_month ?? 0);
  }

  estadoLabel(estado: string): string {
    const map: Record<string, string> = {
      pendiente: 'Pendiente',
      pagado: 'Pagado',
      vencido: 'Vencido',
      anulado: 'Anulado',
    };
    return map[estado] || estado;
  }

  formatCurrency(amount: number): string {
    return new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(amount);
  }

  formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString('es-CL', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  getComprobantes(cobroId: string): ComprobanteRecord[] {
    return this.comprobantesMap.get(cobroId) ?? [];
  }

  private async loadBenefits(): Promise<void> {
    const user = this.auth.user;
    if (!user) return;

    const { data: membership } = await this.supabase.client
      .from('company_members')
      .select('company_id')
      .eq('user_id', user.id)
      .maybeSingle();

    const companyId = (membership?.company_id as string) ?? null;
    if (!companyId) return;

    const { data: company } = await this.supabase.client
      .from('companies')
      .select('name')
      .eq('id', companyId)
      .maybeSingle();

    this.companyName = (company?.name as string) ?? null;

    const { data: activeSub } = await this.supabase.client
      .from('company_subscriptions')
      .select('*')
      .eq('company_id', companyId)
      .eq('status', 'active')
      .maybeSingle();

    if (!activeSub) return;

    const planTier = (activeSub as any).plan_tier ?? 'basic';

    const [{ data: pets }, { data: usageRows }] = await Promise.all([
      this.supabase.client
        .from('pets')
        .select('id,name')
        .eq('owner_id', user.id)
        .order('created_at', { ascending: false }),
      this.supabase.client
        .from('benefit_usage')
        .select('id, amount_claimed, status, claimed_at, notes, pet:pets!benefit_usage_pet_id_fkey(name)')
        .eq('company_id', companyId)
        .eq('employee_id', user.id)
        .order('claimed_at', { ascending: false })
        .limit(20),
    ]);

    this.employeePets = (pets ?? []).map((pet: any) => ({ id: pet.id, name: pet.name }));
    this.benefitUsages = (usageRows ?? []).map((usage: any) => ({
      ...usage,
      pet: Array.isArray(usage.pet) ? (usage.pet[0] ?? null) : usage.pet,
    })) as BenefitUsageRow[];

    // Calculate used amount this month from benefit usage records.
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const { data: usedUsage } = await this.supabase.client
      .from('benefit_usage')
      .select('amount_claimed,status')
      .eq('company_id', companyId)
      .eq('employee_id', user.id)
      .gte('claimed_at', startOfMonth.toISOString());

    const usedTotal = (usedUsage ?? [])
      .filter((usage: any) => ['pending', 'approved', 'reimbursed'].includes(usage.status))
      .reduce((sum: number, usage: any) => sum + Number(usage.amount_claimed ?? 0), 0);

    const allowances: Record<string, number> = {
      basic: 20000,
      pro: 50000,
      enterprise: 100000,
    };

    this.benefitPlan = {
      id: companyId,
      name: planTier,
      description: this.companyName ? `Beneficio de ${this.companyName}` : null,
      monthly_allowance: allowances[planTier] ?? 0,
      used_this_month: usedTotal,
    };
  }

  async requestBenefit(): Promise<void> {
    if (!this.benefitRequestAmount || this.benefitRequestAmount <= 0) return;
    if (this.benefitRequestAmount > this.benefitAvailable) {
      alert('El monto solicitado supera tu beneficio disponible.');
      return;
    }

    const user = this.auth.user;
    if (!user) return;

    this.saving = true;
    try {
      const { data: membership } = await this.supabase.client
        .from('company_members')
        .select('company_id')
        .eq('user_id', user.id)
        .maybeSingle();

      const companyId = (membership?.company_id as string) ?? null;
      if (!companyId) throw new Error('No perteneces a una empresa activa.');

      const { error } = await this.supabase.client.from('benefit_usage').insert({
        company_id: companyId,
        employee_id: user.id,
        pet_id: this.benefitRequestPetId || null,
        amount_claimed: this.benefitRequestAmount,
        notes: this.benefitRequestDescription.trim() || 'Solicitud de beneficio pet',
        status: 'pending',
      });
      if (error) throw error;

      this.showBenefitRequestModal = false;
      this.benefitRequestAmount = null;
      this.benefitRequestPetId = '';
      this.benefitRequestDescription = '';
      alert('Solicitud registrada. Tu empresa la vera en Uso del beneficio.');
      await this.loadBenefits();
    } catch (err: any) {
      alert('Error al solicitar beneficio: ' + (err?.message ?? 'Desconocido'));
    } finally {
      this.saving = false;
    }
  }

  openBenefitRequestModal(): void {
    this.benefitRequestAmount = null;
    this.benefitRequestPetId = this.employeePets[0]?.id ?? '';
    this.benefitRequestDescription = '';
    this.showBenefitRequestModal = true;
  }

  closeBenefitRequestModal(): void {
    this.showBenefitRequestModal = false;
  }

  private async loadCobros() {
    this.loading = true;
    try {
      const user = this.auth.user;
      if (!user) return;

      const { data: cobrosData, error } = await this.supabase.client
        .from('cobros')
        .select(`
          *,
          reservas!inner(
            id,
            fecha,
            mascota_id,
            pets!inner(name),
            servicios!inner(titulo, tipo)
          ),
          tutor:profiles!cobros_tutor_id_fkey(full_name)
        `)
        .eq(this.isCuidador ? 'cuidador_id' : 'tutor_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      this.cobros = (cobrosData ?? []).map((c: any) => ({
        id: c.id,
        reserva_id: c.reserva_id,
        tutor_id: c.tutor_id,
        monto: c.monto,
        moneda: c.moneda,
        estado: c.estado,
        metodo_pago: c.metodo_pago,
        pagado_at: c.pagado_at,
        created_at: c.created_at,
        tutor_name: c.tutor?.full_name ?? 'Tutor',
        pet_name: c.reservas?.pets?.name ?? 'Mascota',
        service_type: c.reservas?.servicios?.tipo ?? '',
        service_title: c.reservas?.servicios?.titulo ?? '',
        service_date: c.reservas?.fecha ?? '',
      }));

      // Load comprobantes
      const cobroIds = this.cobros.map((c) => c.id);
      if (cobroIds.length > 0) {
        const { data: comps } = await this.supabase.client
          .from('comprobantes')
          .select('*')
          .in('cobro_id', cobroIds)
          .order('created_at', { ascending: false });

        const map = new Map<string, ComprobanteRecord[]>();
        for (const comp of (comps ?? [])) {
          const arr = map.get(comp.cobro_id) ?? [];
          arr.push(comp);
          map.set(comp.cobro_id, arr);
        }
        this.comprobantesMap = map;
      }

      // Load completed services without cobros (for cuidador)
      if (this.isCuidador) {
        const { data: sinCobro } = await this.supabase.client
          .from('reservas')
          .select(`
            id,
            fecha,
            pets(name),
            servicios(titulo, tipo, precio),
            tutor:profiles!reservas_tutor_id_fkey(full_name)
          `)
          .eq('cuidador_id', user.id)
          .eq('estado', 'completada')
          .not('id', 'in', `(${this.cobros.map(c => `"${c.reserva_id}"`).join(',')})`);

        this.serviciosSinCobro = (sinCobro ?? []).map((r: any) => ({
          ...r,
          value: r.servicios?.precio ?? 0,
        }));
      }

    } catch (error: any) {
      console.error('Error cargando cobros:', error);
    } finally {
      this.loading = false;
    }
  }

  openCobroModal(reservaId: string, tutorId: string, monto: number) {
    this.newCobroReservaId = reservaId;
    this.newCobroTutorId = tutorId;
    this.newCobroMonto = monto;
    this.showCobroModal = true;
  }

  closeCobroModal() {
    this.showCobroModal = false;
    this.newCobroReservaId = '';
    this.newCobroTutorId = '';
    this.newCobroMonto = 0;
  }

  async crearCobro() {
    if (!this.newCobroReservaId || this.newCobroMonto <= 0) return;
    this.saving = true;
    try {
      const user = this.auth.user!;
      const { error } = await this.supabase.client
        .from('cobros')
        .insert({
          reserva_id: this.newCobroReservaId,
          tutor_id: this.newCobroTutorId,
          cuidador_id: user.id,
          monto: this.newCobroMonto,
          moneda: 'CLP',
          estado: 'pendiente',
        });

      if (error) throw error;
      this.closeCobroModal();
      await this.loadCobros();
    } catch (error: any) {
      alert('Error al crear cobro: ' + (error?.message ?? 'Desconocido'));
    } finally {
      this.saving = false;
    }
  }

  openComprobanteModal(cobro: CobroRow) {
    this.selectedCobroId = cobro.id;
    this.selectedCobro = cobro;
    this.comprobanteFile = null;
    this.comprobanteTipo = 'transferencia';
    this.showComprobanteModal = true;
  }

  closeComprobanteModal() {
    this.showComprobanteModal = false;
    this.selectedCobroId = null;
    this.selectedCobro = null;
    this.comprobanteFile = null;
  }

  onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      this.comprobanteFile = input.files[0];
    }
  }

  async subirComprobante() {
    if (!this.selectedCobroId || !this.comprobanteFile) return;
    this.saving = true;
    try {
      const filePath = `comprobantes/${this.selectedCobroId}/${Date.now()}_${this.comprobanteFile.name}`;

      const { error: uploadError } = await this.supabase.client.storage
        .from('comprobantes')
        .upload(filePath, this.comprobanteFile);

      if (uploadError) throw uploadError;

      const { data: urlData } = this.supabase.client.storage
        .from('comprobantes')
        .getPublicUrl(filePath);

      await this.supabase.client
        .from('comprobantes')
        .insert({
          cobro_id: this.selectedCobroId,
          url: urlData?.publicUrl ?? '',
          tipo: this.comprobanteTipo,
        });

      // Mark as pagado if pending
      const cobro = this.cobros.find((c) => c.id === this.selectedCobroId);
      if (cobro && cobro.estado === 'pendiente') {
        await this.supabase.client
          .from('cobros')
          .update({ estado: 'pagado', metodo_pago: this.comprobanteTipo, pagado_at: new Date().toISOString() })
          .eq('id', this.selectedCobroId);
      }

      this.closeComprobanteModal();
      await this.loadCobros();
    } catch (error: any) {
      alert('Error al subir comprobante: ' + (error?.message ?? 'Desconocido'));
    } finally {
      this.saving = false;
    }
  }

  async marcarPagado(cobro: CobroRow) {
    if (!confirm(`¿Marcar como pagado el cobro de ${this.formatCurrency(cobro.monto)}?`)) return;
    try {
      await this.supabase.client
        .from('cobros')
        .update({ estado: 'pagado', pagado_at: new Date().toISOString() })
        .eq('id', cobro.id);

      await this.loadCobros();
    } catch (error: any) {
      alert('Error: ' + (error?.message ?? 'Desconocido'));
    }
  }

  async anularCobro(cobro: CobroRow) {
    if (!confirm(`¿Anular cobro de ${this.formatCurrency(cobro.monto)}?`)) return;
    try {
      await this.supabase.client
        .from('cobros')
        .update({ estado: 'anulado' })
        .eq('id', cobro.id);

      await this.loadCobros();
    } catch (error: any) {
      alert('Error: ' + (error?.message ?? 'Desconocido'));
    }
  }

  irAgenda() {
    this.router.navigateByUrl('/tasks');
  }

  trackCobro(_index: number, item: CobroRow): string {
    return item.id;
  }

  trackBenefitUsage(_index: number, item: BenefitUsageRow): string {
    return item.id;
  }

  benefitUsageStatusLabel(status: string): string {
    const map: Record<string, string> = {
      pending: 'Pendiente',
      approved: 'Aprobado',
      rejected: 'Rechazado',
      reimbursed: 'Reembolsado',
    };
    return map[status] || status;
  }

  trackSinCobro(_index: number, item: any): string {
    return item.id;
  }
}
