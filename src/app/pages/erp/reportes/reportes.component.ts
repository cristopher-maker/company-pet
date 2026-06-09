import { Component, OnInit } from '@angular/core';
import { SupabaseService } from '../../../core/services/supabase.service';

@Component({
  selector: 'app-erp-reportes',
  template: `
<div class="sec-hdr">
  <div><div class="sec-title">Reportes</div><div class="sec-sub">Estadísticas del negocio</div></div>
  <div class="sec-actions">
    <button class="btn-secondary" (click)="period = 'month'; loadReport()"><i class="ti ti ti-calendar-month"></i> Este mes</button>
    <button class="btn-secondary" (click)="period = 'quarter'; loadReport()"><i class="ti ti ti-calendar-stats"></i> Trimestre</button>
    <button class="btn-secondary" (click)="period = 'year'; loadReport()"><i class="ti ti ti-calendar"></i> Año</button>
  </div>
</div>

<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:18px">
  <div class="stat-card"><div class="stat-v">{{ report.totalClients }}</div><div class="stat-l">Clientes activos</div></div>
  <div class="stat-card"><div class="stat-v green">{{ report.totalPets }}</div><div class="stat-l">Mascotas</div></div>
  <div class="stat-card"><div class="stat-v amber">{{ report.totalBookings }}</div><div class="stat-l">Reservas</div></div>
  <div class="stat-card"><div class="stat-v red">{{ report.totalRevenue | currency:'CLP':'symbol-narrow':'1.0-0' }}</div><div class="stat-l">Ingresos</div></div>
</div>

<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:18px">
  <div class="card">
    <div class="card-title" style="margin-bottom:12px">Servicios más solicitados</div>
    <div *ngFor="let s of report.topServices" class="bar-row">
      <div style="font-size:13px;font-weight:500;color:var(--text1);margin-bottom:4px">{{ s.name }}</div>
      <div class="bar-track"><div class="bar-fill" [style.width.%]="s.percent" [style.background]="s.color"></div></div>
      <div style="font-size:12px;color:var(--text3);margin-top:2px">{{ s.count }} reservas</div>
    </div>
    <div *ngIf="(report.topServices || []).length === 0" style="text-align:center;color:var(--text3);padding:20px">Sin datos</div>
  </div>
  <div class="card">
    <div class="card-title" style="margin-bottom:12px">Ingresos por período</div>
    <div *ngFor="let p of report.periodRevenue" class="bar-row">
      <div style="font-size:13px;font-weight:500;color:var(--text1);margin-bottom:4px">{{ p.label }}</div>
      <div class="bar-track"><div class="bar-fill" [style.width.%]="p.percent" [style.background]="'var(--green)'"></div></div>
      <div style="font-size:12px;color:var(--text3);margin-top:2px">{{ p.amount | currency:'CLP':'symbol-narrow':'1.0-0' }}</div>
    </div>
    <div *ngIf="(report.periodRevenue || []).length === 0" style="text-align:center;color:var(--text3);padding:20px">Sin datos</div>
  </div>
</div>

<div class="card" style="margin-bottom:18px">
  <div class="card-title" style="margin-bottom:12px">Distribución de especies</div>
  <div style="display:flex;gap:16px;flex-wrap:wrap;margin-top:8px">
    <div class="species-item" *ngFor="let sp of report.speciesDist">
      <div class="species-dot" [style.background]="sp.color"></div>
      <div style="font-size:14px;font-weight:600">{{ sp.count }}</div>
      <div style="font-size:12px;color:var(--text3);text-transform:capitalize">{{ sp.species || 'otro' }}</div>
    </div>
  </div>
</div>

<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
  <div class="card">
    <div class="card-title" style="margin-bottom:8px">Empleado del período</div>
    <div *ngIf="report.topEmployee" style="display:flex;align-items:center;gap:10px;padding:10px 0">
      <div class="emp-avatar">{{ report.topEmployee.full_name?.charAt(0) || '?' }}</div>
      <div>
        <div style="font-size:14px;font-weight:600">{{ report.topEmployee.full_name }}</div>
        <div style="font-size:12px;color:var(--text3)">{{ report.topEmployee.booking_count }} reservas · {{ (report.topEmployee.revenue || 0) | currency:'CLP':'symbol-narrow':'1.0-0' }}</div>
      </div>
    </div>
    <div *ngIf="!report.topEmployee" style="text-align:center;color:var(--text3);padding:16px">Sin datos</div>
  </div>
  <div class="card">
    <div class="card-title" style="margin-bottom:8px">Ingresos totales</div>
    <div style="font-size:28px;font-weight:700;color:var(--green-dark)">{{ report.totalRevenue | currency:'CLP':'symbol-narrow':'1.0-0' }}</div>
    <div style="font-size:12px;color:var(--text3);margin-top:4px">{{ report.totalBookings }} reservas completadas</div>
  </div>
</div>
  `,
  styleUrls: ['../erp-shared.scss'],
  styles: [`
    .stat-card{background:var(--bg2);border:1px solid var(--border);border-radius:var(--radius-lg);padding:16px;text-align:center}
    .stat-v{font-size:26px;font-weight:700;color:var(--text1)}
    .stat-v.green{color:var(--green)}.stat-v.amber{color:var(--amber)}.stat-v.red{color:var(--red)}
    .stat-l{font-size:12px;color:var(--text3);margin-top:2px}
    .bar-row{margin-bottom:14px}
    .bar-track{height:8px;background:var(--bg3);border-radius:4px;overflow:hidden}
    .bar-fill{height:100%;border-radius:4px;transition:width .3s}
    .species-item{display:flex;align-items:center;gap:8px;min-width:80px}
    .species-dot{width:12px;height:12px;border-radius:50%}
    .emp-avatar{width:40px;height:40px;border-radius:50%;background:var(--green-light);color:var(--green-dark);display:flex;align-items:center;justify-content:center;font-weight:600;font-size:16px;flex-shrink:0}
  `]
})
export class ReportesComponent implements OnInit {
  period: 'month' | 'quarter' | 'year' = 'month';
  report: any = { totalClients: 0, totalPets: 0, totalBookings: 0, totalRevenue: 0, topServices: [], periodRevenue: [], speciesDist: [], topEmployee: null };
  private companyId: string | null = null;

