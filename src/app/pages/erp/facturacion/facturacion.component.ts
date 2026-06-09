import { Component, OnInit } from '@angular/core';
import { SupabaseService } from '../../../core/services/supabase.service';

@Component({
  selector: 'app-erp-facturacion',
  template: `
<div class="sec-hdr">
  <div><div class="sec-title">Facturación</div><div class="sec-sub">Gestión de cobros y facturas</div></div>
  <div class="sec-actions">
    <button class="btn-primary" (click)="showNewForm = true; loadClients()"><i class="ti ti-plus" style="font-size:13px"></i> Nueva factura</button>
  </div>
</div>
<div class="grid-4" style="margin-bottom:16px">
  <div class="metric"><div class="metric-label"><i class="ti ti-receipt"></i> Pendientes</div><div class="metric-value">{{ pendingCount }}</div><div class="metric-delta" [class.delta-dn]="pendingCount > 0"><i class="ti ti-clock"></i> {{ pendingTotal | currency:'CLP':'symbol-narrow':'1.0-0' }}</div></div>
  <div class="metric"><div class="metric-label"><i class="ti ti-check-circle"></i> Pagadas este mes</div><div class="metric-value">{{ paidCount }}</div><div class="metric-delta delta-up"><i class="ti ti-trending-up"></i> {{ paidTotal | currency:'CLP':'symbol-narrow':'1.0-0' }}</div></div>
  <div class="metric"><div class="metric-label"><i class="ti ti-alert-triangle"></i> Vencidas</div><div class="metric-value">{{ overdueCount }}</div><div class="metric-delta" [class.delta-dn]="overdueCount > 0"><i class="ti ti-clock"></i> {{ overdueTotal | currency:'CLP':'symbol-narrow':'1.0-0' }}</div></div>
  <div class="metric"><div class="metric-label"><i class="ti ti-coin"></i> Total mensual</div><div class="metric-value">{{ monthlyTotal | currency:'CLP':'symbol-narrow':'1.0-0' }}</div></div>
</div>
<div class="card">
  <div class="tabs">
    <button class="tab-btn" [class.on]="filterTab === 'all'" (click)="filterTab = 'all'; filterInvoices()">Todas</button>
    <button class="tab-btn" [class.on]="filterTab === 'pending'" (click)="filterTab = 'pending'; filterInvoices()">Pendientes</button>
    <button class="tab-btn" [class.on]="filterTab === 'paid'" (click)="filterTab = 'paid'; filterInvoices()">Pagadas</button>
    <button class="tab-btn" [class.on]="filterTab === 'overdue'" (click)="filterTab = 'overdue'; filterInvoices()">Vencidas</button>
  </div>
  <table>
    <thead><tr><th>N° Factura</th><th>Cliente</th><th>Servicio</th><th>Monto</th><th>Emisión</th><th>Vencimiento</th><th>Estado</th><th>Acción</th></tr></thead>
    <tbody>
      <tr *ngFor="let inv of filteredInvoices">
        <td class="td-muted">{{ inv.invoice_number }}</td>
        <td>{{ inv.clientName }}</td>
        <td>{{ inv.serviceDesc }}</td>
        <td>{{ inv.total | currency:'CLP':'symbol-narrow':'1.0-0' }}</td>
        <td>{{ inv.created_at | date:'d MMM y' }}</td>
        <td>{{ inv.due_date | date:'d MMM y' }}</td>
        <td><span class="badge" [ngClass]="inv.statusBadge">{{ inv.statusLabel }}</span></td>
        <td>
          <button class="card-action" style="font-size:11px" *ngIf="inv.status !== 'paid'" (click)="markPaid(inv)">Cobrar</button>
          <span *ngIf="inv.status === 'paid'" style="color:var(--green-dark);font-size:12px">✓ Pagada</span>
        </td>
      </tr>
      <tr *ngIf="filteredInvoices.length === 0"><td colspan="8" style="text-align:center;color:var(--text3);padding:30px">No hay facturas</td></tr>
    </tbody>
  </table>
</div>

<div class="card" *ngIf="showNewForm" style="max-width:600px;margin-top:16px">
  <div class="card-hdr"><div class="card-title">Nueva factura</div><button class="btn-secondary" (click)="showNewForm = false">Cancelar</button></div>
  <div class="form-row"><label class="form-label">Cliente</label><select class="form-select" [(ngModel)]="newInvoice.client_id"><option *ngFor="let c of clients" [value]="c.id">{{ c.full_name }}</option></select></div>
  <div class="form-row"><label class="form-label">Descripción</label><input class="form-input" [(ngModel)]="newInvoice.description"></div>
  <div class="form-grid">
    <div class="form-row"><label class="form-label">Monto</label><input class="form-input" type="number" [(ngModel)]="newInvoice.total"></div>
    <div class="form-row"><label class="form-label">Vencimiento</label><input class="form-input" type="date" [(ngModel)]="newInvoice.due_date"></div>
  </div>
  <button class="btn-primary" (click)="createInvoice()" [style.opacity]="saving ? 0.6 : 1">{{ saving ? 'Creando...' : 'Crear factura' }}</button>
</div>
  `,
  styleUrls: ['../erp-shared.scss']
})
export class FacturacionComponent implements OnInit {
  invoices: any[] = [];
  filteredInvoices: any[] = [];
  filterTab = 'all';
  pendingCount = 0;
  pendingTotal = 0;
  paidCount = 0;
  paidTotal = 0;
  overdueCount = 0;
  overdueTotal = 0;
  monthlyTotal = 0;
  showNewForm = false;
  saving = false;
  clients: any[] = [];
  newInvoice: any = { client_id: '', description: '', total: 0, due_date: '' };
  private companyId: string | null = null;

