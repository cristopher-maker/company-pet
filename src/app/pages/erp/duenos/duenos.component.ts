import { Component, OnInit } from '@angular/core';
import { SupabaseService } from '../../../core/services/supabase.service';

@Component({
  selector: 'app-erp-duenos',
  template: `
<div class="sec-hdr">
  <div><div class="sec-title">Dueños de mascotas</div><div class="sec-sub">{{ clients.length }} clientes registrados</div></div>
  <div class="sec-actions">
    <div class="search-box"><i class="ti ti-search"></i><input placeholder="Buscar dueño…" style="width:130px" [(ngModel)]="searchQuery" (input)="filterClients()"></div>
    <button class="btn-primary" (click)="showForm = true; editId = null; formData = { full_name: '', email: '', phone: '', address: '', notes: '' }"><i class="ti ti-plus" style="font-size:13px"></i> Nuevo dueño</button>
  </div>
</div>

<div class="card" *ngIf="!showForm">
  <table>
    <thead><tr><th>Cliente</th><th>Mascotas</th><th>Teléfono</th><th>Servicios activos</th><th>Deuda pendiente</th><th>Desde</th><th>Estado</th><th>Acción</th></tr></thead>
    <tbody>
      <tr *ngFor="let c of filteredClients">
        <td><div style="display:flex;align-items:center;gap:8px"><div class="av av-sm" [ngStyle]="{'background': c.avatarColor}">{{ c.initials }}</div><div><div style="font-weight:500">{{ c.full_name }}</div><div class="td-small">{{ c.email }}</div></div></div></td>
        <td>{{ c.petsList }}</td>
        <td class="td-muted">{{ c.phone }}</td>
        <td><span class="badge" *ngIf="c.activeService" [ngClass]="'b-' + c.activeServiceCat">{{ c.activeService }}</span><span *ngIf="!c.activeService">—</span></td>
        <td [style.color]="c.debt > 0 ? 'var(--red)' : 'var(--green-dark)'" style="font-weight:500">{{ c.debt | currency:'CLP':'symbol-narrow':'1.0-0' }}</td>
        <td class="td-small">{{ c.registered_at | date:'MMM y' }}</td>
        <td><span class="badge" [ngClass]="c.is_active ? 'b-activo' : 'b-inactivo'">{{ c.is_active ? 'Activo' : 'Inactivo' }}</span></td>
        <td>
          <button class="card-action" style="font-size:11px;margin-right:4px" (click)="editClient(c)">Editar</button>
          <button class="card-action" style="font-size:11px;border-color:var(--red);color:var(--red)" (click)="toggleActive(c)">{{ c.is_active ? 'Desactivar' : 'Activar' }}</button>
        </td>
      </tr>
      <tr *ngIf="filteredClients.length === 0"><td colspan="8" style="text-align:center;color:var(--text3);padding:30px">No se encontraron clientes</td></tr>
    </tbody>
  </table>
</div>

<div class="card" *ngIf="showForm" style="max-width:600px">
  <div class="card-hdr"><div class="card-title">{{ editId ? 'Editar' : 'Nuevo' }} dueño</div><button class="btn-secondary" (click)="showForm = false">Cancelar</button></div>
  <div class="form-row"><label class="form-label">Nombre completo</label><input class="form-input" [(ngModel)]="formData.full_name"></div>
  <div class="form-grid">
    <div class="form-row"><label class="form-label">Email</label><input class="form-input" [(ngModel)]="formData.email"></div>
    <div class="form-row"><label class="form-label">Teléfono</label><input class="form-input" [(ngModel)]="formData.phone"></div>
  </div>
  <div class="form-row"><label class="form-label">Dirección</label><input class="form-input" [(ngModel)]="formData.address"></div>
  <div class="form-row"><label class="form-label">Notas</label><textarea class="form-textarea" [(ngModel)]="formData.notes"></textarea></div>
  <button class="btn-primary" (click)="saveClient()" [style.opacity]="saving ? 0.6 : 1">{{ saving ? 'Guardando...' : 'Guardar' }}</button>
</div>
  `,
  styleUrls: ['../erp-shared.scss']
})
export class DuenosComponent implements OnInit {
  clients: any[] = [];
  filteredClients: any[] = [];
  searchQuery = '';
  showForm = false;
  editId: string | null = null;
  saving = false;
  formData: any = { full_name: '', email: '', phone: '', address: '', notes: '' };
  private companyId: string | null = null;

