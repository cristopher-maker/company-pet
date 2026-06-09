import { Component, OnInit } from '@angular/core';
import { SupabaseService } from '../../../core/services/supabase.service';

@Component({
  selector: 'app-erp-historial',
  template: `
<div class="sec-hdr">
  <div><div class="sec-title">Historial médico</div><div class="sec-sub">Registro de vacunas, consultas y próximos vencimientos</div></div>
  <div class="sec-actions">
    <button class="btn-primary" (click)="showForm = true; editRecId = null; recForm = { pet_id: '', record_type: 'vaccine', title: '', description: '', veterinarian: '', date: todayISO, next_due_date: '' }"><i class="ti ti-plus" style="font-size:13px"></i> Nuevo registro</button>
  </div>
</div>

<div *ngIf="notificationMessage" class="alert-row" [ngClass]="notificationMessageKind === 'error' ? 'ar-red' : 'ar-green'">
  <i class="ti ar-icon" [ngClass]="notificationMessageKind === 'error' ? 'ti-alert-circle' : 'ti-check'"></i>
  <div class="ar-text">{{ notificationMessage }}</div>
</div>

<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:18px">
  <div class="stat-card"><div class="stat-v">{{ stats.total }}</div><div class="stat-l">Total registros</div></div>
  <div class="stat-card"><div class="stat-v green">{{ stats.vaccines }}</div><div class="stat-l">Vacunas</div></div>
  <div class="stat-card"><div class="stat-v amber">{{ stats.dueSoon }}</div><div class="stat-l">Próximo a vencer</div></div>
  <div class="stat-card"><div class="stat-v red">{{ stats.overdue }}</div><div class="stat-l">Vencido</div></div>
</div>

<div class="card" style="margin-bottom:16px">
  <div class="card-hdr"><div class="card-title">Registros</div>
    <div style="display:flex;gap:8px;align-items:center">
      <select class="filter-select" [(ngModel)]="typeFilter" (change)="applyFilters()"><option value="">Todos</option><option value="vaccine">Vacuna</option><option value="consultation">Consulta</option><option value="surgery">Cirugía</option><option value="test">Examen</option><option value="other">Otro</option></select>
      <input class="filter-input" [(ngModel)]="searchText" (input)="applyFilters()" placeholder="Buscar mascota...">
    </div>
  </div>
  <table>
    <thead><tr><th>Fecha</th><th>Mascota</th><th>Dueño</th><th>Tipo</th><th>Título</th><th>Veterinario</th><th>Próximo</th></tr></thead>
    <tbody>
      <tr *ngFor="let r of filteredRecords">
        <td>{{ r.record_date | date:'d MMM y' }}</td>
        <td style="font-weight:500">{{ r.pet?.name || '—' }}</td>
        <td class="td-muted">{{ r.pet?.client?.full_name || '—' }}</td>
        <td><span class="badge" [ngClass]="r.typeBadge">{{ r.typeLabel }}</span></td>
        <td>{{ r.title }}</td>
        <td>{{ r.veterinarian || '—' }}</td>
        <td>
          <span *ngIf="r.next_due_date" class="badge" [ngClass]="r.dueBadge">{{ r.next_due_date | date:'d MMM y' }}</span>
          <button *ngIf="r.next_due_date" type="button" class="card-action notify-btn" (click)="notifyOwner(r)">Notificar</button>
          <span *ngIf="!r.next_due_date" class="td-muted">—</span>
        </td>
      </tr>
      <tr *ngIf="filteredRecords.length === 0"><td colspan="7" style="text-align:center;color:var(--text3);padding:30px">No hay registros médicos</td></tr>
    </tbody>
  </table>
</div>

<div class="card" *ngIf="showForm" style="max-width:600px;margin-top:16px">
  <div class="card-hdr"><div class="card-title">Nuevo registro médico</div><button class="btn-secondary" (click)="showForm = false">Cancelar</button></div>
  <div class="form-grid">
    <div class="form-row"><label class="form-label">Mascota</label><select class="form-select" [(ngModel)]="recForm.pet_id"><option *ngFor="let p of pets" [value]="p.id">{{ p.name }} ({{ p.client?.full_name || '—' }})</option></select></div>
    <div class="form-row"><label class="form-label">Tipo</label><select class="form-select" [(ngModel)]="recForm.record_type"><option value="vaccine">Vacuna</option><option value="consultation">Consulta</option><option value="surgery">Cirugía</option><option value="test">Examen</option><option value="other">Otro</option></select></div>
  </div>
  <div class="form-row"><label class="form-label">Título</label><input class="form-input" [(ngModel)]="recForm.title"></div>
  <div class="form-row"><label class="form-label">Descripción</label><textarea class="form-textarea" [(ngModel)]="recForm.description"></textarea></div>
  <div class="form-grid">
    <div class="form-row"><label class="form-label">Veterinario</label><input class="form-input" [(ngModel)]="recForm.veterinarian"></div>
    <div class="form-row"><label class="form-label">Fecha</label><input class="form-input" type="date" [(ngModel)]="recForm.date"></div>
  </div>
  <div class="form-row"><label class="form-label">Próximo vencimiento</label><input class="form-input" type="date" [(ngModel)]="recForm.next_due_date"></div>
  <button class="btn-primary" (click)="saveRecord()" [style.opacity]="saving ? 0.6 : 1">{{ saving ? 'Guardando...' : 'Guardar' }}</button>
</div>
  `,
  styleUrls: ['../erp-shared.scss'],
  styles: [`
    .stat-card{background:var(--bg2);border:1px solid var(--border);border-radius:var(--radius-lg);padding:16px;text-align:center}
    .stat-v{font-size:28px;font-weight:700;color:var(--text1)}.stat-v.green{color:var(--green)}
    .stat-v.amber{color:var(--amber)}.stat-v.red{color:var(--red)}
    .stat-l{font-size:12px;color:var(--text3);margin-top:2px}
    .filter-select,.filter-input{padding:5px 9px;border:1px solid var(--border);border-radius:6px;font-size:12px;color:var(--text1);background:var(--bg2);font-family:inherit}
    .filter-input{width:160px}
    .b-vaccine{background:var(--green-light);color:var(--green-dark)}
    .b-consultation{background:var(--blue-light);color:var(--blue)}
    .b-surgery{background:var(--red-light);color:var(--red)}
    .b-test{background:var(--purple-light);color:var(--purple)}
    .b-other{background:#F1EFE8;color:var(--text3)}
    .b-overdue{background:var(--red-light);color:var(--red)}
    .b-soon{background:var(--amber-light);color:var(--amber)}
    .b-ok{background:var(--green-light);color:var(--green-dark)}
    .notify-btn{font-size:11px;margin-left:8px;padding:3px 8px}
  `]
})
export class HistorialComponent implements OnInit {
  records: any[] = [];
  filteredRecords: any[] = [];
  pets: any[] = [];
  todayISO = new Date().toISOString().split('T')[0];
  showForm = false;
  editRecId: string | null = null;
  recForm: any = { pet_id: '', record_type: 'vaccine', title: '', description: '', veterinarian: '', date: '', next_due_date: '' };
  saving = false;
  searchText = '';
  typeFilter = '';
  notificationMessage = '';
  notificationMessageKind: 'success' | 'error' = 'success';
  stats = { total: 0, vaccines: 0, dueSoon: 0, overdue: 0 };
  private companyId: string | null = null;

