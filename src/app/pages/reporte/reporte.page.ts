import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { SupabaseService } from '../../core/services/supabase.service';

type FotoRecord = {
  id: string;
  url: string;
  descripcion: string | null;
  tomada_at: string;
};

type ChecklistDone = {
  nombre: string;
  completado: boolean;
};

@Component({
  selector: 'app-reporte',
  templateUrl: './reporte.page.html',
  styleUrls: ['./reporte.page.scss'],
})
export class ReportePage implements OnInit {
  reservaId: string | null = null;

  reserva: any = null;
  serviceRecord: any = null;
  serviceTable = '';
  fotos: FotoRecord[] = [];
  checklist: ChecklistDone[] = [];
  resumen = '';
  loading = true;
  saving = false;
  compartido = false;
  errorMsg = '';

  tutorName = '';
  tutorEmail = '';
  tutorPhone = '';

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private auth: AuthService,
    private supabase: SupabaseService
  ) {}

  get serviceTypeLabel(): string {
    const map: Record<string, string> = { paseo: 'Paseo', visita: 'Visita', alojamiento: 'Alojamiento' };
    return map[this.reserva?.servicios?.tipo ?? ''] ?? '';
  }

  get serviceTypeIcon(): string {
    const map: Record<string, string> = { paseo: 'directions_walk', visita: 'home', alojamiento: 'hotel' };
    return map[this.reserva?.servicios?.tipo ?? ''] ?? 'event';
  }

  get duracion(): number | null {
    return this.serviceRecord?.duracion_minutos ?? null;
  }

  get tieneChecklist(): boolean {
    return this.checklist.length > 0;
  }

  get completados(): number {
    return this.checklist.filter((c) => c.completado).length;
  }

  async ngOnInit() {
    this.reservaId = this.route.snapshot.paramMap.get('reservaId');
    if (!this.reservaId) {
      await this.router.navigateByUrl('/tasks');
      return;
    }
    await this.loadData();
  }

  private async loadData() {
    this.loading = true;
    try {
      const { data: reserva, error: reservaErr } = await this.supabase.client
        .from('reservas')
        .select(`
          *,
          pets (name, species),
          servicios (titulo, tipo, duracion_minutos, precio),
          tutor:profiles!reservas_tutor_id_fkey (id, full_name, email)
        `)
        .eq('id', this.reservaId)
        .single();

      if (reservaErr) throw reservaErr;
      this.reserva = reserva;
      this.tutorName = reserva.tutor?.full_name ?? '';
      this.tutorEmail = reserva.tutor?.email ?? '';

      const tutorId = reserva.tutor?.id;
      if (tutorId) {
        const { data: tp } = await this.supabase.client
          .from('tutor_profiles')
          .select('phone')
          .eq('id', tutorId)
          .maybeSingle();
        this.tutorPhone = tp?.phone ?? '';
      }

      const tipo: string = reserva.servicios?.tipo ?? 'paseo';
      this.serviceTable = tipo === 'paseo' ? 'paseos' : tipo === 'visita' ? 'visitas' : 'alojamientos';

      const { data: sRecord } = await this.supabase.client
        .from(this.serviceTable)
        .select('*')
        .eq('reserva_id', this.reservaId)
        .maybeSingle();

      this.serviceRecord = sRecord ?? null;

      const { data: fotosData } = await this.supabase.client
        .from('fotos')
        .select('*')
        .eq('reserva_id', this.reservaId)
        .order('tomada_at', { ascending: false });

      this.fotos = fotosData ?? [];

      const { data: ejecucion } = await this.supabase.client
        .from('checklist_ejecucion')
        .select('*, checklist_items!inner(nombre)')
        .eq('reserva_id', this.reservaId);

      this.checklist = (ejecucion ?? []).map((e: any) => ({
        nombre: e.checklist_items?.nombre ?? 'Ítem',
        completado: e.completado,
      }));

      const { data: reporteExistente } = await this.supabase.client
        .from('reportes')
        .select('*')
        .eq('reserva_id', this.reservaId)
        .maybeSingle();

      if (reporteExistente) {
        this.resumen = reporteExistente.resumen ?? '';
        this.compartido = reporteExistente.compartido_at != null;
      }
    } catch (error: any) {
      this.errorMsg = error?.message ?? 'Error al cargar datos';
      console.error('Error cargando reporte:', error);
    } finally {
      this.loading = false;
    }
  }

  async compartirReporte() {
    this.saving = true;
    try {
      const existing = await this.supabase.client
        .from('reportes')
        .select('id')
        .eq('reserva_id', this.reservaId)
        .maybeSingle();

      const payload = {
        reserva_id: this.reservaId,
        resumen: this.resumen,
        duracion_minutos: this.duracion,
        compartido_at: new Date().toISOString(),
      };

      if (existing.data) {
        await this.supabase.client
          .from('reportes')
          .update(payload)
          .eq('id', existing.data.id);
      } else {
        await this.supabase.client
          .from('reportes')
          .insert(payload);
      }

      this.compartido = true;
    } catch (error: any) {
      alert('Error al compartir: ' + (error?.message ?? 'Desconocido'));
    } finally {
      this.saving = false;
    }
  }

  private buildMensajeWhatsApp(): string {
    const petName = this.reserva?.pets?.name ?? 'tu mascota';
    const tipo = this.serviceTypeLabel;
    const lineas = [
      `🐾 *Reporte de ${tipo} - Company Pet*`,
      ``,
      `Hola ${this.tutorName}, te comparto el resumen del servicio con ${petName}:`,
      ``,
    ];
    if (this.duracion) lineas.push(`⏱ *Duración:* ${this.duracion} minutos`);
    if (this.checklist.length > 0) {
      const hechos = this.checklist.filter((c) => c.completado).map((c) => `✅ ${c.nombre}`).join('\n');
      lineas.push(`📋 *Actividades:*\n${hechos}`);
    }
    if (this.fotos.length > 0) lineas.push(`📸 *Fotos:* ${this.fotos.length} tomadas durante el servicio`);
    if (this.resumen.trim()) lineas.push(`\n📝 *Nota del cuidador:*\n${this.resumen.trim()}`);
    lineas.push(`\n---\nCompany Pet - Cuidando a quienes cuidan`);
    return lineas.join('\n');
  }

  compartirWhatsApp() {
    if (!this.tutorPhone) {
      alert('El tutor no tiene número de teléfono registrado.');
      return;
    }
    const num = this.tutorPhone.replace(/\D/g, '');
    const texto = encodeURIComponent(this.buildMensajeWhatsApp());
    window.open(`https://wa.me/${num}?text=${texto}`, '_blank');
  }

  compartirEmail() {
    if (!this.tutorEmail) {
      alert('El tutor no tiene email registrado.');
      return;
    }
    const petName = this.reserva?.pets?.name ?? 'mascota';
    const subject = encodeURIComponent(`Reporte de ${this.serviceTypeLabel} - ${petName}`);
    const body = encodeURIComponent(this.buildMensajeWhatsApp().replace(/\*/g, ''));
    window.open(`mailto:${this.tutorEmail}?subject=${subject}&body=${body}`, '_blank');
  }

  async compartirLink() {
    if (!this.compartido) {
      await this.compartirReporte();
    }
    const url = `${window.location.origin}/#/reporte/${this.reservaId}`;
    try {
      await navigator.clipboard.writeText(url);
      alert('Enlace del reporte copiado al portapapeles');
    } catch {
      prompt('Copia este enlace:', url);
    }
  }

  volver() {
    this.router.navigateByUrl('/tasks');
  }

  trackFoto(_index: number, item: FotoRecord): string {
    return item.id;
  }

  trackChecklist(_index: number, item: ChecklistDone): string {
    return item.nombre;
  }
}
