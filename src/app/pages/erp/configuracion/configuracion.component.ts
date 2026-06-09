import { Component, OnInit } from '@angular/core';
import { SupabaseService } from '../../../core/services/supabase.service';

@Component({
  selector: 'app-erp-configuracion',
  template: `
<div class="sec-hdr">
  <div><div class="sec-title">Configuración</div><div class="sec-sub">Ajustes generales del negocio</div></div>
  <div class="sec-actions"><button class="btn-primary" (click)="saveConfig()" [style.opacity]="saving ? 0.6 : 1">{{ saving ? 'Guardando...' : 'Guardar cambios' }}</button></div>
</div>

<div class="settings-grid">
  <div class="card">
    <div class="card-title" style="margin-bottom:12px">Información del negocio</div>
    <div class="form-row"><label class="form-label">Nombre del negocio</label><input class="form-input" [(ngModel)]="config.business_name"></div>
    <div class="form-row"><label class="form-label">RUT / ID tributario</label><input class="form-input" [(ngModel)]="config.tax_id"></div>
    <div class="form-grid">
      <div class="form-row"><label class="form-label">Teléfono</label><input class="form-input" [(ngModel)]="config.phone"></div>
      <div class="form-row"><label class="form-label">Email</label><input class="form-input" type="email" [(ngModel)]="config.email"></div>
    </div>
    <div class="form-row"><label class="form-label">Dirección</label><input class="form-input" [(ngModel)]="config.address"></div>
  </div>

  <div class="card">
    <div class="card-title" style="margin-bottom:12px">Horario laboral</div>
    <div class="form-grid">
      <div class="form-row"><label class="form-label">Hora apertura</label><input class="form-input" type="time" [(ngModel)]="config.opening_time"></div>
      <div class="form-row"><label class="form-label">Hora cierre</label><input class="form-input" type="time" [(ngModel)]="config.closing_time"></div>
    </div>
    <div class="form-row" style="margin-top:8px">
      <label class="form-label" style="margin-bottom:8px">Días laborales</label>
      <div style="display:flex;gap:6px;flex-wrap:wrap">
        <button *ngFor="let d of weekDays" class="day-btn" [class.active]="config.workDays.includes(d.value)" (click)="toggleDay(d.value)">{{ d.label }}</button>
      </div>
    </div>
  </div>

  <div class="card">
    <div class="card-title" style="margin-bottom:12px">Preferencias de facturación</div>
    <div class="form-row"><label class="form-label">Moneda predeterminada</label><select class="form-select" [(ngModel)]="config.currency"><option value="CLP">CLP (Peso chileno)</option><option value="USD">USD (Dólar)</option><option value="EUR">EUR (Euro)</option></select></div>
    <div class="form-row"><label class="form-label">Impuesto (%)</label><input class="form-input" type="number" [(ngModel)]="config.tax_rate"></div>
    <div class="form-row"><label class="form-label">Forma de pago predeterminada</label><select class="form-select" [(ngModel)]="config.default_payment_method"><option value="transferencia">Transferencia</option><option value="efectivo">Efectivo</option><option value="tarjeta">Tarjeta</option><option value="otro">Otro</option></select></div>
  </div>

  <div class="card">
    <div class="card-title" style="margin-bottom:12px">Notificaciones</div>
    <div class="toggle-row"><span class="toggle-label">Recordatorio de citas</span><label class="toggle"><input type="checkbox" [(ngModel)]="config.notify_reminders"><span class="toggle-slider"></span></label></div>
    <div class="toggle-row"><span class="toggle-label">Alertas de vacunas próximas a vencer</span><label class="toggle"><input type="checkbox" [(ngModel)]="config.notify_vaccines"><span class="toggle-slider"></span></label></div>
    <div class="toggle-row"><span class="toggle-label">Notificaciones de pago</span><label class="toggle"><input type="checkbox" [(ngModel)]="config.notify_payments"><span class="toggle-slider"></span></label></div>
  </div>
</div>

<div class="success-msg" *ngIf="showSuccess">Configuración guardada correctamente</div>
  `,
  styleUrls: ['../erp-shared.scss'],
  styles: [`
    .settings-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px}
    .day-btn{padding:6px 12px;border:1px solid var(--border);border-radius:7px;font-size:12px;cursor:pointer;background:transparent;color:var(--text2);transition:all .1s;font-family:inherit}
    .day-btn.active{background:var(--green-light);color:var(--green-dark);border-color:#9FE1CB}
    .day-btn:hover{border-color:var(--border2)}
    .toggle-row{display:flex;align-items:center;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--border)}
    .toggle-label{font-size:13px;color:var(--text1)}
    .toggle{position:relative;display:inline-block;width:40px;height:22px;cursor:pointer}
    .toggle input{opacity:0;width:0;height:0}
    .toggle-slider{position:absolute;inset:0;background:var(--border);border-radius:22px;transition:all .2s}
    .toggle-slider::before{content:'';position:absolute;height:16px;width:16px;left:3px;bottom:3px;background:#fff;border-radius:50%;transition:all .2s}
    .toggle input:checked + .toggle-slider{background:var(--green)}
    .toggle input:checked + .toggle-slider::before{transform:translateX(18px)}
    .success-msg{position:fixed;bottom:24px;right:24px;background:var(--green-dark);color:#fff;padding:12px 20px;border-radius:8px;font-size:13px;font-weight:500;animation:fadeIn .2s}
    @keyframes fadeIn{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
  `]
})
export class ConfiguracionComponent implements OnInit {
  config: any = {
    business_name: '', tax_id: '', phone: '', email: '', address: '',
    opening_time: '09:00', closing_time: '18:00', workDays: ['mon', 'tue', 'wed', 'thu', 'fri'],
    currency: 'CLP', tax_rate: 19, default_payment_method: 'transferencia',
    notify_reminders: true, notify_vaccines: true, notify_payments: true,
  };
  weekDays = [
    { label: 'Lun', value: 'mon' }, { label: 'Mar', value: 'tue' }, { label: 'Mié', value: 'wed' },
    { label: 'Jue', value: 'thu' }, { label: 'Vie', value: 'fri' }, { label: 'Sáb', value: 'sat' }, { label: 'Dom', value: 'sun' },
  ];
  saving = false;
  showSuccess = false;
  private companyId: string | null = null;

