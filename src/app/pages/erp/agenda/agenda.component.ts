import { Component, OnInit } from '@angular/core';
import { SupabaseService } from '../../../core/services/supabase.service';

@Component({
  selector: 'app-erp-agenda',
  template: `
<div class="sec-hdr">
  <div><div class="sec-title">Agenda</div><div class="sec-sub">{{ currentMonthLabel }} {{ currentYear }}</div></div>
  <div class="sec-actions">
    <button class="btn-primary" (click)="showForm = true; loadFormData()"><i class="ti ti-plus" style="font-size:13px"></i> Nuevo evento</button>
  </div>
</div>
<div class="card" style="margin-bottom:16px">
  <div style="display:flex;align-items:center;gap:10px;margin-bottom:14px">
    <button class="icon-btn" (click)="prevMonth()"><i class="ti ti-chevron-left"></i></button>
    <span style="font-size:16px;font-weight:600;flex:1;text-align:center">{{ currentMonthLabel }} {{ currentYear }}</span>
    <button class="icon-btn" (click)="nextMonth()"><i class="ti ti-chevron-right"></i></button>
  </div>
  <div class="cal-grid" style="margin-bottom:4px">
    <div class="cal-day-hdr" *ngFor="let d of dayHeaders">{{ d }}</div>
  </div>
  <div class="cal-grid">
    <div class="cal-cell" *ngFor="let cell of calendarCells" [class.other-month]="cell.otherMonth" [class.today]="cell.isToday">
      <div class="cal-num">{{ cell.day }}</div>
      <div class="cal-event" *ngFor="let ev of cell.events" [style.background]="ev.color" [style.color]="ev.textColor">{{ ev.label }}</div>
    </div>
  </div>
</div>
<div class="card">
  <div class="card-hdr"><div class="card-title">Próximos eventos · Hoy {{ today | date:'d MMM' }}</div></div>
  <table>
    <thead><tr><th>Hora</th><th>Servicio</th><th>Mascota(s)</th><th>Dueño</th><th>Empleado</th><th>Estado</th></tr></thead>
    <tbody>
      <tr *ngFor="let b of todayBookings">
        <td class="td-muted">{{ b.scheduled_time | slice:0:5 }}</td>
        <td><span class="badge" [ngClass]="'b-' + (b.service?.category || 'other')">{{ b.service?.name || 'Servicio' }}</span></td>
        <td>{{ b.pet?.name || '—' }}</td>
        <td>{{ b.client?.full_name || '—' }}</td>
        <td>{{ b.employee?.full_name || '—' }}</td>
        <td><span class="badge" [ngClass]="b.statusBadge">{{ b.statusLabel }}</span></td>
      </tr>
      <tr *ngIf="todayBookings.length === 0"><td colspan="6" style="text-align:center;color:var(--text3);padding:30px">No hay eventos para hoy</td></tr>
    </tbody>
  </table>
</div>

<div class="card" *ngIf="showForm" style="max-width:600px;margin-top:16px">
  <div class="card-hdr"><div class="card-title">Nuevo evento</div><button class="btn-secondary" (click)="showForm = false">Cancelar</button></div>
  <div class="form-row"><label class="form-label">Servicio</label><select class="form-select" [(ngModel)]="formData.service_id"><option *ngFor="let s of services" [value]="s.id">{{ s.name }}</option></select></div>
  <div class="form-grid">
    <div class="form-row"><label class="form-label">Cliente</label><select class="form-select" [(ngModel)]="formData.client_id"><option *ngFor="let c of clients" [value]="c.id">{{ c.full_name }}</option></select></div>
    <div class="form-row"><label class="form-label">Mascota</label><select class="form-select" [(ngModel)]="formData.pet_id"><option value="">—</option><option *ngFor="let p of pets" [value]="p.id">{{ p.name }} ({{ p.client?.full_name || '—' }})</option></select></div>
  </div>
  <div class="form-grid">
    <div class="form-row"><label class="form-label">Empleado</label><select class="form-select" [(ngModel)]="formData.employee_id"><option value="">—</option><option *ngFor="let e of employees" [value]="e.id">{{ e.full_name }}</option></select></div>
    <div class="form-row"><label class="form-label">Fecha</label><input class="form-input" type="date" [(ngModel)]="formData.scheduled_date"></div>
  </div>
  <div class="form-grid">
    <div class="form-row"><label class="form-label">Hora</label><input class="form-input" type="time" [(ngModel)]="formData.scheduled_time"></div>
    <div class="form-row"><label class="form-label">Duración (min)</label><input class="form-input" type="number" [(ngModel)]="formData.duration_minutes"></div>
  </div>
  <div class="form-row"><label class="form-label">Precio</label><input class="form-input" type="number" [(ngModel)]="formData.price"></div>
  <button class="btn-primary" (click)="createBooking()" [style.opacity]="saving ? 0.6 : 1">{{ saving ? 'Creando...' : 'Crear evento' }}</button>
</div>
  `,
  styleUrls: ['../erp-shared.scss']
})
export class AgendaComponent implements OnInit {
  today = new Date();
  todayBookings: any[] = [];
  calendarCells: any[] = [];
  currentMonth: number;
  currentYear: number;
  dayHeaders = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
  showForm = false;
  saving = false;
  services: any[] = [];
  clients: any[] = [];
  pets: any[] = [];
  employees: any[] = [];
  formData: any = { service_id: '', client_id: '', pet_id: '', employee_id: '', scheduled_date: '', scheduled_time: '', duration_minutes: 30, price: 0 };
  private companyId: string | null = null;

