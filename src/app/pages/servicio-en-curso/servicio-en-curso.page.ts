import { Component, OnInit, OnDestroy } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { SupabaseService } from '../../core/services/supabase.service';

type ReservaInfo = {
  id: string;
  servicio_id: string;
  cuidador_id: string;
  tutor_id: string;
  mascota_id: string;
  fecha: string;
  hora_inicio: string;
  hora_fin: string | null;
  estado: string;
  direccion: string | null;
  notas_tutor: string | null;
  notas_cuidador: string | null;
  pet_name: string;
  pet_species: string;
  tutor_name: string;
  tutor_phone: string | null;
  tutor_direccion: string | null;
  tutor_comuna: string | null;
  service_type: string;
  service_title: string;
  duracion_minutos: number | null;
  precio: number;
};

type ServiceRecord = {
  id: string;
  reserva_id: string;
  checkin_at: string | null;
  checkout_at: string | null;
};

type FotoRecord = {
  id: string;
  url: string;
  descripcion: string | null;
  tomada_at: string;
};

type ChecklistItemTemplate = {
  id: string;
  nombre: string;
  categoria: string;
};

type ChecklistEjecucionRecord = {
  id: string;
  item_id: string;
  completado: boolean;
};

@Component({
  selector: 'app-servicio-en-curso',
  templateUrl: './servicio-en-curso.page.html',
  styleUrls: ['./servicio-en-curso.page.scss'],
})
export class ServicioEnCursoPage implements OnInit, OnDestroy {
  reservaId: string | null = null;
  reserva: ReservaInfo | null = null;
  serviceRecord: ServiceRecord | null = null;
  fotos: FotoRecord[] = [];
  checklistTemplates: ChecklistItemTemplate[] = [];
  checklistEjecucion: Map<string, ChecklistEjecucionRecord> = new Map();
  notasCuidador = '';
  loading = true;
  saving = false;
  elapsedSeconds = 0;
  private timerInterval: ReturnType<typeof setInterval> | null = null;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private auth: AuthService,
    private supabase: SupabaseService
  ) {}

  get serviceTypeLabel(): string {
    const map: Record<string, string> = { paseo: 'Paseo', visita: 'Visita', alojamiento: 'Alojamiento' };
    return map[this.reserva?.service_type ?? ''] ?? '';
  }

  get serviceTypeIcon(): string {
    const map: Record<string, string> = { paseo: 'directions_walk', visita: 'home', alojamiento: 'hotel' };
    return map[this.reserva?.service_type ?? ''] ?? 'event';
  }

  get formattedElapsed(): string {
    const h = Math.floor(this.elapsedSeconds / 3600);
    const m = Math.floor((this.elapsedSeconds % 3600) / 60);
    const s = this.elapsedSeconds % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }

  get especieLabel(): string {
    const map: Record<string, string> = { dog: 'Perro', cat: 'Gato', other: 'Otra' };
    return map[this.reserva?.pet_species ?? ''] ?? '';
  }

  async ngOnInit() {
    this.reservaId = this.route.snapshot.paramMap.get('reservaId');
    if (!this.reservaId) {
      await this.router.navigateByUrl('/tasks');
      return;
    }
    await this.loadData();
    this.startTimer();
  }

  ngOnDestroy() {
    this.stopTimer();
  }

  private startTimer() {
    this.stopTimer();
    if (this.serviceRecord?.checkin_at) {
      const checkin = new Date(this.serviceRecord.checkin_at).getTime();
      this.elapsedSeconds = Math.floor((Date.now() - checkin) / 1000);
      this.timerInterval = setInterval(() => {
        this.elapsedSeconds++;
      }, 1000);
    }
  }

  private stopTimer() {
    if (this.timerInterval !== null) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
  }

  private async loadData() {
    this.loading = true;
    try {
      const { data: reserva, error: reservaErr } = await this.supabase.client
        .from('reservas')
        .select(`
          *,
          pets!inner(name, species),
          servicios!inner(titulo, tipo, duracion_minutos, precio),
          tutor:profiles!reservas_tutor_id_fkey(full_name),
          tutor_profiles!inner(phone, direccion, comuna)
        `)
        .eq('id', this.reservaId)
        .single();

      if (reservaErr) throw reservaErr;
      if (!reserva) throw new Error('Reserva no encontrada');

      this.reserva = {
        id: reserva.id,
        servicio_id: reserva.servicio_id,
        cuidador_id: reserva.cuidador_id,
        tutor_id: reserva.tutor_id,
        mascota_id: reserva.mascota_id,
        fecha: reserva.fecha,
        hora_inicio: reserva.hora_inicio,
        hora_fin: reserva.hora_fin,
        estado: reserva.estado,
        direccion: reserva.direccion,
        notas_tutor: reserva.notas_tutor,
        notas_cuidador: reserva.notas_cuidador,
        pet_name: reserva.pets?.name ?? 'Mascota',
        pet_species: reserva.pets?.species ?? 'dog',
        tutor_name: reserva.tutor?.full_name ?? 'Tutor',
        tutor_phone: reserva.tutor_profiles?.phone ?? null,
        tutor_direccion: reserva.tutor_profiles?.direccion ?? null,
        tutor_comuna: reserva.tutor_profiles?.comuna ?? null,
        service_type: reserva.servicios?.tipo ?? 'paseo',
        service_title: reserva.servicios?.titulo ?? '',
        duracion_minutos: reserva.servicios?.duracion_minutos ?? null,
        precio: reserva.servicios?.precio ?? 0,
      };

      this.notasCuidador = this.reserva.notas_cuidador ?? '';

      const table = this.reserva.service_type === 'paseo' ? 'paseos'
        : this.reserva.service_type === 'visita' ? 'visitas'
        : 'alojamientos';

      const { data: sRecord } = await this.supabase.client
        .from(table)
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

      const { data: checklistData } = await this.supabase.client
        .from('checklist_items')
        .select('*')
        .eq('cuidador_id', this.auth.user!.id)
        .in('categoria', [this.reserva.service_type, 'general'])
        .eq('activo', true);

      this.checklistTemplates = checklistData ?? [];

      const { data: ejecucionData } = await this.supabase.client
        .from('checklist_ejecucion')
        .select('*')
        .eq('reserva_id', this.reservaId);

      const ejecMap = new Map<string, ChecklistEjecucionRecord>();
      for (const e of (ejecucionData ?? [])) {
        ejecMap.set(e.item_id, e);
      }
      this.checklistEjecucion = ejecMap;

    } catch (error: any) {
      console.error('Error cargando servicio:', error);
      alert('Error al cargar servicio: ' + (error?.message ?? 'Desconocido'));
      await this.router.navigateByUrl('/tasks');
    } finally {
      this.loading = false;
    }
  }

  isChecked(itemId: string): boolean {
    return this.checklistEjecucion.get(itemId)?.completado ?? false;
  }

  async toggleChecklist(itemId: string) {
    const current = this.checklistEjecucion.get(itemId);
    const now = new Date().toISOString();

    try {
      if (current) {
        const newVal = !current.completado;
        await this.supabase.client
          .from('checklist_ejecucion')
          .update({ completado: newVal, completado_at: newVal ? now : null })
          .eq('id', current.id);

        this.checklistEjecucion.set(itemId, { ...current, completado: newVal });
      } else {
        const { data, error } = await this.supabase.client
          .from('checklist_ejecucion')
          .insert({
            reserva_id: this.reservaId,
            item_id: itemId,
            completado: true,
            completado_at: now,
          })
          .select()
          .single();

        if (error) throw error;
        if (data) {
          this.checklistEjecucion.set(itemId, data);
        }
      }
    } catch (error: any) {
      alert('Error al actualizar checklist: ' + (error?.message ?? 'Desconocido'));
    }
  }

  async uploadPhoto(event: Event) {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;

    const file = input.files[0];
    const userId = this.auth.user?.id;
    if (!userId) return;

    const filePath = `servicio-fotos/${this.reservaId}/${Date.now()}_${file.name}`;

    try {
      const { error: uploadError } = await this.supabase.client.storage
        .from('servicio-fotos')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: urlData } = this.supabase.client.storage
        .from('servicio-fotos')
        .getPublicUrl(filePath);

      const photoUrl = urlData?.publicUrl ?? '';

      await this.supabase.client
        .from('fotos')
        .insert({
          reserva_id: this.reservaId,
          url: photoUrl,
          descripcion: null,
        });

      const { data: fotosData } = await this.supabase.client
        .from('fotos')
        .select('*')
        .eq('reserva_id', this.reservaId)
        .order('tomada_at', { ascending: false });

      this.fotos = fotosData ?? [];
    } catch (error: any) {
      alert('Error al subir foto: ' + (error?.message ?? 'Desconocido'));
    }

    input.value = '';
  }

  async completarServicio() {
    if (!this.reserva || !this.serviceRecord) return;
    if (!confirm(`¿Completar ${this.serviceTypeLabel} con ${this.reserva.pet_name}?`)) return;

    this.saving = true;
    try {
      const now = new Date().toISOString();
      const userId = this.auth.user?.id;
      if (!userId) return;

      const checkin = new Date(this.serviceRecord.checkin_at!).getTime();
      const durationMin = Math.round((Date.now() - checkin) / 60000);

      const table = this.reserva.service_type === 'paseo' ? 'paseos'
        : this.reserva.service_type === 'visita' ? 'visitas'
        : 'alojamientos';

      await this.supabase.client
        .from(table)
        .update({
          checkout_at: now,
          duracion_minutos: durationMin,
        })
        .eq('id', this.serviceRecord.id);

      await this.supabase.client
        .from('reservas')
        .update({
          estado: 'completada',
          notas_cuidador: this.notasCuidador,
        })
        .eq('id', this.reserva.id);

      await this.router.navigate(['/reporte', this.reserva.id]);
    } catch (error: any) {
      alert('Error al completar: ' + (error?.message ?? 'Desconocido'));
    } finally {
      this.saving = false;
    }
  }

  volver() {
    this.router.navigateByUrl('/tasks');
  }

  trackFoto(_index: number, item: FotoRecord): string {
    return item.id;
  }

  trackChecklist(_index: number, item: ChecklistItemTemplate): string {
    return item.id;
  }
}