  private typeLabels: Record<string, string> = { vaccine: 'Vacuna', consultation: 'Consulta', surgery: 'Cirugía', test: 'Examen', other: 'Otro' };
  private typeBadges: Record<string, string> = { vaccine: 'b-vaccine', consultation: 'b-consultation', surgery: 'b-surgery', test: 'b-test', other: 'b-other' };

  constructor(private supabase: SupabaseService) {}

  async ngOnInit() {
    await this.loadCompanyId();
    await Promise.all([this.loadRecords(), this.loadPets()]);
  }

  private async loadCompanyId() {
    const { data: sessionData } = await this.supabase.client.auth.getSession();
    const userId = sessionData?.session?.user?.id;
    if (!userId) return;
    const { data: memberData } = await this.supabase.client
      .from('company_members').select('company_id').eq('user_id', userId).maybeSingle();
    this.companyId = memberData?.company_id ?? null;
  }

  async loadRecords() {
    if (!this.companyId) return;
    const { data } = await this.supabase.client
      .from('erp_medical_records')
      .select('*, pet:erp_pets!pet_id(name, client:erp_clients!client_id(full_name, phone, email))')
      .eq('company_id', this.companyId)
      .order('record_date', { ascending: false });
    this.records = (data || []).map((r: any) => {
      const today = new Date();
      let dueBadge = '';
      if (r.next_due_date) {
        const dueDate = new Date(r.next_due_date);
        const diffDays = Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        dueBadge = diffDays < 0 ? 'b-overdue' : diffDays <= 30 ? 'b-soon' : 'b-ok';
      }
      return {
        ...r,
        record_date: r.record_date,
        typeLabel: this.typeLabels[r.record_type] || r.record_type,
        typeBadge: this.typeBadges[r.record_type] || 'b-other',
        dueBadge,
      };
    });
    this.computeStats();
    this.applyFilters();
  }