  private monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
  private statusLabels: Record<string, string> = { scheduled: 'Programado', confirmed: 'Confirmado', in_progress: 'En curso', completed: 'Completado', cancelled: 'Cancelado', no_show: 'No asistió' };
  private statusBadges: Record<string, string> = { scheduled: 'b-pendiente', confirmed: 'b-activo', in_progress: 'b-pendiente', completed: 'b-activo', cancelled: 'b-inactivo', no_show: 'b-inactivo' };

  constructor(private supabase: SupabaseService) {
    this.currentMonth = this.today.getMonth();
    this.currentYear = this.today.getFullYear();
  }

  get currentMonthLabel() { return this.monthNames[this.currentMonth]; }

  async ngOnInit() {
    await this.loadCompanyId();
    await Promise.all([this.loadTodayBookings(), this.buildCalendar()]);
  }

  private async loadCompanyId() {
    const { data: sessionData } = await this.supabase.client.auth.getSession();
    const userId = sessionData?.session?.user?.id;
    if (!userId) return;
    const { data: memberData } = await this.supabase.client
      .from('company_members').select('company_id').eq('user_id', userId).maybeSingle();
    this.companyId = memberData?.company_id ?? null;
  }

  async loadFormData() {
    if (!this.companyId) return;
    const [svcRes, clRes, ptRes, empRes] = await Promise.all([
      this.supabase.client.from('erp_services').select('id, name, category').eq('company_id', this.companyId).eq('is_active', true),
      this.supabase.client.from('erp_clients').select('id, full_name').eq('company_id', this.companyId).eq('is_active', true),
      this.supabase.client.from('erp_pets').select('id, name, client:erp_clients!client_id(full_name)').eq('company_id', this.companyId).eq('is_active', true),
      this.supabase.client.from('erp_employees').select('id, full_name').eq('company_id', this.companyId).eq('is_active', true),
    ]);
    this.services = svcRes.data || [];
    this.clients = clRes.data || [];
    this.pets = ptRes.data || [];
    this.employees = empRes.data || [];
    this.formData = { service_id: '', client_id: '', pet_id: '', employee_id: '', scheduled_date: this.today.toISOString().split('T')[0], scheduled_time: '09:00', duration_minutes: 30, price: 0 };
  }

  async loadTodayBookings() {
    if (!this.companyId) return;
    const today = this.today.toISOString().split('T')[0];
    const { data } = await this.supabase.client
      .from('erp_service_bookings')
      .select('*, service:erp_services!service_id(name, category), pet:erp_pets!pet_id(name), client:erp_clients!client_id(full_name), employee:erp_employees!employee_id(full_name)')
      .eq('company_id', this.companyId)
      .eq('scheduled_date', today)
      .order('scheduled_time', { ascending: true });
    this.todayBookings = (data || []).map((b: any) => ({
      ...b,
      statusLabel: this.statusLabels[b.status] || b.status,
      statusBadge: this.statusBadges[b.status] || 'b-pendiente',
    }));
  }

