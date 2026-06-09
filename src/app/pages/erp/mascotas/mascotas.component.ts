import { Component, OnInit } from '@angular/core';
import { SupabaseService } from '../../../core/services/supabase.service';

@Component({
  selector: 'app-erp-mascotas',
  template: `
<div class="sec-hdr">
  <div><div class="sec-title">Mascotas</div><div class="sec-sub">{{ pets.length }} mascotas registradas</div></div>
  <div class="sec-actions">
    <div class="subtabs">
      <button class="stab" [class.on]="speciesFilter === 'all'" (click)="speciesFilter = 'all'; filterPets()">Todos</button>
      <button class="stab" [class.on]="speciesFilter === 'perro'" (click)="speciesFilter = 'perro'; filterPets()">🐶 Perros</button>
      <button class="stab" [class.on]="speciesFilter === 'gato'" (click)="speciesFilter = 'gato'; filterPets()">🐱 Gatos</button>
      <button class="stab" [class.on]="speciesFilter === 'other'" (click)="speciesFilter = 'other'; filterPets()">🐰 Otros</button>
    </div>
    <button class="btn-primary" (click)="showForm = true; editId = null; formData = { name: '', species: 'perro', breed: '', birth_date: '', sex: 'desconocido', weight_kg: null, notes: '', client_id: '' }"><i class="ti ti-plus" style="font-size:13px"></i> Registrar mascota</button>
  </div>
</div>

<div class="card" *ngIf="!showForm">
  <table>
    <thead><tr><th>Mascota</th><th>Especie / Raza</th><th>Edad</th><th>Dueño</th><th>Vacunas</th><th>Último servicio</th><th>Estado</th><th>Acción</th></tr></thead>
    <tbody>
      <tr *ngFor="let p of filteredPets">
        <td><div style="display:flex;align-items:center;gap:8px"><span style="font-size:15px">{{ p.emoji }}</span><div style="font-weight:500">{{ p.name }}</div></div></td>
        <td><span class="badge" [ngClass]="'b-' + p.species"></span> <span class="td-small">{{ p.breed || '' }}</span></td>
        <td class="td-muted">{{ p.age }}</td>
        <td>{{ p.ownerName }}</td>
        <td><span class="chip" [ngClass]="p.vaccineChip">{{ p.vaccineStatus }}</span></td>
        <td class="td-small">{{ p.lastService }}</td>
        <td><span class="badge" [ngClass]="p.statusBadge">{{ p.statusLabel }}</span></td>
        <td>
          <button class="card-action" style="font-size:11px;margin-right:4px" (click)="editPet(p)">Editar</button>
        </td>
      </tr>
      <tr *ngIf="filteredPets.length === 0"><td colspan="8" style="text-align:center;color:var(--text3);padding:30px">No se encontraron mascotas</td></tr>
    </tbody>
  </table>
</div>

<div class="card" *ngIf="showForm" style="max-width:600px">
  <div class="card-hdr"><div class="card-title">{{ editId ? 'Editar' : 'Registrar' }} mascota</div><button class="btn-secondary" (click)="showForm = false">Cancelar</button></div>
  <div class="form-row"><label class="form-label">Nombre</label><input class="form-input" [(ngModel)]="formData.name"></div>
  <div class="form-grid">
    <div class="form-row"><label class="form-label">Especie</label><select class="form-select" [(ngModel)]="formData.species"><option value="perro">Perro</option><option value="gato">Gato</option><option value="ave">Ave</option><option value="roedor">Roedor</option><option value="reptil">Reptil</option><option value="otro">Otro</option></select></div>
    <div class="form-row"><label class="form-label">Raza</label><input class="form-input" [(ngModel)]="formData.breed"></div>
  </div>
  <div class="form-grid">
    <div class="form-row"><label class="form-label">Fecha nacimiento</label><input class="form-input" type="date" [(ngModel)]="formData.birth_date"></div>
    <div class="form-row"><label class="form-label">Sexo</label><select class="form-select" [(ngModel)]="formData.sex"><option value="macho">Macho</option><option value="hembra">Hembra</option><option value="desconocido">Desconocido</option></select></div>
  </div>
  <div class="form-grid">
    <div class="form-row"><label class="form-label">Peso (kg)</label><input class="form-input" type="number" step="0.1" [(ngModel)]="formData.weight_kg"></div>
    <div class="form-row"><label class="form-label">Dueño</label><select class="form-select" [(ngModel)]="formData.client_id"><option value="">Seleccionar dueño</option><option *ngFor="let c of clients" [value]="c.id">{{ c.full_name }}</option></select></div>
  </div>
  <div class="form-row"><label class="form-label">Notas</label><textarea class="form-textarea" [(ngModel)]="formData.notes"></textarea></div>
  <button class="btn-primary" (click)="savePet()" [style.opacity]="saving ? 0.6 : 1">{{ saving ? 'Guardando...' : 'Guardar' }}</button>
</div>
  `,
  styleUrls: ['../erp-shared.scss']
})
export class MascotasComponent implements OnInit {
  pets: any[] = [];
  filteredPets: any[] = [];
  clients: any[] = [];
  speciesFilter = 'all';
  showForm = false;
  editId: string | null = null;
  saving = false;
  formData: any = { name: '', species: 'perro', breed: '', birth_date: '', sex: 'desconocido', weight_kg: null, notes: '', client_id: '' };
  private companyId: string | null = null;

