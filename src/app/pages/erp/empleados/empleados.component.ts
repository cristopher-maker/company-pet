import { Component, OnInit } from '@angular/core';
import { SupabaseService } from '../../../core/services/supabase.service';

@Component({
  selector: 'app-erp-empleados',
  template: `
<div class="sec-hdr">
  <div><div class="sec-title">Empleados</div><div class="sec-sub">{{ employees.length }} empleados activos</div></div>
  <div class="sec-actions">
    <div class="search-box"><i class="ti ti-search"></i><input placeholder="Buscar…" style="width:130px" [(ngModel)]="searchQuery" (input)="filterEmployees()"></div>
    <button class="btn-primary" (click)="showForm = true; editId = null; formData = { full_name: '', role: 'paseador', phone: '', shift: 'flexible', email: '', max_daily_services: 8, hourly_rate: null, notes: '' }"><i class="ti ti-plus" style="font-size:13px"></i> Nuevo empleado</button>
  </div>
</div>
<div class="grid-4" style="margin-bottom:16px">
  <div class="metric"><div class="metric-label"><i class="ti ti-user-check"></i> Activos</div><div class="metric-value">{{ activeCount }}</div></div>
  <div class="metric"><div class="metric-label"><i class="ti ti-clock"></i> En servicio ahora</div><div class="metric-value">{{ onDutyNow }}</div></div>
  <div class="metric"><div class="metric-label"><i class="ti ti-trending-up"></i> Carga promedio</div><div class="metric-value">{{ avgLoad }}%</div></div>
  <div class="metric"><div class="metric-label"><i class="ti ti-calendar"></i> Turnos hoy</div><div class="metric-value">{{ todayShifts }}</div></div>
</div>

<div class="card" *ngIf="!showForm">
  <div class="card-hdr"><div class="card-title">Equipo</div></div>
  <table>
    <thead><tr><th>Empleado</th><th>Rol</th><th>Teléfono</th><th>Turno</th><th>Servicios hoy</th><th>Carga</th><th>Estado</th><th>Acción</th></tr></thead>
    <tbody>
      <tr *ngFor="let e of filteredEmployees">
        <td><div style="display:flex;align-items:center;gap:8px"><div class="av av-sm" [ngClass]="'av-' + e.color">{{ e.initials }}</div><div><div style="font-weight:500">{{ e.full_name }}</div><div class="td-small">{{ e.email || '' }}</div></div></div></td>
        <td><span class="badge" [ngClass]="e.roleBadge">{{ e.roleLabel }}</span></td>
        <td class="td-muted">{{ e.phone || '—' }}</td>
        <td>{{ e.shiftLabel }}</td>
        <td>{{ e.servicesToday }}</td>
        <td><div class="prog-bg" style="width:80px"><div class="prog-fill" [style.width.%]="e.loadPct" [style.background]="e.barColor"></div></div></td>
        <td><span class="dot" [class.dot-ok]="e.status === 'available'" [class.dot-warn]="e.status === 'busy'" style="margin:0 auto"></span></td>
        <td><button class="card-action" style="font-size:11px" (click)="editEmployee(e)">Editar</button></td>
      </tr>
      <tr *ngIf="filteredEmployees.length === 0"><td colspan="8" style="text-align:center;color:var(--text3);padding:30px">No se encontraron empleados</td></tr>
    </tbody>
  </table>
</div>

<div class="card" *ngIf="showForm" style="max-width:600px">
  <div class="card-hdr"><div class="card-title">{{ editId ? 'Editar' : 'Nuevo' }} empleado</div><button class="btn-secondary" (click)="showForm = false">Cancelar</button></div>
  <div class="form-row"><label class="form-label">Nombre completo</label><input class="form-input" [(ngModel)]="formData.full_name"></div>
  <div class="form-grid">
    <div class="form-row"><label class="form-label">Rol</label><select class="form-select" [(ngModel)]="formData.role"><option value="paseador">Paseador</option><option value="groomer">Groomer</option><option value="veterinario">Veterinario</option><option value="adiestrador">Adiestrador</option><option value="petsitter">Petsitter</option><option value="recepcionista">Recepcionista</option></select></div>
    <div class="form-row"><label class="form-label">Turno</label><select class="form-select" [(ngModel)]="formData.shift"><option value="manana">Mañana</option><option value="tarde">Tarde</option><option value="noche">Noche</option><option value="flexible">Flexible</option></select></div>
  </div>
  <div class="form-grid">
    <div class="form-row"><label class="form-label">Teléfono</label><input class="form-input" [(ngModel)]="formData.phone"></div>
    <div class="form-row"><label class="form-label">Email</label><input class="form-input" [(ngModel)]="formData.email"></div>
  </div>
  <div class="form-grid">
    <div class="form-row"><label class="form-label">Max servicios/día</label><input class="form-input" type="number" [(ngModel)]="formData.max_daily_services"></div>
    <div class="form-row"><label class="form-label">Tarifa hora ($)</label><input class="form-input" type="number" [(ngModel)]="formData.hourly_rate"></div>
  </div>
  <div class="form-row"><label class="form-label">Notas</label><textarea class="form-textarea" [(ngModel)]="formData.notes"></textarea></div>
  <button class="btn-primary" (click)="saveEmployee()" [style.opacity]="saving ? 0.6 : 1">{{ saving ? 'Guardando...' : 'Guardar' }}</button>
</div>
  `,
  styleUrls: ['../erp-shared.scss']
})
export class EmpleadosComponent implements OnInit {
  employees: any[] = [];
  filteredEmployees: any[] = [];
  searchQuery = '';
  showForm = false;
  editId: string | null = null;
  saving = false;
  formData: any = { full_name: '', role: 'paseador', phone: '', shift: 'flexible', email: '', max_daily_services: 8, hourly_rate: null, notes: '' };
  activeCount = 0;
  onDutyNow = 0;
  avgLoad = 0;
  todayShifts = 0;
  private companyId: string | null = null;