  private avatarColors = ['var(--green)', 'var(--purple)', 'var(--blue)', 'var(--amber)', 'var(--pink)', 'var(--coral)', '#888780'];

  constructor(private supabase: SupabaseService) {}

  async ngOnInit() {
    await this.loadCompanyId();
    await this.loadClients();
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
    const { data: clientsData } = await this.supabase.client
      .from('erp_clients')
      .select('*')
      .eq('company_id', this.companyId)
      .order('full_name', { ascending: true });
    const { data: petsData } = await this.supabase.client
      .from('erp_pets')
      .select('id, name, species, client_id')
      .eq('company_id', this.companyId);
    const { data: bookingsData } = await this.supabase.client
      .from('erp_service_bookings')
      .select('id, client_id, status, service:erp_services!service_id(name, category)')
      .eq('company_id', this.companyId)
      .in('status', ['scheduled', 'confirmed', 'in_progress']);
    const { data: invoicesData } = await this.supabase.client
      .from('erp_invoices')
      .select('id, client_id, total, status')
      .eq('company_id', this.companyId)
      .in('status', ['pending', 'overdue']);

    const petsByClient = new Map<string, any[]>();
    (petsData || []).forEach((p: any) => {
      if (!petsByClient.has(p.client_id)) petsByClient.set(p.client_id, []);
      petsByClient.get(p.client_id)!.push(p);
    });
    const bookingsByClient = new Map<string, any[]>();
    (bookingsData || []).forEach((b: any) => {
      if (!bookingsByClient.has(b.client_id)) bookingsByClient.set(b.client_id, []);
      bookingsByClient.get(b.client_id)!.push(b);
    });
    const debtByClient = new Map<string, number>();
    (invoicesData || []).forEach((inv: any) => {
      debtByClient.set(inv.client_id, (debtByClient.get(inv.client_id) || 0) + Number(inv.total || 0));
    });

    const speciesEmoji: Record<string, string> = { perro: '🐶', gato: '🐱', ave: '🦜', roedor: '🐹', reptil: '🦎', otro: '🐾' };
    this.clients = (clientsData || []).map((c: any, i: number) => {
      const pets = petsByClient.get(c.id) || [];
      const bookings = bookingsByClient.get(c.id) || [];
      const names = (c.full_name || '').split(' ');
      return {
        ...c,
        initials: ((names[0]?.[0] || '') + (names[1]?.[0] || '')).toUpperCase(),
        avatarColor: this.avatarColors[i % this.avatarColors.length],
        petsList: pets.map((p: any) => `${p.name} ${speciesEmoji[p.species] || '🐾'}`).join(' ') || '—',
        activeService: bookings.map((b: any) => b.service?.name).filter(Boolean).join(', ') || null,
        activeServiceCat: bookings[0]?.service?.category || null,
        debt: debtByClient.get(c.id) || 0,
      };
    });
    this.filterClients();
  }

  filterClients() {
    const q = this.searchQuery.toLowerCase().trim();
    this.filteredClients = this.clients.filter(c =>
      !q || c.full_name.toLowerCase().includes(q) || (c.email || '').toLowerCase().includes(q) || (c.phone || '').includes(q)
    );
  }

  editClient(c: any) {
    this.showForm = true;
    this.editId = c.id;
    this.formData = { full_name: c.full_name, email: c.email || '', phone: c.phone, address: c.address || '', notes: c.notes || '' };
  }

  async saveClient() {
    if (!this.companyId || !this.formData.full_name || !this.formData.phone) return;
    this.saving = true;
    try {
      const { data: sessionData } = await this.supabase.client.auth.getSession();
      const userId = sessionData?.session?.user?.id;
      if (this.editId) {
        await this.supabase.client.from('erp_clients').update({ ...this.formData }).eq('id', this.editId);
      } else {
        await this.supabase.client.from('erp_clients').insert({
          company_id: this.companyId,
          ...this.formData,
          created_by: userId,
        });
      }
      this.showForm = false;
      await this.loadClients();
    } finally {
      this.saving = false;
    }
  }

  async toggleActive(c: any) {
    await this.supabase.client.from('erp_clients').update({ is_active: !c.is_active }).eq('id', c.id);
    c.is_active = !c.is_active;
  }
}