  private speciesEmoji: Record<string, string> = { perro: '🐶', gato: '🐱', ave: '🦜', roedor: '🐹', reptil: '🦎', otro: '🐾' };

  constructor(private supabase: SupabaseService) {}

  async ngOnInit() {
    await this.loadCompanyId();
    await Promise.all([this.loadClients(), this.loadPets()]);
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

  async loadPets() {
    if (!this.companyId) return;
    const { data: petsData } = await this.supabase.client
      .from('erp_pets')
      .select('*, client:erp_clients!client_id(full_name)')
      .eq('company_id', this.companyId)
      .order('name', { ascending: true });
    const { data: recordsData } = await this.supabase.client
      .from('erp_medical_records')
      .select('pet_id, record_type, record_date, next_due_date')
      .eq('company_id', this.companyId)
      .in('record_type', ['vacuna']);
    const { data: bookingsData } = await this.supabase.client
      .from('erp_service_bookings')
      .select('pet_id, scheduled_date, status')
      .eq('company_id', this.companyId)
      .order('scheduled_date', { ascending: false });

    const vacByPet = new Map<string, any[]>();
    (recordsData || []).forEach((r: any) => {
      if (!vacByPet.has(r.pet_id)) vacByPet.set(r.pet_id, []);
      vacByPet.get(r.pet_id)!.push(r);
    });
    const lastBookingByPet = new Map<string, any>();
    (bookingsData || []).forEach((b: any) => {
      if (!lastBookingByPet.has(b.pet_id)) lastBookingByPet.set(b.pet_id, b);
    });

    this.pets = (petsData || []).map((p: any) => {
      const vacs = vacByPet.get(p.id) || [];
      const hasUpcoming = vacs.some((v: any) => v.next_due_date && new Date(v.next_due_date) > new Date());
      const hasOverdue = vacs.some((v: any) => v.next_due_date && new Date(v.next_due_date) < new Date());
      const lastBooking = lastBookingByPet.get(p.id);
      const age = this.formatAge(p.birth_date, p.approximate_age);
      const statusLabel = lastBooking?.status === 'in_progress' ? 'En servicio' : (lastBooking?.status === 'completed' ? 'Completado' : (p.is_active ? 'Activo' : 'Inactivo'));

      return {
        ...p,
        emoji: this.speciesEmoji[p.species] || '🐾',
        ownerName: p.client?.full_name || '—',
        age,
        vaccineStatus: hasOverdue ? 'Vencida' : (hasUpcoming ? 'Al día' : (vacs.length > 0 ? 'Al día' : 'N/A')),
        vaccineChip: hasOverdue ? 'chip-red' : (hasUpcoming || vacs.length > 0 ? 'chip-green' : 'chip-gray'),
        lastService: lastBooking ? (new Date(lastBooking.scheduled_date).toLocaleDateString('es-CL', { month: 'short', day: 'numeric' })) : '—',
        statusLabel,
        statusBadge: lastBooking?.status === 'in_progress' ? 'b-pendiente' : (lastBooking?.status === 'scheduled' ? 'b-paseo' : (p.is_active ? 'b-activo' : 'b-inactivo')),
      };
    });
    this.filterPets();
  }

  private formatAge(birthDate: string | null, approxAge: number | null): string {
    if (birthDate) {
      const bd = new Date(birthDate + 'T12:00:00');
      if (!isNaN(bd.getTime())) {
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
    }
    return approxAge ? (approxAge === 1 ? '1 año' : `${approxAge} años`) : '—';
  }

  filterPets() {
    if (this.speciesFilter === 'all') {
      this.filteredPets = this.pets;
    } else if (this.speciesFilter === 'other') {
      this.filteredPets = this.pets.filter(p => !['perro', 'gato'].includes(p.species));
    } else {
      this.filteredPets = this.pets.filter(p => p.species === this.speciesFilter);
    }
  }

  editPet(p: any) {
    this.showForm = true;
    this.editId = p.id;
    this.formData = { name: p.name, species: p.species, breed: p.breed || '', birth_date: p.birth_date || '', sex: p.sex || 'desconocido', weight_kg: p.weight_kg, notes: p.notes || '', client_id: p.client_id };
  }

  async savePet() {
    if (!this.companyId || !this.formData.name) return;
    this.saving = true;
    try {
      const { data: sessionData } = await this.supabase.client.auth.getSession();
      const userId = sessionData?.session?.user?.id;
      if (this.editId) {
        await this.supabase.client.from('erp_pets').update(this.formData).eq('id', this.editId);
      } else {
        await this.supabase.client.from('erp_pets').insert({
          company_id: this.companyId, ...this.formData, created_by: userId,
        });
      }
      this.showForm = false;
      await this.loadPets();
    } finally {
      this.saving = false;
    }
  }
}
