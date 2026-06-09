import { Component, OnInit } from '@angular/core';
import { SupabaseService } from '../../../core/services/supabase.service';

@Component({
  selector: 'app-erp-servicios',
  template: `
<div class="sec-hdr">
  <div><div class="sec-title">Catálogo de servicios</div><div class="sec-sub">Tarifas y configuración</div></div>
  <div class="sec-actions"><button class="btn-primary" (click)="showForm = true; editId = null; formData = { name: '', description: '', category: 'paseo', base_price: 0, unit_label: 'sesión', is_active: true }"><i class="ti ti-plus" style="font-size:13px"></i> Nuevo servicio</button></div>
</div>
<div *ngIf="errorMessage" class="alert-row ar-red">
  <i class="ti ti-alert-circle ar-icon"></i>
  <div class="ar-text">{{ errorMessage }}</div>
</div>
<div class="grid-3">
  <div class="card" *ngFor="let s of services">
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px">
      <div class="svc-icon" [ngClass]="s.categoryColor"><i class="ti" [ngClass]="s.categoryIcon"></i></div>
      <div>
        <div style="font-size:14px;font-weight:600">{{ s.name }}</div>
        <span class="badge" [ngClass]="s.is_active ? 'b-activo' : 'b-inactivo'">{{ s.is_active ? 'Activo' : 'Inactivo' }}</span>
      </div>
    </div>
    <div style="font-size:13px;color:var(--text2);margin-bottom:10px">{{ s.description || 'Sin descripción' }}</div>
    <div style="font-size:12px;color:var(--text3);margin-bottom:6px">Tarifa base</div>
    <div style="font-size:22px;font-weight:700">{{ s.base_price | currency:'CLP':'symbol-narrow':'1.0-0' }}<span style="font-size:13px;font-weight:400;color:var(--text3)">/{{ s.unit_label }}</span></div>
    <div style="margin-top:10px;padding-top:10px;border-top:1px solid var(--border);display:flex;gap:8px;font-size:12px">
      <button class="card-action" style="font-size:11px" (click)="editService(s)">Editar</button>
      <button class="card-action" style="font-size:11px;border-color:var(--red);color:var(--red)" (click)="toggleActive(s)">{{ s.is_active ? 'Pausar' : 'Activar' }}</button>
    </div>
  </div>
  <div *ngIf="services.length === 0" class="card" style="text-align:center;color:var(--text3);padding:40px;grid-column:1/-1">No hay servicios configurados</div>
</div>

<div class="card" *ngIf="showForm" style="max-width:600px;margin-top:16px">
  <div class="card-hdr"><div class="card-title">{{ editId ? 'Editar' : 'Nuevo' }} servicio</div><button class="btn-secondary" (click)="showForm = false">Cancelar</button></div>
  <div class="form-row"><label class="form-label">Nombre</label><input class="form-input" [(ngModel)]="formData.name"></div>
  <div class="form-row"><label class="form-label">Descripción</label><textarea class="form-textarea" [(ngModel)]="formData.description"></textarea></div>
  <div class="form-grid">
    <div class="form-row"><label class="form-label">Categoría</label><select class="form-select" [(ngModel)]="formData.category"><option value="paseo">Paseo</option><option value="pension">Pensión</option><option value="grooming">Grooming</option><option value="consulta">Consulta</option><option value="adiestramiento">Adiestramiento</option><option value="petsitting">Petsitting</option></select></div>
    <div class="form-row"><label class="form-label">Precio base</label><input class="form-input" type="number" [(ngModel)]="formData.base_price"></div>
  </div>
  <div class="form-row"><label class="form-label">Unidad (ej: sesión, noche, hora)</label><input class="form-input" [(ngModel)]="formData.unit_label"></div>
  <button class="btn-primary" (click)="saveService()" [style.opacity]="saving ? 0.6 : 1">{{ saving ? 'Guardando...' : 'Guardar' }}</button>
</div>
  `,
  styleUrls: ['../erp-shared.scss'],
  styles: [`
    .svc-icon{width:38px;height:38px;border-radius:9px;display:flex;align-items:center;justify-content:center;font-size:20px;flex-shrink:0}
    .svc-icon.green{background:var(--green-light);color:var(--green)}
    .svc-icon.purple{background:var(--purple-light);color:var(--purple)}
    .svc-icon.blue{background:var(--blue-light);color:var(--blue)}
    .svc-icon.amber{background:var(--amber-light);color:var(--amber)}
    .svc-icon.pink{background:var(--pink-light);color:var(--pink)}
    .svc-icon.coral{background:var(--coral-light);color:var(--coral)}
    .svc-icon.gray{background:#F1EFE8;color:var(--text2)}
  `]
})
export class ServiciosComponent implements OnInit {
  services: any[] = [];
  showForm = false;
  editId: string | null = null;
  saving = false;
  errorMessage = '';
  formData: any = { name: '', description: '', category: 'paseo', base_price: 0, unit_label: 'sesión', is_active: true };
  private companyId: string | null = null;

