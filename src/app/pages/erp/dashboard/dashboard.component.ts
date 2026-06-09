import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { SupabaseService } from '../../../core/services/supabase.service';
import { AuthService } from '../../../core/services/auth.service';

interface DashboardMetrics {
  petsInCare: number;
  servicesToday: number;
  servicesCompletedToday: number;
  revenueToday: number;
  pendingInvoices: number;
  pendingInvoiceTotal: number;
  activeEmployees: number;
}

interface TodayBooking {
  id: string;
  scheduled_time: string;
  status: string;
  service: { name: string; category: string } | null;
  pet: { name: string; species: string } | null;
  client: { full_name: string } | null;
  employee: { full_name: string } | null;
  route: { name: string } | null;
}

interface RevenueByService {
  name: string;
  total: number;
  percentage: number;
  color: string;
}

const SERVICE_COLORS: Record<string, string> = {
  paseo: 'var(--green)',
  pension: 'var(--purple)',
  grooming: 'var(--blue)',
  consulta: 'var(--amber)',
  adiestramiento: 'var(--pink)',
  petsitting: 'var(--coral)',
};

const CATEGORY_LABELS: Record<string, string> = {
  paseo: 'Paseo',
  pension: 'Pensión',
  grooming: 'Grooming',
  consulta: 'Consulta',
  adiestramiento: 'Adiestramiento',
  petsitting: 'Petsitting',
};