  async buildCalendar() {
    if (!this.companyId) { this.buildEmptyCalendar(); return; }
    const firstDay = new Date(this.currentYear, this.currentMonth, 1);
    const lastDay = new Date(this.currentYear, this.currentMonth + 1, 0);
    const startPad = firstDay.getDay() === 0 ? 6 : firstDay.getDay() - 1;
    const totalDays = lastDay.getDate();
    const cells: any[] = [];

    const monthStart = `${this.currentYear}-${String(this.currentMonth + 1).padStart(2, '0')}-01`;
    const monthEnd = `${this.currentYear}-${String(this.currentMonth + 1).padStart(2, '0')}-${String(totalDays).padStart(2, '0')}`;
    const { data: bookings } = await this.supabase.client
      .from('erp_service_bookings')
      .select('scheduled_date, service:erp_services!service_id(name, category)')
      .eq('company_id', this.companyId)
      .gte('scheduled_date', monthStart)
      .lte('scheduled_date', monthEnd)
      .not('status', 'eq', 'cancelled');

    const bookingsByDate = new Map<string, any[]>();
    (bookings || []).forEach((b: any) => {
      const date = b.scheduled_date;
      if (!bookingsByDate.has(date)) bookingsByDate.set(date, []);
      bookingsByDate.get(date)!.push(b);
    });

    const eventColors: Record<string, { bg: string; text: string }> = {
      paseo: { bg: '#E1F5EE', text: '#0F6E56' },
      pension: { bg: '#EEEDFE', text: '#534AB7' },
      grooming: { bg: '#E6F1FB', text: '#185FA5' },
      consulta: { bg: '#FAEEDA', text: '#BA7517' },
      adiestramiento: { bg: '#FBEAF0', text: '#993556' },
    };

    const todayStr = this.today.toISOString().split('T')[0];
    const prevMonth = new Date(this.currentYear, this.currentMonth, 0);
    const prevDays = prevMonth.getDate();

    for (let i = startPad - 1; i >= 0; i--) {
      const date = `${this.currentYear}-${String(this.currentMonth).padStart(2, '0')}-${String(prevDays - i).padStart(2, '0')}`;
      cells.push({ day: prevDays - i, otherMonth: true, isToday: false, events: [] });
    }
    for (let d = 1; d <= totalDays; d++) {
      const dateStr = `${this.currentYear}-${String(this.currentMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const dayEvents = (bookingsByDate.get(dateStr) || []).map((b: any) => {
        const cat = b.service?.category || 'other';
        const colors = eventColors[cat] || { bg: '#F1EFE8', text: 'var(--text2)' };
        return { label: b.service?.name || 'Evento', color: colors.bg, textColor: colors.text };
      });
      cells.push({ day: d, otherMonth: false, isToday: dateStr === todayStr, events: dayEvents });
    }
    const remaining = 42 - cells.length;
    for (let d = 1; d <= remaining; d++) {
      cells.push({ day: d, otherMonth: true, isToday: false, events: [] });
    }
    this.calendarCells = cells;
  }

  buildEmptyCalendar() {
    const cells: any[] = [];
    for (let i = 0; i < 42; i++) cells.push({ day: '', otherMonth: true, isToday: false, events: [] });
    this.calendarCells = cells;
  }

  prevMonth() {
    this.currentMonth--;
    if (this.currentMonth < 0) { this.currentMonth = 11; this.currentYear--; }
    this.buildCalendar();
  }

  nextMonth() {
    this.currentMonth++;
    if (this.currentMonth > 11) { this.currentMonth = 0; this.currentYear++; }
    this.buildCalendar();
  }

  async createBooking() {
    if (!this.companyId || !this.formData.service_id || !this.formData.client_id || !this.formData.scheduled_date || !this.formData.scheduled_time) return;
    this.saving = true;
    try {
      const { data: sessionData } = await this.supabase.client.auth.getSession();
      const userId = sessionData?.session?.user?.id;
      const selectedService = this.services.find(s => s.id === this.formData.service_id);
      await this.supabase.client.from('erp_service_bookings').insert({
        company_id: this.companyId,
        service_id: this.formData.service_id,
        client_id: this.formData.client_id,
        pet_id: this.formData.pet_id || null,
        employee_id: this.formData.employee_id || null,
        scheduled_date: this.formData.scheduled_date,
        scheduled_time: this.formData.scheduled_time,
        duration_minutes: this.formData.duration_minutes || 30,
        price: this.formData.price || (selectedService?.base_price || 0),
        status: 'scheduled',
        created_by: userId,
      });
      this.showForm = false;
      await Promise.all([this.loadTodayBookings(), this.buildCalendar()]);
    } finally {
      this.saving = false;
    }
  }
}
