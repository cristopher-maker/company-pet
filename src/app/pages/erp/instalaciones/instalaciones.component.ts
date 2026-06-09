import { Component, OnInit } from '@angular/core';
import { SupabaseService } from '../../../core/services/supabase.service';

@Component({
  selector: 'app-erp-instalaciones',
  template: `
<div class="sec-hdr">
  <div><div class="sec-title">Instalaciones</div><div class="sec-sub">Gestión de espacios y habitaciones</div></div>
  <div class="sec-actions"><button class="btn-primary" (click)="showForm = true; editFacId = null; facForm = { name: '', description: '', type: 'pension', is_active: true }"><i class="ti ti-plus" style="font-size:13px"></i> Nueva instalación</button></div>
</div>
<div class="grid-3">
  <div class="card" *ngFor="let f of facilities">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">
      <div style="display:flex;align-items:center;gap:8px">
        <div class="ficon" [ngClass]="f.color"><i class="ti" [ngClass]="f.icon"></i></div>
        <div><div style="font-size:14px;font-weight:600">{{ f.name }}</div><span class="badge" [ngClass]="f.is_active ? 'b-activo' : 'b-inactivo'">{{ f.is_active ? 'Activo' : 'Inactivo' }}</span></div>
      </div>
      <button class="icon-btn" (click)="editFacility(f)"><i class="ti ti-edit" style="font-size:14px"></i></button>
    </div>
    <div style="font-size:12px;color:var(--text2);margin-bottom:10px">{{ f.description || '—' }}</div>
    <div style="font-size:13px;font-weight:600;color:var(--text1);margin-bottom:8px">Habitaciones · {{ (f.rooms || []).length }}</div>
    <div class="rooms-list" *ngFor="let r of f.rooms || []">
      <div class="room-item" [class.occupied]="r.status === 'occupied'">
        <div style="display:flex;align-items:center;gap:5px">
          <div class="room-dot" [ngClass]="r.statusDot"></div>
          <span style="font-size:13px;font-weight:500">{{ r.name }}</span>
        </div>
        <div style="display:flex;align-items:center;gap:6px">
          <span style="font-size:11px;color:var(--text3);text-transform:capitalize">{{ r.status === 'available' ? 'Disponible' : r.status === 'occupied' ? 'Ocupada' : 'Mantención' }}</span>
          <button class="icon-btn-sm" (click)="createRoom(f.id, r.id)"><i class="ti ti-edit" style="font-size:11px"></i></button>
        </div>
      </div>
    </div>
    <button class="card-action" style="margin-top:10px;width:100%;text-align:center" (click)="addRoom(f.id)">+ Agregar habitación</button>
  </div>
</div>

<div class="card" *ngIf="showForm" style="max-width:500px;margin-top:16px">
  <div class="card-hdr"><div class="card-title">{{ editFacId ? 'Editar' : 'Nueva' }} instalación</div><button class="btn-secondary" (click)="showForm = false">Cancelar</button></div>
  <div class="form-row"><label class="form-label">Nombre</label><input class="form-input" [(ngModel)]="facForm.name"></div>
  <div class="form-row"><label class="form-label">Descripción</label><textarea class="form-textarea" [(ngModel)]="facForm.description"></textarea></div>
  <div class="form-row"><label class="form-label">Tipo</label><select class="form-select" [(ngModel)]="facForm.type"><option value="pension">Pensión</option><option value="guarderia">Guardería</option><option value="grooming">Grooming</option><option value="entrenamiento">Entrenamiento</option></select></div>
  <button class="btn-primary" (click)="saveFacility()" [style.opacity]="saving ? 0.6 : 1">{{ saving ? 'Guardando...' : 'Guardar' }}</button>
</div>

<div class="card" *ngIf="showRoomForm" style="max-width:400px;margin-top:16px">
  <div class="card-hdr"><div class="card-title">{{ editRoomId ? 'Editar' : 'Nueva' }} habitación</div><button class="btn-secondary" (click)="showRoomForm = false">Cancelar</button></div>
  <div class="form-row"><label class="form-label">Nombre</label><input class="form-input" [(ngModel)]="roomForm.name"></div>
  <div class="form-row"><label class="form-label">Estado</label><select class="form-select" [(ngModel)]="roomForm.status"><option value="available">Disponible</option><option value="occupied">Ocupada</option><option value="maintenance">Mantención</option></select></div>
  <button class="btn-primary" (click)="saveRoom()" [style.opacity]="saving ? 0.6 : 1">{{ saving ? 'Guardando...' : 'Guardar' }}</button>
</div>
  `,
  styleUrls: ['../erp-shared.scss'],
  styles: [`
    .ficon{width:38px;height:38px;border-radius:9px;display:flex;align-items:center;justify-content:center;font-size:18px;flex-shrink:0}
    .ficon.green{background:var(--green-light);color:var(--green)}
    .ficon.blue{background:var(--blue-light);color:var(--blue)}
    .ficon.purple{background:var(--purple-light);color:var(--purple)}
    .ficon.amber{background:var(--amber-light);color:var(--amber)}
    .icon-btn-sm{width:24px;height:24px;border:1px solid var(--border);border-radius:5px;display:flex;align-items:center;justify-content:center;cursor:pointer;color:var(--text3);background:transparent}
    .icon-btn-sm:hover{background:var(--bg3)}
    .rooms-list{margin-bottom:4px}
    .room-item{display:flex;align-items:center;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--border)}
    .room-item.occupied{background:rgba(239,68,68,0.04);margin:0 -8px;padding:6px 8px;border-radius:5px}
    .room-dot{width:8px;height:8px;border-radius:50%;flex-shrink:0}
    .room-dot.green{background:var(--green)}
    .room-dot.red{background:var(--red)}
    .room-dot.amber{background:var(--amber)}
  `]
})
export class InstalacionesComponent implements OnInit {
  facilities: any[] = [];
  showForm = false;
  editFacId: string | null = null;
  facForm: any = { name: '', description: '', type: 'pension', is_active: true };
  showRoomForm = false;
  editRoomId: string | null = null;
  currentFacilityId: string | null = null;
  roomForm: any = { name: '', status: 'available' };
  saving = false;
  private companyId: string | null = null;