@Component({
  selector: 'app-erp-dashboard',
  template: `
<div class="sec-hdr">
  <div><div class="sec-title">Dashboard</div><div class="sec-sub">Resumen operativo general</div></div>
  <div class="sec-actions"></div>
</div>

<div class="grid-4">
  <div class="metric">
    <div class="metric-label"><i class="ti ti-paw"></i> En atención hoy</div>
    <div class="metric-value">{{ metrics.petsInCare }}</div>
    <div class="metric-delta" [class.delta-up]="true"><i class="ti ti-trending-up"></i> Mascotas en instalaciones</div>
  </div>
  <div class="metric">
    <div class="metric-label"><i class="ti ti-calendar-check"></i> Servicios hoy</div>
    <div class="metric-value">{{ metrics.servicesToday }}</div>
    <div class="metric-delta" [class.delta-up]="true"><i class="ti ti-check"></i> {{ metrics.servicesCompletedToday }} completados</div>
  </div>
  <div class="metric">
    <div class="metric-label"><i class="ti ti-coin"></i> Ingresos hoy</div>
    <div class="metric-value">{{ metrics.revenueToday | currency:'CLP':'symbol-narrow':'1.0-0' }}</div>
    <div class="metric-delta" [class.delta-up]="true"><i class="ti ti-trending-up"></i> Servicios completados hoy</div>
  </div>
  <div class="metric">
    <div class="metric-label"><i class="ti ti-alert-circle"></i> Pendientes pago</div>
    <div class="metric-value">{{ metrics.pendingInvoices }}</div>
    <div class="metric-delta" [class.delta-dn]="metrics.pendingInvoices > 0"><i class="ti ti-clock"></i> {{ metrics.pendingInvoiceTotal | currency:'CLP':'symbol-narrow':'1.0-0' }} pendiente</div>
  </div>
</div>

<div class="grid-2r">
  <div class="card">
    <div class="card-hdr">
      <div><div class="card-title">Agenda de hoy</div></div>
      <button class="card-action" (click)="goAgenda()">Ver agenda completa</button>
    </div>
    <div *ngIf="todayBookings.length === 0" style="padding:20px;text-align:center;color:var(--text3)">No hay servicios agendados para hoy</div>
    <div class="sched-item" *ngFor="let b of todayBookings">
      <div class="time-lbl">{{ b.scheduled_time | slice:0:5 }}</div>
      <span class="badge" [ngClass]="'b-' + (b.service?.category || 'other')">{{ b.service?.name || 'Servicio' }}</span>
      <div style="flex:1;margin-left:8px">
        <div style="font-size:13px;font-weight:500">{{ b.pet?.name || 'Sin mascota' }}</div>
        <div style="font-size:11px;color:var(--text3)">{{ b.employee?.full_name || 'Sin asignar' }}{{ b.route?.name ? ' · ' + b.route.name : '' }}</div>
      </div>
      <span class="dot" [class.dot-ok]="b.status === 'completed'" [class.dot-warn]="b.status === 'in_progress' || b.status === 'confirmed'" [class.dot-bad]="b.status === 'scheduled'"></span>
    </div>
  </div>

  <div style="display:flex;flex-direction:column;gap:14px">
    <div class="card">
      <div class="card-hdr"><div class="card-title">Equipo activo</div><button class="card-action">Ver todos</button></div>
      <div class="list-row" *ngFor="let e of activeTeam">
        <div class="av" [ngClass]="'av-' + e.color">{{ e.initials }}</div>
        <div style="flex:1">
          <div style="font-size:13px;font-weight:500">{{ e.name }}</div>
          <div style="font-size:11px;color:var(--text3)">{{ e.role }} · {{ e.servicesToday }} servicios</div>
          <div class="prog-bg"><div class="prog-fill" [style.width.%]="e.loadPct" [style.background]="e.barColor"></div></div>
        </div>
        <span class="dot" [class.dot-ok]="e.status === 'available'" [class.dot-warn]="e.status === 'busy'"></span>
      </div>
      <div *ngIf="activeTeam.length === 0" style="padding:10px;text-align:center;color:var(--text3)">Sin empleados activos</div>
    </div>
    <div class="card">
      <div class="card-hdr"><div class="card-title">Ingresos por servicio</div><span style="font-size:11px;color:var(--text3)">Este mes</span></div>
      <div class="stat-row" *ngFor="let r of revenueByService">
        <span>{{ r.name }}</span>
        <div class="stat-bar"><div class="stat-fill" [style.width.%]="r.percentage" [style.background]="r.color"></div></div>
        <span style="font-weight:600">{{ r.total | currency:'CLP':'symbol-narrow':'1.0-0' }}</span>
      </div>
      <div *ngIf="revenueByService.length === 0" style="padding:10px;text-align:center;color:var(--text3)">Sin datos este mes</div>
    </div>
  </div>
</div>

<div class="grid-2">
  <div class="card">
    <div class="card-hdr"><div class="card-title">Mascotas en pensión ahora</div><button class="card-action">Ver habitaciones</button></div>
    <div class="list-row" *ngFor="let p of boardingPets">
      <div class="pet-ic">{{ p.emoji }}</div>
      <div style="flex:1">
        <div style="font-size:13px;font-weight:500">{{ p.name }}</div>
        <div style="font-size:11px;color:var(--text3)">{{ p.detail }}</div>
      </div>
      <span class="chip" [ngClass]="p.chipClass">{{ p.roomName }}</span>
    </div>
    <div *ngIf="boardingPets.length === 0" style="padding:10px;text-align:center;color:var(--text3)">No hay mascotas en pensión</div>
  </div>
  <div class="card">
    <div class="card-hdr"><div class="card-title">Alertas y pendientes</div></div>
    <div class="alert-row ar-red" *ngFor="let a of overdueInvoices">
      <i class="ti ti-coin ar-icon" style="color:var(--red)"></i>
      <div>
        <div class="ar-text">Factura vencida · {{ a.clientName }}</div>
        <div class="ar-meta">{{ a.total | currency:'CLP':'symbol-narrow':'1.0-0' }} · {{ a.serviceDesc }}</div>
      </div>
      <button class="btn-secondary" style="font-size:12px;padding:4px 9px">Cobrar</button>
    </div>
    <div class="alert-row ar-amber" *ngFor="let a of upcomingCheckouts">
      <i class="ti ti-door-exit ar-icon" style="color:var(--warning)"></i>
      <div>
        <div class="ar-text">Check-out {{ a.date }} · {{ a.count }} mascotas</div>
        <div class="ar-meta">Preparar documentación</div>
      </div>
      <button class="btn-secondary" style="font-size:12px;padding:4px 9px">Ver</button>
    </div>
    <div *ngIf="overdueInvoices.length === 0 && upcomingCheckouts.length === 0" style="padding:10px;text-align:center;color:var(--text3)">Sin alertas pendientes</div>
  </div>
</div>
  `,
  styleUrls: ['../erp-shared.scss'],
  styles: [`
    .grid-4 { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 16px; margin-bottom: 16px; }
    .grid-2r { display: grid; grid-template-columns: 1.6fr 1fr; gap: 16px; margin-bottom: 16px; }
    .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 16px; }
    .metric { background: var(--bg2, #ffffff); padding: 20px; border-radius: 12px; border: 1px solid var(--border); box-shadow: 0 2px 4px rgba(0,0,0,0.02); }
    .metric-label { font-size: 13px; color: var(--text2); display: flex; align-items: center; gap: 6px; margin-bottom: 8px; font-weight: 500; }
    .metric-value { font-size: 28px; font-weight: 700; color: var(--text); margin-bottom: 8px; }
    .metric-delta { font-size: 12px; display: flex; align-items: center; gap: 4px; color: var(--text3); }
    .delta-up i { color: var(--green, #22c55e); }
    .delta-dn i { color: var(--red, #ef4444); }
    .sched-item, .list-row, .stat-row, .alert-row { display: flex; align-items: center; padding: 12px 16px; border-bottom: 1px solid var(--border); gap: 12px; }
    .sched-item:last-child, .list-row:last-child, .stat-row:last-child, .alert-row:last-child { border-bottom: none; }
    .time-lbl { font-size: 13px; font-weight: 600; color: var(--text); width: 45px; }
    .av { width: 36px; height: 36px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 600; font-size: 13px; color: #fff; }
    .av-green { background: var(--green, #22c55e); }
    .av-purple { background: var(--purple, #a855f7); }
    .av-blue { background: var(--blue, #3b82f6); }
    .av-amber { background: var(--amber, #f59e0b); }
    .av-pink { background: var(--pink, #ec4899); }
    .av-coral { background: var(--coral, #f43f5e); }
    .prog-bg { background: var(--border); height: 6px; border-radius: 3px; margin-top: 6px; overflow: hidden; width: 100%; }
    .prog-fill { height: 100%; border-radius: 3px; }
    .dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
    .dot-ok { background: var(--green, #22c55e); }
    .dot-warn { background: var(--warning, #f59e0b); }
    .dot-bad { background: var(--red, #ef4444); }
    .stat-bar { flex: 1; height: 8px; background: var(--border); border-radius: 4px; overflow: hidden; }
    .stat-fill { height: 100%; border-radius: 4px; }
    .pet-ic, .ar-icon { width: 36px; height: 36px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 18px; flex-shrink: 0; }
    .pet-ic { background: rgba(0,0,0,0.04); }
    .ar-red .ar-icon { background: rgba(239, 68, 68, 0.1); color: var(--red, #ef4444); }
    .ar-amber .ar-icon { background: rgba(245, 158, 11, 0.1); color: var(--warning, #f59e0b); }
    .ar-text { font-size: 13px; font-weight: 500; color: var(--text); }
    .ar-meta { font-size: 11px; color: var(--text3); margin-top: 2px; }
    @media (max-width: 900px) {
      .grid-4, .grid-2r, .grid-2 { grid-template-columns: 1fr; }
    }
  `]
})
export class DashboardComponent implements OnInit {
  metrics: DashboardMetrics = { petsInCare: 0, servicesToday: 0, servicesCompletedToday: 0, revenueToday: 0, pendingInvoices: 0, pendingInvoiceTotal: 0, activeEmployees: 0 };
  todayBookings: TodayBooking[] = [];
  activeTeam: any[] = [];
  revenueByService: RevenueByService[] = [];
  boardingPets: any[] = [];
  overdueInvoices: any[] = [];
  upcomingCheckouts: any[] = [];

