import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { SupabaseService } from '../../core/services/supabase.service';
import { UiService } from '../../core/services/ui.service';

type AgendaItem = {
  id: string;
  servicio_id: string;
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
  service_type: string;
  service_title: string;
  service_tipo: string;
  duracion_minutos: number | null;
  tutor_name: string;
  cuidador_name: string;
  checkin_at: string | null;
  checkout_at: string | null;
};

type FilterType = 'all' | 'paseo' | 'visita' | 'alojamiento';

@Component({
  selector: 'app-tasks',
  templateUrl: './tasks.page.html',
  styleUrls: ['./tasks.page.scss'],
})
export class TasksPage implements OnInit {
  items: AgendaItem[] = [];
  loading = true;
  selectedDate: string;
  todayStr: string;
  profileRole: string | null = null;
  filterType: FilterType = 'all';
  now = new Date();

  constructor(
    public ui: UiService,
    private auth: AuthService,
    private supabase: SupabaseService,
    private router: Router
  ) {
    this.todayStr = new Date().toISOString().slice(0, 10);
    this.selectedDate = this.todayStr;
  }

  async ngOnInit() {
    this.profileRole = await this.auth.getCurrentProfileRole();
    await this.loadAgenda();
  }

  get todayLabel(): string {
    const today = new Date().toISOString().slice(0, 10);
    if (this.selectedDate === today) return 'Hoy';
    const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
    if (this.selectedDate === tomorrow) return 'Mañana';
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    if (this.selectedDate === yesterday) return 'Ayer';
    return this.formatDate(this.selectedDate);
  }

  get stats() {
    const total = this.items.length;
    const pendientes = this.items.filter(i => i.estado === 'pendiente' || i.estado === 'confirmada').length;
    const enCurso = this.items.filter(i => i.estado === 'en_curso').length;
    const completados = this.items.filter(i => i.estado === 'completada').length;
    return { total, pendientes, enCurso, completados };
  }

  get filteredItems(): AgendaItem[] {
    if (this.filterType === 'all') return this.items;
    return this.items.filter(i => i.service_tipo === this.filterType);
  }

  get isCuidador(): boolean {
    return this.profileRole === 'cuidador';
  }

  setFilter(type: FilterType): void {
    this.filterType = type;
  }

  prevDay(): void {
    const d = new Date(this.selectedDate);
    d.setDate(d.getDate() - 1);
    this.selectedDate = d.toISOString().slice(0, 10);
    void this.loadAgenda();
  }

  nextDay(): void {
    const d = new Date(this.selectedDate);
    d.setDate(d.getDate() + 1);
    this.selectedDate = d.toISOString().slice(0, 10);
    void this.loadAgenda();
  }

  goToday(): void {
    this.selectedDate = new Date().toISOString().slice(0, 10);
    void this.loadAgenda();
  }

  estadoLabel(estado: string): string {
    const map: Record<string, string> = {
      pendiente: 'Pendiente',
      confirmada: 'Confirmada',
      en_curso: 'En curso',
      completada: 'Completada',
      cancelada: 'Cancelada',
    };
    return map[estado] || estado;
  }

  tipoLabel(tipo: string): string {
    const map: Record<string, string> = {
      paseo: 'Paseo',
      visita: 'Visita',
      alojamiento: 'Alojamiento',
    };
    return map[tipo] || tipo;
  }

  speciesIcon(species: string): string {
    return species === 'dog' ? 'pets' : species === 'cat' ? 'pets' : 'cruelty_free';
  }

  tipoIcon(tipo: string): string {
    const map: Record<string, string> = {
      paseo: 'directions_walk',
      visita: 'home',
      alojamiento: 'hotel',
    };
    return map[tipo] || 'event';
  }

