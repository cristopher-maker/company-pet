import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { ErpPage } from './erp.page';
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

const routes: Routes = [
  {
    path: '',
    component: ErpPage,
    children: [
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
      { path: 'dashboard', component: DashboardComponent },
      { path: 'agenda', component: AgendaComponent },
      { path: 'servicios', component: ServiciosComponent },
      { path: 'duenos', component: DuenosComponent },
      { path: 'mascotas', component: MascotasComponent },
      { path: 'historial', component: HistorialComponent },
      { path: 'empleados', component: EmpleadosComponent },
      { path: 'instalaciones', component: InstalacionesComponent },
      { path: 'rutas', component: RutasComponent },
      { path: 'facturacion', component: FacturacionComponent },
      { path: 'reportes', component: ReportesComponent },
      { path: 'configuracion', component: ConfiguracionComponent },
      { path: 'recursos', component: RecursosComponent },
    ],
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class ErpRoutingModule {}