  private categoryColors: Record<string, string> = { paseo: 'green', pension: 'purple', grooming: 'blue', consulta: 'amber', adiestramiento: 'pink', petsitting: 'coral' };
  private categoryIcons: Record<string, string> = { paseo: 'ti-route', pension: 'ti-home', grooming: 'ti-scissors', consulta: 'ti-stethoscope', adiestramiento: 'ti-brain', petsitting: 'ti-home-heart' };

  get categoryColor() { return (s: any) => this.categoryColors[s.category] || 'gray'; }
  get categoryIcon() { return (s: any) => this.categoryIcons[s.category] || 'ti-paw'; }

  constructor(private supabase: SupabaseService) {}

  async ngOnInit() {
    await this.loadCompanyId();
    await this.loadServices();
  }

  private async loadCompanyId() {
    const { data: sessionData } = await this.supabase.client.auth.getSession();
    const userId = sessionData?.session?.user?.id;
    if (!userId) return;
    const { data: memberData } = await this.supabase.client
      .from('company_members').select('company_id').eq('user_id', userId).maybeSingle();
    this.companyId = memberData?.company_id ?? null;
  }

  async loadServices() {
    if (!this.companyId) return;
    const { data, error } = await this.supabase.client
      .from('erp_services')
      .select('*')
      .eq('company_id', this.companyId)
      .order('sort_order', { ascending: true });
    if (error) {
      this.errorMessage = `No se pudieron cargar los servicios: ${error.message}`;
      return;
    }
    this.services = (data || []).map((s: any) => ({
      ...s,
      categoryColor: this.categoryColors[s.category] || 'gray',
      categoryIcon: this.categoryIcons[s.category] || 'ti-paw',
    }));
  }

  editService(s: any) {
    this.showForm = true;
    this.editId = s.id;
    this.formData = { name: s.name, description: s.description || '', category: s.category, base_price: s.base_price, unit_label: s.unit_label, is_active: s.is_active };
  }

  async saveService() {
    this.errorMessage = '';
    if (!this.companyId) {
      this.errorMessage = 'No se encontro una empresa asociada a tu usuario.';
      return;
    }
    if (!this.formData.name) {
      this.errorMessage = 'Ingresa un nombre para el servicio.';
      return;
    }
    this.saving = true;
    try {
      const { data: sessionData } = await this.supabase.client.auth.getSession();
      const userId = sessionData?.session?.user?.id;
      let error;
      if (this.editId) {
        ({ error } = await this.supabase.client.from('erp_services').update(this.formData).eq('id', this.editId));
      } else {
        const sortOrder = this.services.length;
        ({ error } = await this.supabase.client.from('erp_services').insert({
          company_id: this.companyId, ...this.formData, sort_order: sortOrder, created_by: userId,
        }));
      }
      if (error) {
        this.errorMessage = `No se pudo guardar el servicio: ${error.message}`;
        return;
      }
      this.showForm = false;
      await this.loadServices();
    } finally {
      this.saving = false;
    }
  }

  async toggleActive(s: any) {
    this.errorMessage = '';
    const { error } = await this.supabase.client.from('erp_services').update({ is_active: !s.is_active }).eq('id', s.id);
    if (error) {
      this.errorMessage = `No se pudo actualizar el servicio: ${error.message}`;
      return;
    }
    s.is_active = !s.is_active;
  }
}