  async loadPets() {
    if (!this.companyId) return;
    const { data } = await this.supabase.client
      .from('erp_pets')
      .select('id, name, client:erp_clients!client_id(full_name)')
      .eq('company_id', this.companyId)
      .eq('is_active', true);
    this.pets = data || [];
  }

  computeStats() {
    const today = new Date();
    this.stats.total = this.records.length;
    this.stats.vaccines = this.records.filter(r => r.record_type === 'vaccine').length;
    this.stats.dueSoon = this.records.filter(r => {
      if (!r.next_due_date) return false;
      const diffDays = Math.ceil((new Date(r.next_due_date).getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      return diffDays >= 0 && diffDays <= 30;
    }).length;
    this.stats.overdue = this.records.filter(r => {
      if (!r.next_due_date) return false;
      return new Date(r.next_due_date) < today;
    }).length;
  }

  applyFilters() {
    let filtered = [...this.records];
    if (this.typeFilter) filtered = filtered.filter(r => r.record_type === this.typeFilter);
    if (this.searchText) filtered = filtered.filter(r =>
      r.pet?.name?.toLowerCase().includes(this.searchText.toLowerCase()) ||
      r.title?.toLowerCase().includes(this.searchText.toLowerCase())
    );
    this.filteredRecords = filtered;
  }

  async saveRecord() {
    if (!this.companyId || !this.recForm.pet_id || !this.recForm.title) return;
    this.saving = true;
    try {
      const { data: sessionData } = await this.supabase.client.auth.getSession();
      const userId = sessionData?.session?.user?.id;
      await this.supabase.client.from('erp_medical_records').insert({
        company_id: this.companyId,
        pet_id: this.recForm.pet_id,
        record_type: this.recForm.record_type,
        title: this.recForm.title,
        description: this.recForm.description || null,
        veterinarian: this.recForm.veterinarian || null,
        record_date: this.recForm.date || this.todayISO,
        next_due_date: this.recForm.next_due_date || null,
        created_by: userId,
      });
      this.showForm = false;
      await this.loadRecords();
    } finally {
      this.saving = false;
    }
  }

  notifyOwner(record: any) {
    this.notificationMessage = '';
    const owner = record.pet?.client;
    const ownerName = owner?.full_name || 'tutor';
    const petName = record.pet?.name || 'tu mascota';
    const dueLabel = this.formatDueDate(record.next_due_date);
    const message = `Hola ${ownerName}, te recordamos que ${record.title} de ${petName} vence el ${dueLabel}. Puedes agendar una visita con nosotros para actualizarlo.`;
    const phone = this.normalizePhone(owner?.phone);

    if (phone) {
      window.open(`https://wa.me/${phone}?text=${encodeURIComponent(message)}`, '_blank');
      this.setNotificationMessage(`Mensaje preparado por WhatsApp para ${ownerName}.`, 'success');
      return;
    }

    if (owner?.email) {
      const subject = `Recordatorio medico de ${petName}`;
      window.location.href = `mailto:${owner.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(message)}`;
      this.setNotificationMessage(`Mensaje preparado por email para ${ownerName}.`, 'success');
      return;
    }

    this.setNotificationMessage(`No hay telefono ni email registrado para ${ownerName}.`, 'error');
  }

  private normalizePhone(phone: string | null | undefined): string {
    const digits = (phone || '').replace(/\D/g, '');
    if (!digits) return '';
    if (digits.startsWith('56')) return digits;
    if (digits.length === 9) return `56${digits}`;
    return digits;
  }

  private formatDueDate(value: string | null | undefined): string {
    if (!value) return 'la fecha indicada';
    return new Intl.DateTimeFormat('es-CL', { day: '2-digit', month: 'long', year: 'numeric' }).format(new Date(value));
  }

  private setNotificationMessage(message: string, kind: 'success' | 'error') {
    this.notificationMessage = message;
    this.notificationMessageKind = kind;
  }
}