  async loadAgenda() {
    this.loading = true;
    try {
      const user = this.auth.user;
      if (!user) return;

      const roleColumn = this.isCuidador ? 'cuidador_id' : 'tutor_id';

      const { data: reservas, error } = await this.supabase.client
        .from('reservas')
        .select(`
          *,
          pets (name, species),
          servicios (tipo, titulo, duracion_minutos),
          tutor:profiles!reservas_tutor_id_fkey (full_name),
          cuidador:profiles!reservas_cuidador_id_fkey (full_name)
        `)
        .eq(roleColumn, user.id)
        .eq('fecha', this.selectedDate)
        .order('hora_inicio', { ascending: true });

      if (error) throw error;

      // Load paseos/visitas/alojamientos for check-in/check-out times
      const reservaIds = (reservas ?? []).map((r: any) => r.id);
      let paseosMap = new Map<string, any>();
      let visitasMap = new Map<string, any>();
      let alojamientosMap = new Map<string, any>();

      if (reservaIds.length > 0) {
        const [paseosRes, visitasRes, alojamientosRes] = await Promise.all([
          this.supabase.client.from('paseos').select('*').in('reserva_id', reservaIds),
          this.supabase.client.from('visitas').select('*').in('reserva_id', reservaIds),
          this.supabase.client.from('alojamientos').select('*').in('reserva_id', reservaIds),
        ]);

        if (!paseosRes.error) {
          for (const p of (paseosRes.data ?? [])) paseosMap.set(p.reserva_id, p);
        }
        if (!visitasRes.error) {
          for (const v of (visitasRes.data ?? [])) visitasMap.set(v.reserva_id, v);
        }
        if (!alojamientosRes.error) {
          for (const a of (alojamientosRes.data ?? [])) alojamientosMap.set(a.reserva_id, a);
        }
      }

      this.items = (reservas ?? []).map((r: any) => {
        const tipo: string = r.servicios?.tipo ?? 'paseo';
        let checkin: string | null = null;
        let checkout: string | null = null;

        if (tipo === 'paseo' && paseosMap.has(r.id)) {
          checkin = paseosMap.get(r.id).checkin_at;
          checkout = paseosMap.get(r.id).checkout_at;
        } else if (tipo === 'visita' && visitasMap.has(r.id)) {
          checkin = visitasMap.get(r.id).checkin_at;
          checkout = visitasMap.get(r.id).checkout_at;
        } else if (tipo === 'alojamiento' && alojamientosMap.has(r.id)) {
          checkin = alojamientosMap.get(r.id).checkin_at;
          checkout = alojamientosMap.get(r.id).checkout_at;
        }

        return {
          id: r.id,
          servicio_id: r.servicio_id,
          mascota_id: r.mascota_id,
          fecha: r.fecha,
          hora_inicio: r.hora_inicio,
          hora_fin: r.hora_fin,
          estado: r.estado,
          direccion: r.direccion,
          notas_tutor: r.notas_tutor,
          notas_cuidador: r.notas_cuidador,
          pet_name: r.pets?.name ?? 'Mascota',
          pet_species: r.pets?.species ?? 'dog',
          service_type: tipo,
          service_title: r.servicios?.titulo ?? '',
          service_tipo: tipo,
          duracion_minutos: r.servicios?.duracion_minutos ?? null,
          tutor_name: r.tutor?.full_name ?? 'Tutor',
          cuidador_name: r.cuidador?.full_name ?? 'Cuidador',
          checkin_at: checkin,
          checkout_at: checkout,
        };
      });
    } catch (error) {
      console.error('Error cargando agenda:', error);
    } finally {
      this.loading = false;
    }
  }

  async iniciarServicio(item: AgendaItem) {
    if (!confirm(`¿Iniciar ${this.tipoLabel(item.service_tipo)} con ${item.pet_name}?`)) return;

    try {
      const now = new Date().toISOString();
      const userId = this.auth.user?.id;
      if (!userId) return;

      const { error: reservaError } = await this.supabase.client
        .from('reservas')
        .update({ estado: 'en_curso' })
        .eq('id', item.id);
      if (reservaError) throw reservaError;

      const payload = { reserva_id: item.id, checkin_at: now };

      if (item.service_tipo === 'paseo') {
        const { error } = await this.supabase.client.from('paseos').insert(payload);
        if (error) throw error;
      } else if (item.service_tipo === 'visita') {
        const { error } = await this.supabase.client.from('visitas').insert(payload);
        if (error) throw error;
      } else if (item.service_tipo === 'alojamiento') {
        const { error } = await this.supabase.client.from('alojamientos').insert(payload);
        if (error) throw error;
      }

      await this.router.navigate(['/servicio-en-curso', item.id]);
    } catch (error: any) {
      alert(`Error al iniciar: ${error?.message ?? 'Desconocido'}`);
    }
  }

  async completarServicio(item: AgendaItem) {
    const action = item.service_tipo === 'alojamiento' ? 'finalizar' : 'completar';
    if (!confirm(`¿${action} ${this.tipoLabel(item.service_tipo)} con ${item.pet_name}?`)) return;

    try {
      const now = new Date().toISOString();
      const userId = this.auth.user?.id;
      if (!userId) return;

      const { error: reservaError } = await this.supabase.client
        .from('reservas')
        .update({ estado: 'completada' })
        .eq('id', item.id);
      if (reservaError) throw reservaError;

      const table = item.service_tipo === 'paseo' ? 'paseos'
        : item.service_tipo === 'visita' ? 'visitas'
        : 'alojamientos';

      const { error } = await this.supabase.client
        .from(table)
        .update({ checkout_at: now })
        .eq('reserva_id', item.id);
      if (error) throw error;

      await this.loadAgenda();
    } catch (error: any) {
      alert(`Error al completar: ${error?.message ?? 'Desconocido'}`);
    }
  }

  async cancelarReserva(item: AgendaItem) {
    if (!confirm(`¿Cancelar la reserva con ${item.pet_name}?`)) return;

    try {
      const { error } = await this.supabase.client
        .from('reservas')
        .update({ estado: 'cancelada' })
        .eq('id', item.id);
      if (error) throw error;
      await this.loadAgenda();
    } catch (error: any) {
      alert(`Error al cancelar: ${error?.message ?? 'Desconocido'}`);
    }
  }

  formatTime(iso: string | null): string {
    if (!iso) return '--:--';
    return iso.slice(11, 16);
  }

  formatDateTime(iso: string | null): string {
    if (!iso) return '--:--';
    const d = new Date(iso);
    return d.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' });
  }

  private formatDate(iso: string): string {
    const d = new Date(iso + 'T12:00:00');
    return d.toLocaleDateString('es-CL', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    });
  }
}
