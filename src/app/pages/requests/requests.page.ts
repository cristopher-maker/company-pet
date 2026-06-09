import { Component, OnDestroy, OnInit, ViewEncapsulation } from '@angular/core';
import { SupabaseService } from '../../core/services/supabase.service';
import { UiService } from '../../core/services/ui.service';

type CareRequestRow = {
  id: string;
  topic: string;
  channel: string;
  status: 'open' | 'assigned' | 'in_progress' | 'resolved' | 'closed';
  created_at: string;
  appointment?: RequestAppointmentRow | null;
};

type RequestAppointmentRow = {
  id: string;
  request_id: string;
  kind: string;
  scheduled_for: string;
  status: string;
  appointment_phone?: string | null;
  appointment_contact_name?: string | null;
  meeting_url?: string | null;
  meeting_code?: string | null;
  meeting_provider?: string | null;
};

@Component({
  selector: 'app-requests',
  templateUrl: './requests.page.html',
  styleUrls: ['./requests.page.scss'],
  encapsulation: ViewEncapsulation.None,
})
export class RequestsPage implements OnInit, OnDestroy {
  public loading = true;
  public error: string | null = null;
  public items: CareRequestRow[] = [];
  public currentPage = 1;
  public readonly pageSize = 6;
  public generatingMeetingId: string | null = null;
  public meetingGenerationErrors = new Map<string, string>();

  private unsub?: { data: { subscription: { unsubscribe: () => void } } };
  private readonly attemptedMeetingGeneration = new Set<string>();

  constructor(
    private readonly supabase: SupabaseService,
    public readonly ui: UiService
  ) {}

  public ngOnInit(): void {
    void this.refresh();
    this.unsub = this.supabase.client.auth.onAuthStateChange(() => void this.refresh());
  }

  public ngOnDestroy(): void {
    this.unsub?.data.subscription.unsubscribe();
  }