  private companyId: string | null = null;

  constructor(
    private router: Router,
    private supabase: SupabaseService,
    private auth: AuthService,
  ) {}

  async ngOnInit() {
    await this.loadCompanyId();
    await Promise.all([
      this.loadMetrics(),
      this.loadTodayBookings(),
      this.loadActiveTeam(),
      this.loadRevenueByService(),
      this.loadBoardingPets(),
      this.loadOverdueInvoices(),
    ]);
  }

  private async loadCompanyId() {
    const { data: sessionData } = await this.supabase.client.auth.getSession();
    const userId = sessionData?.session?.user?.id;
    if (!userId) return;
    const { data: memberData } = await this.supabase.client
      .from('company_members')
      .select('company_id')
      .eq('user_id', userId)
      .maybeSingle();
    this.companyId = memberData?.company_id ?? null;
  }

  private async loadMetrics() {
    if (!this.companyId) return;
    const { data, error } = await this.supabase.client
      .rpc('erp_dashboard_metrics', { target_company_id: this.companyId });
    if (!error && data && data.length > 0) {
      const row = data[0] as any;
      this.metrics = {
        petsInCare: Number(row.pets_in_care) || 0,
        servicesToday: Number(row.services_today) || 0,
        servicesCompletedToday: Number(row.services_completed_today) || 0,
        revenueToday: Number(row.revenue_today) || 0,
        pendingInvoices: Number(row.pending_invoices) || 0,
        pendingInvoiceTotal: Number(row.pending_invoice_total) || 0,
        activeEmployees: Number(row.active_employees) || 0,
      };
    }
  }

  private async loadTodayBookings() {
    if (!this.companyId) return;
    const today = new Date().toISOString().split('T')[0];
    const { data } = await this.supabase.client
      .from('erp_service_bookings')
      .select('id, scheduled_time, status, service:erp_services!service_id(name, category), pet:erp_pets!pet_id(name, species), client:erp_clients!client_id(full_name), employee:erp_employees!employee_id(full_name), route:erp_walking_routes!route_id(name)')
      .eq('company_id', this.companyId)
      .eq('scheduled_date', today)
      .order('scheduled_time', { ascending: true });
    this.todayBookings = (data || []) as any;
  }

