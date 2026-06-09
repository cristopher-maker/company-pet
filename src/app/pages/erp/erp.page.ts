import { Component, OnInit } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-erp',
  template: `
    <div class="erp">
      <aside class="sidebar">
        <div class="logo">
          <div class="logo-icon"><i class="ti ti-paw"></i></div>
          <div>
            <div class="logo-text">PetCare ERP</div>
            <div class="logo-sub">v1.0 · Profesional</div>
          </div>
        </div>
        <nav class="nav">
          <div class="nav-sec">Principal</div>
          <a class="nav-item" [class.active]="activePage === 'dashboard'" (click)="go('dashboard')">
            <i class="ti ti-layout-dashboard"></i> Dashboard
          </a>
          <a class="nav-item" [class.active]="activePage === 'agenda'" (click)="go('agenda')">
            <i class="ti ti-calendar"></i> Agenda <span class="nav-badge nb-green">4</span>
          </a>
          <a class="nav-item" [class.active]="activePage === 'servicios'" (click)="go('servicios')">
            <i class="ti ti-clipboard-list"></i> Servicios
          </a>
          <div class="nav-sec">Clientes</div>
          <a class="nav-item" [class.active]="activePage === 'duenos'" (click)="go('duenos')">
            <i class="ti ti-users"></i> Dueños
          </a>
          <a class="nav-item" [class.active]="activePage === 'mascotas'" (click)="go('mascotas')">
            <i class="ti ti-paw"></i> Mascotas
          </a>
          <a class="nav-item" [class.active]="activePage === 'historial'" (click)="go('historial')">
            <i class="ti ti-stethoscope"></i> Historial médico
          </a>
          <div class="nav-sec">Operaciones</div>
          <a class="nav-item" [class.active]="activePage === 'empleados'" (click)="go('empleados')">
            <i class="ti ti-user-check"></i> Empleados
          </a>
          <a class="nav-item" [class.active]="activePage === 'instalaciones'" (click)="go('instalaciones')">
            <i class="ti ti-building"></i> Instalaciones
          </a>
          <a class="nav-item" [class.active]="activePage === 'rutas'" (click)="go('rutas')">
            <i class="ti ti-route"></i> Rutas de paseo
          </a>
          <div class="nav-sec">Administración</div>
          <a class="nav-item" [class.active]="activePage === 'facturacion'" (click)="go('facturacion')">
            <i class="ti ti-receipt"></i> Facturación <span class="nav-badge nb-red">2</span>
          </a>
          <a class="nav-item" [class.active]="activePage === 'reportes'" (click)="go('reportes')">
            <i class="ti ti-chart-bar"></i> Reportes
          </a>
          <a class="nav-item" [class.active]="activePage === 'configuracion'" (click)="go('configuracion')">
            <i class="ti ti-settings"></i> Configuración
          </a>
          <a *ngIf="isStaff" class="nav-item" [class.active]="activePage === 'recursos'" (click)="go('recursos')">
            <i class="ti ti-book"></i> Recursos
          </a>
        </nav>
        <div class="user-bar">
          <div class="uavatar">CA</div>
          <div style="flex:1;min-width:0">
            <div class="uname">Carlos Arriagada</div>
            <div class="urole">Administrador</div>
          </div>
          <i class="ti ti-chevron-down" style="font-size:13px;color:var(--text3)"></i>
        </div>
      </aside>
      <div class="main">
        <div class="topbar">
          <i class="ti ti-layout-dashboard" id="tb-icon" style="font-size:18px;color:var(--text2)"></i>
          <span class="tb-title" id="tb-title">{{ pageTitle }}</span>
          <span class="tb-subtitle" id="tb-sub">{{ today | date:'fullDate' }}</span>
          <div class="tb-spacer"></div>
          <div class="search-box">
            <i class="ti ti-search"></i>
            <input placeholder="Buscar mascota, dueño…" #searchInput (keyup)="onSearch(searchInput.value)">
          </div>
          <button class="icon-btn" title="Notificaciones">
            <i class="ti ti-bell" style="font-size:16px"></i>
            <div class="notif-dot"></div>
          </button>
          <button class="btn-primary" (click)="onNewService()"><i class="ti ti-plus" style="font-size:14px"></i> Nuevo servicio</button>
        </div>
        <div class="content">
          <router-outlet></router-outlet>
        </div>
      </div>
    </div>
  `,
  styles: [`
    *{box-sizing:border-box;margin:0;padding:0}
    :root{
      --green:#1D9E75;--green-light:#E1F5EE;--green-dark:#0F6E56;
      --purple:#534AB7;--purple-light:#EEEDFE;
      --blue:#185FA5;--blue-light:#E6F1FB;
      --amber:#BA7517;--amber-light:#FAEEDA;
      --pink:#993556;--pink-light:#FBEAF0;
      --coral:#993C1D;--coral-light:#FAECE7;
      --red:#E24B4A;--red-light:#FCEBEB;
      --warning:#EF9F27;--warning-light:#FAEEDA;
      --bg:#F4F3EF;--bg2:#fff;--bg3:#F8F7F4;
      --border:#E5E4DF;--border2:#D3D1C7;
      --text1:#1a1a18;--text2:#6B6A65;--text3:#9B9A96;
      --radius:8px;--radius-lg:12px;
      --shadow:0 1px 3px rgba(0,0,0,.07),0 1px 2px rgba(0,0,0,.05);
    }
    :host{display:contents}
  `],
  styleUrls: ['./erp-shared.scss']
})
export class ErpPage implements OnInit {
  today = new Date();
  activePage = 'dashboard';
  isStaff = false;

  private titles: Record<string, string> = {
    dashboard: 'Dashboard',
    agenda: 'Agenda',
    servicios: 'Servicios',
    duenos: 'Dueños',
    mascotas: 'Mascotas',
    historial: 'Historial médico',
    empleados: 'Empleados',
    instalaciones: 'Instalaciones',
    rutas: 'Rutas de paseo',
    facturacion: 'Facturación',
    reportes: 'Reportes',
    configuracion: 'Configuración',
    recursos: 'Biblioteca de Recursos',
  };

  get pageTitle(): string {
    return this.titles[this.activePage] || 'ERP';
  }

  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private auth: AuthService
  ) {}

  async ngOnInit() {
    this.route.firstChild?.url.subscribe(url => {
      if (url.length > 0) {
        this.activePage = url[0].path;
      }
    });

    try {
      const role = await this.auth.getCurrentProfileRole();
      this.isStaff = role === 'admin' || role === 'pet_expert';
    } catch {
      this.isStaff = false;
    }
  }

  go(page: string): void {
    this.activePage = page;
    this.router.navigate([page], { relativeTo: this.route });
  }

  onSearch(value: string): void {}

  onNewService(): void {
    this.go('agenda');
  }
}