  public async refresh(): Promise<void> {
    this.loading = true;
    this.error = null;

    const { data: sessionData } = await this.supabase.client.auth.getSession();
    const userId = sessionData.session?.user?.id;
    if (!userId) {
      this.items = [];
      this.loading = false;
      return;
    }

    try {
      const { data, error } = await this.supabase.client
        .from('pet_support_requests')
        .select('id, title, channel, status, created_at')
        .eq('employee_id', userId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      const requestRows = (data ?? []) as any[];
      const appointmentsByRequest = await this.loadAppointmentsByRequest(userId, requestRows.map((item) => item.id));

      this.items = requestRows.map((item: any) => ({
        id: item.id,
        topic: item.title,
        channel: item.channel,
        status: item.status,
        created_at: item.created_at,
        appointment: appointmentsByRequest.get(item.id) ?? null,
      })) as CareRequestRow[];
      const totalPages = this.totalPages;
      if (this.currentPage > totalPages) this.currentPage = totalPages;
      void this.ensureMissingMeetingLinks();
    } catch (err: any) {
      this.error = err.message;
    } finally {
      this.loading = false;
    }
  }

  private async loadAppointmentsByRequest(userId: string, requestIds: string[]): Promise<Map<string, RequestAppointmentRow>> {
    const result = new Map<string, RequestAppointmentRow>();
    if (!requestIds.length) return result;

    const { data, error } = await this.supabase.client
      .from('appointments')
      .select('id, request_id, kind, scheduled_for, status, appointment_phone, appointment_contact_name, meeting_url, meeting_code, meeting_provider')
      .eq('employee_id', userId)
      .in('request_id', requestIds)
      .order('scheduled_for', { ascending: true });

    if (error) throw error;

    const now = Date.now();
    const rows = ((data ?? []) as RequestAppointmentRow[]).filter((appointment) => appointment.status !== 'cancelled');

    for (const requestId of requestIds) {
      const requestAppointments = rows.filter((appointment) => appointment.request_id === requestId);
      const nextAppointment =
        requestAppointments.find((appointment) => new Date(appointment.scheduled_for).getTime() >= now) ??
        requestAppointments[requestAppointments.length - 1] ??
        null;

      if (nextAppointment) result.set(requestId, nextAppointment);
    }

    return result;
  }

  public statusLabel(status: CareRequestRow['status']): string {
    const labels: Record<CareRequestRow['status'], string> = {
      open: 'Abierto', assigned: 'Asignado', in_progress: 'En Progreso', resolved: 'Resuelto', closed: 'Cerrado',
    };
    return labels[status] ?? status;
  }

  public statusClass(status: CareRequestRow['status']): string {
    const classes: Record<CareRequestRow['status'], string> = {
      open: 'request-card__status--open',
      assigned: 'request-card__status--assigned',
      in_progress: 'request-card__status--in-progress',
      resolved: 'request-card__status--resolved',
      closed: 'request-card__status--closed',
    };
    return classes[status] ?? 'request-card__status--closed';
  }

  public appointmentStatusLabel(status: string): string {
    const normalized = (status || '').toLowerCase();
    const labels: Record<string, string> = {
      scheduled: 'Agendada',
      confirmed: 'Confirmada',
      completed: 'Realizada',
      cancelled: 'Cancelada',
    };
    return labels[normalized] ?? status;
  }

  private async ensureMissingMeetingLinks(): Promise<void> {
    const pendingAppointment = this.items
      .map((item) => item.appointment)
      .find((appointment): appointment is RequestAppointmentRow =>
        !!appointment &&
        appointment.kind === 'Videollamada' &&
        !appointment.meeting_url &&
        !this.attemptedMeetingGeneration.has(appointment.id)
      );

    if (!pendingAppointment) return;
    await this.generateMeetingLink(pendingAppointment, false);
  }

  public async generateMeetingLink(appointment: RequestAppointmentRow, showErrors = true): Promise<void> {
    if (!appointment?.id || this.generatingMeetingId) return;

    this.generatingMeetingId = appointment.id;
    this.attemptedMeetingGeneration.add(appointment.id);
    this.meetingGenerationErrors.delete(appointment.id);

    try {
      const session = await this.supabase.client.auth.getSession();
      const accessToken = session.data.session?.access_token;
      if (!accessToken) throw new Error('Tu sesion expiro. Vuelve a iniciar sesion e intentalo otra vez.');

      const { data, error } = await this.supabase.client.functions.invoke('create-google-meet', {
        body: { appointmentId: appointment.id },
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (error) {
        const context = (error as any).context;
        if (context instanceof Response) {
          const payload = await context.json().catch(() => null);
          if (payload?.error) throw new Error(String(payload.error));
        }
        throw new Error(error.message);
      }

      if ((data as any)?.error) throw new Error(String((data as any).error));
      await this.refresh();
    } catch (err: any) {
      const message = err?.message ?? 'No se pudo generar el enlace de Google Meet.';
      this.meetingGenerationErrors.set(appointment.id, message);
      if (showErrors) alert(message);
    } finally {
      this.generatingMeetingId = null;
    }
  }

  public get openRequestsCount(): number {
    return this.items.filter((item) => item.status === 'open' || item.status === 'assigned' || item.status === 'in_progress').length;
  }

  public get closedRequestsCount(): number {
    return this.items.filter((item) => item.status === 'resolved' || item.status === 'closed').length;
  }

  public get totalPages(): number {
    return Math.max(1, Math.ceil(this.items.length / this.pageSize));
  }

  public get pages(): number[] {
    const maxPagesToShow = 7;
    let start = Math.max(1, this.currentPage - Math.floor(maxPagesToShow / 2));
    let end = Math.min(this.totalPages, start + maxPagesToShow - 1);

    if (end - start + 1 < maxPagesToShow) {
      start = Math.max(1, end - maxPagesToShow + 1);
    }

    const result: number[] = [];
    for (let i = start; i <= end; i += 1) {
      result.push(i);
    }
    return result;
  }

  public get visibleItems(): CareRequestRow[] {
    const start = (this.currentPage - 1) * this.pageSize;
    return this.items.slice(start, start + this.pageSize);
  }

  public goToPage(page: number): void {
    if (page < 1 || page > this.totalPages) return;
    this.currentPage = page;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  public prevPage(): void {
    this.goToPage(this.currentPage - 1);
  }

  public nextPage(): void {
    this.goToPage(this.currentPage + 1);
  }
}