  constructor(private supabase: SupabaseService) {}

  async ngOnInit() {
    await this.loadCompanyId();
    await this.loadConfig();
  }

  private async loadCompanyId() {
    const { data: sessionData } = await this.supabase.client.auth.getSession();
    const userId = sessionData?.session?.user?.id;
    if (!userId) return;
    const { data: memberData } = await this.supabase.client
      .from('company_members').select('company_id').eq('user_id', userId).maybeSingle();
    this.companyId = memberData?.company_id ?? null;
  }

  async loadConfig() {
    if (!this.companyId) return;
    const { data } = await this.supabase.client
      .from('erp_config')
      .select('*')
      .eq('company_id', this.companyId)
      .maybeSingle();
    if (data) {
      this.config = { ...this.config, ...data, workDays: data.work_days || this.config.workDays };
    }
  }

  toggleDay(day: string) {
    const idx = this.config.workDays.indexOf(day);
    if (idx >= 0) this.config.workDays.splice(idx, 1);
    else this.config.workDays.push(day);
  }

  async saveConfig() {
    if (!this.companyId) return;
    this.saving = true;
    try {
      const payload = {
        business_name: this.config.business_name,
        tax_id: this.config.tax_id,
        phone: this.config.phone,
        email: this.config.email,
        address: this.config.address,
        opening_time: this.config.opening_time,
        closing_time: this.config.closing_time,
        work_days: this.config.workDays,
        currency: this.config.currency,
        tax_rate: this.config.tax_rate,
        default_payment_method: this.config.default_payment_method,
        notify_reminders: this.config.notify_reminders,
        notify_vaccines: this.config.notify_vaccines,
        notify_payments: this.config.notify_payments,
      };

      const { data: existing } = await this.supabase.client
        .from('erp_config')
        .select('id')
        .eq('company_id', this.companyId)
        .maybeSingle();

      if (existing) {
        await this.supabase.client.from('erp_config').update(payload).eq('company_id', this.companyId);
      } else {
        await this.supabase.client.from('erp_config').insert({ company_id: this.companyId, ...payload });
      }

      this.showSuccess = true;
      setTimeout(() => this.showSuccess = false, 3000);
    } finally {
      this.saving = false;
    }
  }
}