  private roleLabels: Record<string, string> = { paseador: 'Paseador', groomer: 'Groomer', veterinario: 'Veterinario', adiestrador: 'Adiestrador', petsitter: 'Petsitter', recepcionista: 'Recepcionista', admin: 'Admin' };
  private roleBadges: Record<string, string> = { paseador: 'b-paseo', groomer: 'b-bano', veterinario: 'b-consulta', adiestrador: 'b-adiestramiento', petsitter: 'b-pension', recepcionista: 'b-paseo', admin: 'b-paseo' };
  private shiftLabels: Record<string, string> = { manana: 'Mañana', tarde: 'Tarde', noche: 'Noche', flexible: 'Flexible' };
  private colors = ['green', 'purple', 'blue', 'amber', 'pink', 'coral'];

  constructor(private supabase: SupabaseService) {}

  async ngOnInit() {
    await this.loadCompanyId();
    await this.loadEmployees();
  }

  private async loadCompanyId() {
    const { data: sessionData } = await this.supabase.client.auth.getSession();
    const userId = sessionData?.session?.user?.id;
    if (!userId) return;
    const { data: memberData } = await this.supabase.client
      .from('company_members').select('company_id').eq('user_id', userId).maybeSingle();
    this.companyId = memberData?.company_id ?? null;
  }

  async loadEmployees() {
    if (!this.companyId) return;
    const today = new Date().toISOString().split('T')[0];
    const { data: empData } = await this.supabase.client
      .from('erp_employees')
      .select('*')
      .eq('company_id', this.companyId)
      .order('full_name', { ascending: true });
    const { data: bookingsData } = await this.supabase.client
      .from('erp_service_bookings')
      .select('employee_id, id')
      .eq('company_id', this.companyId)
      .eq('scheduled_date', today);
    const counts = new Map<string, number>();
    (bookingsData || []).forEach((b: any) => {
      if (b.employee_id) counts.set(b.employee_id, (counts.get(b.employee_id) || 0) + 1);
    });

    this.employees = (empData || []).map((e: any, i: number) => {
      const svcToday = counts.get(e.id) || 0;
      const loadPct = Math.min(100, Math.round((svcToday / (e.max_daily_services || 8)) * 100));
      const names = (e.full_name || '').split(' ');
      return {
        ...e,
        initials: ((names[0]?.[0] || '') + (names[1]?.[0] || '')).toUpperCase(),
        color: this.colors[i % this.colors.length],
        roleLabel: this.roleLabels[e.role] || e.role,
        roleBadge: this.roleBadges[e.role] || 'b-paseo',
        shiftLabel: this.shiftLabels[e.shift] || e.shift,
        servicesToday: svcToday,
        loadPct,
        barColor: this.colors[i % this.colors.length] === 'green' ? 'var(--green)' : `var(--${this.colors[i % this.colors.length]})`,
        status: loadPct >= 80 ? 'busy' : 'available',
      };
    });
    this.filteredEmployees = this.employees;
    this.activeCount = this.employees.filter((e: any) => e.is_active).length;
    this.onDutyNow = this.employees.filter((e: any) => e.servicesToday > 0).length;
    this.avgLoad = this.employees.length > 0 ? Math.round(this.employees.reduce((s: number, e: any) => s + e.loadPct, 0) / this.employees.length) : 0;
    this.todayShifts = this.employees.filter((e: any) => e.servicesToday > 0).length;
    this.filterEmployees();
  }

  filterEmployees() {
    const q = this.searchQuery.toLowerCase().trim();
    this.filteredEmployees = this.employees.filter((e: any) =>
      !q || e.full_name?.toLowerCase().includes(q) || (e.role || '').includes(q)
    );
  }

  editEmployee(e: any) {
    this.showForm = true;
    this.editId = e.id;
    this.formData = { full_name: e.full_name, role: e.role, phone: e.phone || '', shift: e.shift, email: e.email || '', max_daily_services: e.max_daily_services || 8, hourly_rate: e.hourly_rate, notes: e.notes || '' };
  }

  async saveEmployee() {
    if (!this.companyId || !this.formData.full_name) return;
    this.saving = true;
    try {
      const { data: sessionData } = await this.supabase.client.auth.getSession();
      const userId = sessionData?.session?.user?.id;
      if (this.editId) {
        await this.supabase.client.from('erp_employees').update(this.formData).eq('id', this.editId);
      } else {
        await this.supabase.client.from('erp_employees').insert({
          company_id: this.companyId, profile_id: userId, ...this.formData, created_by: userId,
        });
      }
      this.showForm = false;
      await this.loadEmployees();
    } finally {
      this.saving = false;
    }
  }
}