  private async loadActiveTeam() {
    if (!this.companyId) return;
    const today = new Date().toISOString().split('T')[0];
    const { data: employees } = await this.supabase.client
      .from('erp_employees')
      .select('id, full_name, role, max_daily_services, is_active')
      .eq('company_id', this.companyId)
      .eq('is_active', true);
    if (!employees) return;
    const { data: todayServices } = await this.supabase.client
      .from('erp_service_bookings')
      .select('employee_id, id')
      .eq('company_id', this.companyId)
      .eq('scheduled_date', today);
    const counts = new Map<string, number>();
    (todayServices || []).forEach((s: any) => {
      if (s.employee_id) counts.set(s.employee_id, (counts.get(s.employee_id) || 0) + 1);
    });
    const colors = ['green', 'purple', 'blue', 'amber', 'pink', 'coral'];
    this.activeTeam = employees.map((e: any, i: number) => {
      const svcToday = counts.get(e.id) || 0;
      const loadPct = Math.min(100, (svcToday / (e.max_daily_services || 8)) * 100);
      const names = (e.full_name || '').split(' ');
      return {
        name: e.full_name,
        initials: ((names[0]?.[0] || '') + (names[1]?.[0] || '')).toUpperCase(),
        role: e.role,
        servicesToday: svcToday,
        loadPct,
        barColor: colors[i % colors.length] === 'green' ? 'var(--green)' : `var(--${colors[i % colors.length]})`,
        status: loadPct >= 80 ? 'busy' : 'available',
        color: colors[i % colors.length],
      };
    });
  }

  private async loadRevenueByService() {
    if (!this.companyId) return;
    const { data } = await this.supabase.client
      .from('erp_service_bookings')
      .select('price, service:erp_services!service_id(category, name)')
      .eq('company_id', this.companyId)
      .gte('scheduled_date', new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0])
      .lte('scheduled_date', new Date().toISOString().split('T')[0]);
    const byCategory: Record<string, number> = {};
    (data || []).forEach((b: any) => {
      const cat = b.service?.category || 'other';
      byCategory[cat] = (byCategory[cat] || 0) + Number(b.price || 0);
    });
    const total = Object.values(byCategory).reduce((s, v) => s + v, 0);
    this.revenueByService = Object.entries(byCategory).map(([cat, totalRev]) => ({
      name: CATEGORY_LABELS[cat] || cat,
      total: totalRev,
      percentage: total > 0 ? Math.round((totalRev / total) * 100) : 0,
      color: SERVICE_COLORS[cat] || 'var(--text3)',
    }));
  }

  private async loadBoardingPets() {
    if (!this.companyId) return;
    const { data: rooms } = await this.supabase.client
      .from('erp_rooms')
      .select('id, name, current_occupant_id, pet:erp_pets!current_occupant_id(name, species), facility:erp_facilities!facility_id(name)')
      .eq('company_id', this.companyId)
      .eq('status', 'occupied');
    const speciesEmoji: Record<string, string> = { perro: '🐶', gato: '🐱', ave: '🦜', roedor: '🐹', reptil: '🦎', otro: '🐾' };
    this.boardingPets = (rooms || []).filter((r: any) => r.pet).map((r: any) => ({
      name: r.pet.name,
      emoji: speciesEmoji[r.pet.species] || '🐾',
      detail: `${r.pet.species} · ${r.facility?.name || 'Pensión'}`,
      roomName: r.name,
      chipClass: 'chip-green',
    }));
  }

  private async loadOverdueInvoices() {
    if (!this.companyId) return;
    const { data } = await this.supabase.client
      .from('erp_invoices')
      .select('id, total, due_date, client:erp_clients!client_id(full_name), status')
      .eq('company_id', this.companyId)
      .in('status', ['pending', 'overdue'])
      .order('due_date', { ascending: true });
    this.overdueInvoices = (data || []).map((inv: any) => ({
      clientName: inv.client?.full_name || 'Cliente',
      total: Number(inv.total) || 0,
      serviceDesc: inv.status === 'overdue' ? 'Factura vencida' : 'Factura pendiente',
    }));
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];
    const { data: checkouts } = await this.supabase.client
      .from('erp_service_bookings')
      .select('id, pet:erp_pets!pet_id(name)')
      .eq('company_id', this.companyId)
      .eq('scheduled_date', tomorrowStr)
      .in('status', ['scheduled', 'confirmed'])
      .gte('duration_minutes', 600);
    if (checkouts && checkouts.length > 0) {
      this.upcomingCheckouts.push({
        date: tomorrow.toLocaleDateString('es-CL'),
        count: checkouts.length,
      });
    }
  }

  goAgenda(): void {
    this.router.navigate(['/admin', 'agenda']);
  }
}
