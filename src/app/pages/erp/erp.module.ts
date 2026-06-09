import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ErpPage } from './erp.page';
import { ErpRoutingModule } from './erp-routing.module';
import { DashboardComponent } from './dashboard/dashboard.component';
import { AgendaComponent } from './agenda/agenda.component';
import { ServiciosComponent } from './servicios/servicios.component';
import { DuenosComponent } from './duenos/duenos.component';
import { MascotasComponent } from './mascotas/mascotas.component';
import { HistorialComponent } from './historial/historial.component';
import { EmpleadosComponent } from './empleados/empleados.component';
import { InstalacionesComponent } from './instalaciones/instalaciones.component';
import { RutasComponent } from './rutas/rutas.component';
import { FacturacionComponent } from './facturacion/facturacion.component';
import { ReportesComponent } from './reportes/reportes.component';
import { ConfiguracionComponent } from './configuracion/configuracion.component';
import { RecursosComponent } from './recursos/recursos.component';

@NgModule({
  imports: [CommonModule, FormsModule, ErpRoutingModule],
  declarations: [
    ErpPage,
    DashboardComponent,
    AgendaComponent,
    ServiciosComponent,
    DuenosComponent,
    MascotasComponent,
    HistorialComponent,
    EmpleadosComponent,
    InstalacionesComponent,
    RutasComponent,
    FacturacionComponent,
    ReportesComponent,
    ConfiguracionComponent,
    RecursosComponent,
  ],
})
export class ErpModule {}
