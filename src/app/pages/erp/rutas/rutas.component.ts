import { Component, OnInit } from '@angular/core';
import { SupabaseService } from '../../../core/services/supabase.service';

@Component({
  selector: 'app-erp-rutas',
  template: `
<div class="sec-hdr">
  <div><div class="sec-title">Rutas de paseo</div><div class="sec-sub">Gestión de circuitos y puntos de interés</div></div>
  <div class="sec-actions"><button class="btn-primary" (click)="showForm = true; editId = null; formData = { name: '', description: '', estimated_minutes: 30, is_active: true }"><i class="ti ti-plus" style="font-size:13px"></i> Nueva ruta</button></div>
</div>
<div class="grid-3">
  <div class="card" *ngFor="let r of routes">
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px">
      <div class="r-icon" [style.background]="r.color.bg" [style.color]="r.color.text"><i class="ti ti-route"></i></div>
      <div style="flex:1">
        <div style="font-size:14px;font-weight:600">{{ r.name }}</div>
        <span class="badge" [ngClass]="r.is_active ? 'b-activo' : 'b-inactivo'">{{ r.is_active ? 'Activo' : 'Inactivo' }}</span>
      </div>
      <button class="icon-btn" (click)="editRoute(r)"><i class="ti ti-edit" style="font-size:13px"></i></button>
    </div>
    <div style="font-size:13px;color:var(--text2);margin-bottom:8px">{{ r.description || '—' }}</div>
    <div style="display:flex;gap:10px;font-size:12px;color:var(--text3)">
      <span><i class="ti ti-clock"></i> ~{{ r.estimated_minutes }} min</span>
      <span><i class="ti ti-map-pin"></i> {{ (r.points || []).length }} puntos</span>
    </div>
    <div *ngIf="(r.points || []).length > 0" style="margin-top:10px;padding-top:10px;border-top:1px solid var(--border)">
      <div style="font-size:11px;font-weight:600;color:var(--text3);margin-bottom:5px">PUNTOS DE INTERÉS</div>
      <div *ngFor="let p of r.points" class="point-item">{{ p.name || p.address || 'Punto' }}</div>
    </div>
  </div>
  <div *ngIf="routes.length === 0" class="card" style="text-align:center;color:var(--text3);padding:40px;grid-column:1/-1">No hay rutas configuradas</div>
</div>

<div class="card" *ngIf="showForm" style="max-width:600px;margin-top:16px">
  <div class="card-hdr"><div class="card-title">{{ editId ? 'Editar' : 'Nueva' }} ruta</div><button class="btn-secondary" (click)="showForm = false">Cancelar</button></div>
  <div class="form-row"><label class="form-label">Nombre</label><input class="form-input" [(ngModel)]="formData.name"></div>
  <div class="form-row"><label class="form-label">Descripción</label><textarea class="form-textarea" [(ngModel)]="formData.description"></textarea></div>
  <div class="form-grid">
    <div class="form-row"><label class="form-label">Duración estimada (min)</label><input class="form-input" type="number" [(ngModel)]="formData.estimated_minutes"></div>
    <div class="form-row"><label class="form-label">Puntos de interés (separados por coma)</label><input class="form-input" [(ngModel)]="formData.pointsStr" placeholder="Parque, Río, Plaza..."></div>
  </div>
  <button class="btn-primary" (click)="saveRoute()" [style.opacity]="saving ? 0.6 : 1">{{ saving ? 'Guardando...' : 'Guardar' }}</button>
</div>
  `,
  styleUrls: ['../erp-shared.scss'],
  styles: [`
    .r-icon{width:36px;height:36px;border-radius:9px;display:flex;align-items:center;justify-content:center;font-size:17px;flex-shrink:0}
    .point-item{font-size:12px;padding:4px 8px;margin-bottom:3px;background:var(--bg3);border-radius:5px;color:var(--text2)}
  `]
})
export class RutasComponent implements OnInit {
  routes: any[] = [];
  showForm = false;
  editId: string | null = null;
  saving = false;
  formData: any = { name: '', description: '', estimated_minutes: 30, is_active: true, pointsStr: '' };
  private companyId: string | null = null;

  constructor(private supabase: SupabaseService) {}

  async ngOnInit() {
    await this.loadCompanyId();
    await this.loadRoutes();
  }

  private async loadCompanyId() {
    const { data: sessionData } = await this.supabase.client.auth.getSession();
    const userId = sessionData?.session?.user?.id;
    if (!userId) return;
    const { data: memberData } = await this.supabase.client
      .from('company_members').select('company_id').eq('user_id', userId).maybeSingle();
    this.companyId = memberData?.company_id ?? null;
  }

  async loadRoutes() {
    if (!this.companyId) return;
    const { data } = await this.supabase.client
      .from('erp_walking_routes')
      .select('*')
      .eq('company_id', this.companyId)
      .order('name');
    this.routes = (data || []).map((r: any) => ({
      ...r,
      points: (r.points_of_interest || []).map((p: string) => ({ name: p })),
      color: { bg: '#EEEDFE', text: '#534AB7' },
    }));
  }

  editRoute(r: any) {
    this.showForm = true;
    this.editId = r.id;
    this.formData = {
      name: r.name, description: r.description || '', estimated_minutes: r.estimated_minutes,
      is_active: r.is_active, pointsStr: (r.points_of_interest || []).join(', '),
    };
  }

  async saveRoute() {
    if (!this.companyId || !this.formData.name) return;
    this.saving = true;
    try {
      const { data: sessionData } = await this.supabase.client.auth.getSession();
      const userId = sessionData?.session?.user?.id;
      const payload = {
        name: this.formData.name,
        description: this.formData.description,
        estimated_minutes: this.formData.estimated_minutes,
        is_active: this.formData.is_active,
        points_of_interest: this.formData.pointsStr ? this.formData.pointsStr.split(',').map((s: string) => s.trim()).filter(Boolean) : [],
      };
      if (this.editId) {
        await this.supabase.client.from('erp_walking_routes').update(payload).eq('id', this.editId);
      } else {
        await this.supabase.client.from('erp_walking_routes').insert({
          company_id: this.companyId, ...payload, created_by: userId,
        });
      }
      this.showForm = false;
      await this.loadRoutes();
    } finally {
      this.saving = false;
    }
  }
}