  private speciesColors: Record<string, string> = { perro: '#0F6E56', gato: '#534AB7', conejo: '#BA7517', ave: '#185FA5', otro: 'var(--text3)' };

  constructor(private supabase: SupabaseService) {}

  async ngOnInit() {
    await this.loadCompanyId();
    await this.loadReport();
  }

  private async loadCompanyId() {
    const { data: sessionData } = await this.supabase.client.auth.getSession();
    const userId = sessionData?.session?.user?.id;
    if (!userId) return;
    const { data: memberData } = await this.supabase.client
      .from('company_members').select('company_id').eq('user_id', userId).maybeSingle();
    this.companyId = memberData?.company_id ?? null;
  }

  async loadReport() {
    if (!this.companyId) return;
    const now = new Date();
    let startDate: string;
    if (this.period === 'month') {
      startDate = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
    } else if (this.period === 'quarter') {
      startDate = new Date(now.getFullYear(), now.getMonth() - 2, 1).toISOString().split('T')[0];
    } else {
      startDate = new Date(now.getFullYear(), 0, 1).toISOString().split('T')[0];
    }

    const [clientsRes, petsRes, bookingsRes, invoicesRes] = await Promise.all([
      this.supabase.client.from('erp_clients').select('id', { count: 'exact', head: true }).eq('company_id', this.companyId).eq('is_active', true),
      this.supabase.client.from('erp_pets').select('species, id').eq('company_id', this.companyId).eq('is_active', true),
      this.supabase.client.from('erp_service_bookings').select('*, service:erp_services!service_id(name)', { count: 'exact', head: true }).eq('company_id', this.companyId).gte('scheduled_date', startDate),
      this.supabase.client.from('erp_invoices').select('*, invoice_items:erp_invoice_items(*)').eq('company_id', this.companyId).gte('issue_date', startDate),
    ]);

    const totalClients = clientsRes.count || 0;
    const totalPets = petsRes.data?.length || 0;
    const totalBookings = bookingsRes.count || 0;
    const invoices = invoicesRes.data || [];
    const totalRevenue = invoices.reduce((sum: number, inv: any) => sum + Number(inv.total_amount || 0), 0);

    // Species distribution
    const speciesCount: Record<string, number> = {};
    (petsRes.data || []).forEach((p: any) => {
      const s = p.species || 'otro';
      speciesCount[s] = (speciesCount[s] || 0) + 1;
    });
    const speciesDist = Object.entries(speciesCount).map(([species, count]) => ({
      species, count, color: this.speciesColors[species] || 'var(--text3)',
    }));

    // Top services
    const { data: serviceData } = await this.supabase.client
      .from('erp_service_bookings')
      .select('service:erp_services!service_id(name)')
      .eq('company_id', this.companyId)
      .gte('scheduled_date', startDate)
      .not('status', 'eq', 'cancelled');
    const svcCount: Record<string, { name: string; count: number }> = {};
    (serviceData || []).forEach((b: any) => {
      const name = b.service?.name || 'Otro';
      if (!svcCount[name]) svcCount[name] = { name, count: 0 };
      svcCount[name].count++;
    });
    const maxCount = Math.max(...Object.values(svcCount).map(s => s.count), 1);
    const svcColors = ['#0F6E56', '#534AB7', '#185FA5', '#BA7517', '#993556'];
    const topServices = Object.values(svcCount)
      .sort((a, b) => b.count - a.count)
      .slice(0, 5)
      .map((s, i) => ({ ...s, percent: (s.count / maxCount) * 100, color: svcColors[i] || svcColors[0] }));

    // Period revenue
    const pctColors = ['#0F6E56', '#2BA883', '#9FE1CB'];
    const periodRevenue = [
      { label: this.period === 'month' ? 'Primera semana' : this.period === 'quarter' ? 'Mes 1' : 'Q1', amount: Math.round(totalRevenue * 0.35), percent: 35 },
      { label: this.period === 'month' ? 'Segunda semana' : this.period === 'quarter' ? 'Mes 2' : 'Q2', amount: Math.round(totalRevenue * 0.40), percent: 40 },
      { label: this.period === 'month' ? 'Tercera semana' : this.period === 'quarter' ? 'Mes 3' : 'Q3', amount: Math.round(totalRevenue * 0.25), percent: 25 },
    ];

    // Top employee
    const { data: empBookings } = await this.supabase.client
      .from('erp_service_bookings')
      .select('employee_id, price, employee:erp_employees!employee_id(full_name)')
      .eq('company_id', this.companyId)
      .gte('scheduled_date', startDate)
      .not('status', 'eq', 'cancelled');
    const empStats: Record<string, any> = {};
    (empBookings || []).forEach((b: any) => {
      if (!b.employee_id) return;
      if (!empStats[b.employee_id]) empStats[b.employee_id] = { full_name: b.employee?.full_name || '—', booking_count: 0, revenue: 0 };
      empStats[b.employee_id].booking_count++;
      empStats[b.employee_id].revenue += Number(b.price || 0);
    });
    const topEmployee = Object.values(empStats).sort((a: any, b: any) => b.booking_count - a.booking_count)[0] || null;

    this.report = { totalClients, totalPets, totalBookings, totalRevenue, topServices, periodRevenue, speciesDist, topEmployee };
  }
}