  constructor(private supabase: SupabaseService) {}

  async ngOnInit() {
    await this.loadCompanyId();
    await this.loadInvoices();
  }

  private async loadCompanyId() {
    const { data: sessionData } = await this.supabase.client.auth.getSession();
    const userId = sessionData?.session?.user?.id;
    if (!userId) return;
    const { data: memberData } = await this.supabase.client
      .from('company_members').select('company_id').eq('user_id', userId).maybeSingle();
    this.companyId = memberData?.company_id ?? null;
  }

  async loadClients() {
    if (!this.companyId) return;
    const { data } = await this.supabase.client.from('erp_clients').select('id, full_name').eq('company_id', this.companyId).order('full_name');
    this.clients = data || [];
  }

  async loadInvoices() {
    if (!this.companyId) return;
    const { data: invData } = await this.supabase.client
      .from('erp_invoices')
      .select('*, client:erp_clients!client_id(full_name)')
      .eq('company_id', this.companyId)
      .order('created_at', { ascending: false });

    this.invoices = (invData || []).map((inv: any) => {
      const statusLabel: Record<string, string> = { draft: 'Borrador', pending: 'Pendiente', paid: 'Pagada', overdue: 'Vencida', cancelled: 'Anulada' };
      const statusBadge: Record<string, string> = { draft: 'b-borrador', pending: 'b-pendiente', paid: 'b-pagado', overdue: 'b-vencido', cancelled: 'b-inactivo' };
      return {
        ...inv,
        clientName: inv.client?.full_name || '—',
        statusLabel: statusLabel[inv.status] || inv.status,
        statusBadge: statusBadge[inv.status] || 'b-pendiente',
        serviceDesc: 'Servicios veterinarios',
      };
    });

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
    const monthEnd = now.toISOString().split('T')[0];

    this.pendingCount = this.invoices.filter((i: any) => i.status === 'pending').length;
    this.pendingTotal = this.invoices.filter((i: any) => i.status === 'pending').reduce((s: number, i: any) => s + Number(i.total || 0), 0);
    this.overdueCount = this.invoices.filter((i: any) => i.status === 'overdue').length;
    this.overdueTotal = this.invoices.filter((i: any) => i.status === 'overdue').reduce((s: number, i: any) => s + Number(i.total || 0), 0);
    const monthInvoices = this.invoices.filter((i: any) => i.created_at >= monthStart && i.created_at <= monthEnd);
    this.paidCount = monthInvoices.filter((i: any) => i.status === 'paid').length;
    this.paidTotal = monthInvoices.filter((i: any) => i.status === 'paid').reduce((s: number, i: any) => s + Number(i.total || 0), 0);
    this.monthlyTotal = monthInvoices.reduce((s: number, i: any) => s + Number(i.total || 0), 0);
    this.filterInvoices();
  }

  filterInvoices() {
    if (this.filterTab === 'all') {
      this.filteredInvoices = this.invoices;
    } else {
      this.filteredInvoices = this.invoices.filter((i: any) => i.status === this.filterTab);
    }
  }

  async markPaid(inv: any) {
    await this.supabase.client.from('erp_invoices').update({ status: 'paid', paid_at: new Date().toISOString() }).eq('id', inv.id);
    inv.status = 'paid';
    await this.loadInvoices();
  }

  async createInvoice() {
    if (!this.companyId || !this.newInvoice.client_id || !this.newInvoice.total) return;
    this.saving = true;
    try {
      const { data: sessionData } = await this.supabase.client.auth.getSession();
      const userId = sessionData?.session?.user?.id;
      const count = this.invoices.length + 1;
      await this.supabase.client.from('erp_invoices').insert({
        company_id: this.companyId,
        client_id: this.newInvoice.client_id,
        invoice_number: `FAC-${String(count).padStart(4, '0')}`,
        subtotal: this.newInvoice.total,
        tax: 0,
        total: this.newInvoice.total,
        due_date: this.newInvoice.due_date || null,
        status: 'pending',
        created_by: userId,
      });
      this.showNewForm = false;
      this.newInvoice = { client_id: '', description: '', total: 0, due_date: '' };
      await this.loadInvoices();
    } finally {
      this.saving = false;
    }
  }
}