  private facilityColors: Record<string, string> = { pension: 'green', guarderia: 'blue', grooming: 'purple', entrenamiento: 'amber' };
  private facilityIcons: Record<string, string> = { pension: 'ti-building', guarderia: 'ti-users', grooming: 'ti-scissors', entrenamiento: 'ti-trending-up' };

  constructor(private supabase: SupabaseService) {}

  async ngOnInit() {
    await this.loadCompanyId();
    await this.loadFacilities();
  }

  private async loadCompanyId() {
    const { data: sessionData } = await this.supabase.client.auth.getSession();
    const userId = sessionData?.session?.user?.id;
    if (!userId) return;
    const { data: memberData } = await this.supabase.client
      .from('company_members').select('company_id').eq('user_id', userId).maybeSingle();
    this.companyId = memberData?.company_id ?? null;
  }

  async loadFacilities() {
    if (!this.companyId) return;
    const { data } = await this.supabase.client
      .from('erp_facilities')
      .select('*, rooms:erp_rooms(*)')
      .eq('company_id', this.companyId)
      .order('name');
    this.facilities = (data || []).map((f: any) => ({
      ...f,
      color: this.facilityColors[f.type] || 'green',
      icon: this.facilityIcons[f.type] || 'ti-building',
      rooms: (f.rooms || []).map((r: any) => ({ ...r, statusDot: r.status === 'available' ? 'green' : r.status === 'occupied' ? 'red' : 'amber' })),
    }));
  }

  editFacility(f: any) {
    this.showForm = true;
    this.editFacId = f.id;
    this.facForm = { name: f.name, description: f.description || '', type: f.type, is_active: f.is_active };
  }

  async saveFacility() {
    if (!this.companyId || !this.facForm.name) return;
    this.saving = true;
    try {
      const { data: sessionData } = await this.supabase.client.auth.getSession();
      const userId = sessionData?.session?.user?.id;
      if (this.editFacId) {
        await this.supabase.client.from('erp_facilities').update(this.facForm).eq('id', this.editFacId);
      } else {
        await this.supabase.client.from('erp_facilities').insert({
          company_id: this.companyId, ...this.facForm, created_by: userId,
        });
      }
      this.showForm = false;
      await this.loadFacilities();
    } finally {
      this.saving = false;
    }
  }

  addRoom(facilityId: string) {
    this.showRoomForm = true;
    this.editRoomId = null;
    this.currentFacilityId = facilityId;
    this.roomForm = { name: '', status: 'available' };
  }

  createRoom(facilityId: string, roomId: string) {
    const facility = this.facilities.find(f => f.id === facilityId);
    const room = facility?.rooms?.find((r: any) => r.id === roomId);
    if (!room) return;
    this.showRoomForm = true;
    this.editRoomId = roomId;
    this.currentFacilityId = facilityId;
    this.roomForm = { name: room.name, status: room.status };
  }

  async saveRoom() {
    if (!this.companyId || !this.currentFacilityId || !this.roomForm.name) return;
    this.saving = true;
    try {
      if (this.editRoomId) {
        await this.supabase.client.from('erp_rooms').update(this.roomForm).eq('id', this.editRoomId);
      } else {
        await this.supabase.client.from('erp_rooms').insert({
          facility_id: this.currentFacilityId, ...this.roomForm,
        });
      }
      this.showRoomForm = false;
      await this.loadFacilities();
    } finally {
      this.saving = false;
    }
  }
}
