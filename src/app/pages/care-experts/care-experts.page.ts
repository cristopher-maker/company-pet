import { Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';

import { AuthService, ProfileRole } from '../../core/services/auth.service';
import { UiService } from '../../core/services/ui.service';
import { SupabaseService } from '../../core/services/supabase.service';

type SupportChannel = 'Chat' | 'Videollamada' | 'Llamada';

type CareMessage = {
  id: string;
  body: string;
  created_at: string;
  sender_id: string;
  sender_name?: string | null;
  kind?: 'client' | 'internal';
};

type CareRequestStatus = 'open' | 'assigned' | 'in_progress' | 'resolved' | 'closed';
type ExpertFilter = 'all' | 'mine' | 'open' | 'unread';
type ExpertAvailability = 'online' | 'busy' | 'away';
type ComposerMode = 'client' | 'internal';

type ExpertRequest = {
  id: string;
  topic: string;
  channel: SupportChannel;
  status: CareRequestStatus;
  created_at: string;
  updated_at: string;
  details: string | null;
  employee_id: string;
  assigned_expert_id: string | null;
  employee_name: string | null;
  employee_email: string | null;
};

type CollaboratorSummary = {
  fullName: string | null;
  email: string | null;
  company: string | null;
  memberRole: string | null;
  location: string | null;
  familyAge: string | null;
  relation: string | null;
  condition: string | null;
  dependencyLevel: string | null;
  preferredContact: string | null;
  supportNetwork: string | null;
};

type QuickReply = {
  label: string;
  body: string;
};

type AttachmentAction = {
  label: string;
  body: string;
};

type AppointmentStatus = 'scheduled' | 'confirmed' | 'completed' | 'cancelled';

type AppointmentRow = {
  id: string;
  request_id: string | null;
  employee_id: string;
  expert_id: string | null;
  kind: 'Videollamada' | 'Llamada';
  scheduled_for: string;
  notes: string | null;
  status: AppointmentStatus;
  created_at: string;
  meeting_provider?: string | null;
  meeting_url?: string | null;
  meeting_code?: string | null;
  meeting_space_name?: string | null;
};

type CareTaskStatus = 'pending' | 'in_progress' | 'done';

type CareTaskRow = {
  id: string;
  request_id: string | null;
  employee_id: string;
  created_by: string;
  title: string;
  notes: string | null;
  due_at: string | null;
  priority: 'low' | 'medium' | 'high';
  status: CareTaskStatus;
  created_at: string;
};

@Component({
  selector: 'app-care-experts',
  templateUrl: './care-experts.page.html',
  styleUrls: ['./care-experts.page.scss'],
})
export class CareExpertsPage implements OnInit, OnDestroy {
  public channel: SupportChannel = 'Chat';
  public topic = 'Orientación general';
  public details = '';
  public advisorStep = 1;
  public profileRole: ProfileRole | null = null;
  public expertMode = false;
  public hasBenefitAccess = false;

  public loading = false;
  public error: string | null = null;
  public activeRequestId: string | null = null;
  public activeRequestChannel: SupportChannel | null = null;
  public messages: CareMessage[] = [];
  public messageDraft = '';
  public expertRequests: ExpertRequest[] = [];
  public selectedRequest: ExpertRequest | null = null;
  public statusDraft: CareRequestStatus = 'open';
  public searchTerm = '';
  public requestFilter: ExpertFilter = 'all';
  public expertActiveFilter: ExpertFilter = 'all';
  public availability: ExpertAvailability = 'online';
  public showExpertMenu = false;
  public showHistory = false;
  public showQuickReplies = false;
  public showAttachmentMenu = false;
  public composerMode: ComposerMode = 'client';
  public selectedCollaborator: CollaboratorSummary | null = null;
  public selectedHistory: ExpertRequest[] = [];
  public selectedTags: string[] = [];
  public employeeAppointments: AppointmentRow[] = [];
  public employeeTasks: CareTaskRow[] = [];
  public saving = false;
  public selectedAppointments: AppointmentRow[] = [];
  public appointmentDate = '';
  public appointmentTime = '';
  public appointmentKind: 'Videollamada' | 'Llamada' = 'Videollamada';
  public appointmentNotes = '';
  public taskDraftTitle = '';
  public taskDraftDueDate = '';
  public readonly minAppointmentDate = new Date().toISOString().slice(0, 10);
  public readonly maxAppointmentDate = new Date(
    new Date().getFullYear(),
    new Date().getMonth() + 2,
    0
  )
    .toISOString()
    .slice(0, 10);
  public readonly appointmentCalendarValue = this.minAppointmentDate;
  public resolvedToday = 0;
  public averageResponseMinutes = 0;
  public overdueAppointmentsByRequestId: Record<string, number> = {};
  public overdueTasksByRequestId: Record<string, number> = {};
  public readonly appointmentVideoSlots = [
    '09:00',
    '09:30',
    '10:00',
    '10:30',
    '11:00',
    '11:30',
    '12:00',
    '12:30',
    '13:00',
    '13:30',
    '14:00',
    '14:30',
    '15:00',
    '15:30',
    '16:00',
    '16:30',
    '17:00',
    '17:30',
  ];
  public readonly appointmentCallSlots = [
    '08:30',
    '09:00',
    '09:30',
    '10:00',
    '10:30',
    '11:00',
    '11:30',
    '12:00',
    '12:30',
    '13:00',
    '15:30',
    '16:00',
    '16:30',
    '17:00',
    '17:30',
    '18:00',
    '18:30',
    '19:00',
  ];

  public readonly topics = [
    'Orientación general',
    'Evaluación de necesidades',
    'Veterinarias y opciones',
    'Cuidados a domicilio',
    'Apoyo emocional y estrés',
    'Beneficios y financiación',
  ] as const;

  public readonly expertFilterOptions: { value: ExpertFilter; label: string }[] = [
    { value: 'all', label: 'Todos' },
    { value: 'mine', label: 'Mis Casos' },
    { value: 'open', label: 'Abiertos' },
  ];

  public readonly expertStatuses: CareRequestStatus[] = [
    'open',
    'assigned',
    'in_progress',
    'resolved',
    'closed',
  ];

  public readonly availableTags = ['Urgente', 'Hotel para mascotas', 'Apoyo emocional', 'Presupuesto', 'Seguimiento'];
  public readonly quickReplies: QuickReply[] = [
    {
      label: 'Bienvenida',
      body: 'Hola, soy tu Pet Expert asignado. Ya revisé tu caso y te ayudaré con los siguientes pasos.',
    },
    {
      label: 'Solicitud de antecedentes',
      body: 'Para orientarte mejor, necesito confirmar presupuesto estimado, ubicación y nivel de apoyo requerido.',
    },
    {
      label: 'Siguiente paso',
      body: 'Te propongo avanzar con una evaluación inicial y luego revisar opciones concretas según tu necesidad.',
    },
  ];
  public readonly attachmentActions: AttachmentAction[] = [
    { label: 'Ficha de evaluación', body: 'Adjunto ficha de evaluación inicial para completar en la siguiente interacción.' },
    { label: 'Checklist inicial', body: 'Comparto checklist inicial con los datos que necesito para avanzar con la orientación.' },
    { label: 'Guía de documentos', body: 'Adjunto listado de documentos sugeridos para continuar con la gestión.' },
  ];

  public get appointmentTimeSlots(): string[] {
    return this.appointmentKind === 'Llamada' ? this.appointmentCallSlots : this.appointmentVideoSlots;
  }

  public get canScheduleAppointment(): boolean {
    return this.channel === 'Videollamada' || this.channel === 'Llamada';
  }

  public get hasActiveChatRequest(): boolean {
    return !!this.activeRequestId && this.activeRequestChannel === 'Chat';
  }

  public get totalAdvisorSteps(): number {
    return 3;
  }

  public get advisorProgressPercent(): number {
    return Math.round((this.advisorStep / this.totalAdvisorSteps) * 100);
  }

  public get advisorCurrentStepLabel(): string {
    return `Paso ${this.advisorStep} de ${this.totalAdvisorSteps}`;
  }

  public get advisorPrimaryButtonLabel(): string {
    if (this.advisorStep < this.totalAdvisorSteps) return 'Continuar';
    if (this.channel === 'Chat') return this.loading ? 'Creando chat...' : 'Iniciar chat';
    return this.loading ? 'Agendando...' : `Agendar ${this.channel === 'Videollamada' ? 'videollamada' : 'llamada'}`;
  }

  public get advisorVisualTitle(): string {
    if (this.advisorStep === 1) {
      return 'Cuéntanos qué tipo de apoyo necesitas';
    }

    if (this.channel === 'Chat') {
      return 'Un Pet Expert responderá por chat en la misma página';
    }

    if (this.channel === 'Videollamada') {
      return 'Agenda una videollamada y revisa tu acceso desde próximas citas';
    }

    return 'Reserva una llamada y deja el contexto para aprovechar mejor el tiempo';
  }

  public get advisorVisualBody(): string {
    if (this.advisorStep === 1) {
      return 'Elige el canal, tema y tipo de acompañamiento. El flujo te guía paso a paso para que no tengas que resolver todo de una sola vez.';
    }

    if (this.channel === 'Chat') {
      return 'Ideal para orientación inicial, dudas rápidas y seguimiento escrito con historial dentro de la plataforma.';
    }

    if (this.channel === 'Videollamada') {
      return 'Perfecto para revisar opciones con más contexto, conversar cara a cara y avanzar con una recomendación guiada.';
    }

    return 'Útil cuando prefieres coordinación por voz o necesitas ordenar próximos pasos con una llamada breve.';
  }

  public get advisorVisualNote(): string {
    if (this.advisorStep === 3 && this.channel === 'Chat') {
      return 'Al confirmar, el chat quedará abierto debajo para continuar la conversación.';
    }

    if (this.advisorStep === 3 && this.canScheduleAppointment) {
      return 'Al confirmar, la cita quedará en próximas citas y desde ahí verás el acceso cuando corresponda.';
    }

    return 'La información que compartes es confidencial y solo se usa para preparar la orientación adecuada.';
  }

  public get advisorVisualAccent(): 'chat' | 'video' | 'call' {
    if (this.channel === 'Videollamada') return 'video';
    if (this.channel === 'Llamada') return 'call';
    return 'chat';
  }

  private realtimeChannel: any | null = null;
  private readonly allowedRoles: ProfileRole[] = ['employee', 'pet_expert', 'admin'];

  constructor(
    public readonly auth: AuthService,
    private readonly supabase: SupabaseService,
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    public readonly ui: UiService
  ) {}

  public ngOnInit(): void {
    void this.bootstrap();
  }

  public ngOnDestroy(): void {
    void this.teardownRealtime();
  }

  public async startRequest(): Promise<void> {
    if (this.expertMode) return;
    if (!this.ensureBenefitAccess()) return;
    if (this.channel !== 'Chat') {
      alert('Por ahora solo está disponible el canal Chat (demo).');
      return;
    }

    const user = this.auth.user;
    if (!user) {
      await this.router.navigateByUrl('/login');
      return;
    }

    const firstMessage = this.details.trim();
    if (!firstMessage) {
      alert('Cuéntanos tu situación (no puede estar vacío).');
      return;
    }

    this.saving = true;
    try {
      const { data: requestRow, error: requestError } = await this.supabase.client
        .from('care_requests')
        .insert({
          employee_id: user.id,
          channel: this.channel,
          topic: this.topic,
          details: firstMessage,
        })
        .select('id')
        .single();

      if (requestError) throw requestError;

      this.activeRequestId = requestRow.id as string;
      this.activeRequestChannel = 'Chat';

      const { error: messageError } = await this.supabase.client.from('care_messages').insert({
        request_id: this.activeRequestId,
        sender_id: user.id,
        body: firstMessage,
      });
      if (messageError) throw messageError;

      this.details = '';
      await this.loadMessages();
      await this.setupRealtime();
    } catch (err: any) {
      console.error(err);
      alert(err?.message ?? 'No se pudo crear la solicitud.');
    } finally {
      this.saving = false;
    }
  }

  public selectChannel(channel: SupportChannel): void {
    this.channel = channel;
    if (channel === 'Videollamada' || channel === 'Llamada') {
      this.appointmentKind = channel;
      if (this.appointmentTime && !this.appointmentTimeSlots.includes(this.appointmentTime)) {
        this.appointmentTime = '';
      }
    }
  }

  public selectTopic(topic: string): void {
    this.topic = topic;
  }

  public previousAdvisorStep(): void {
    this.advisorStep = Math.max(1, this.advisorStep - 1);
  }

  public async advanceAdvisorStep(): Promise<void> {
    if (this.advisorStep < this.totalAdvisorSteps) {
      if (!this.canAdvanceFromCurrentStep()) return;
      this.advisorStep += 1;
      return;
    }

    if (this.channel === 'Chat') {
      await this.startRequest();
      return;
    }

    await this.scheduleAppointment();
  }

  public onAppointmentKindChange(kind: 'Videollamada' | 'Llamada'): void {
    this.appointmentKind = kind;
    this.channel = kind;
    if (this.appointmentTime && !this.appointmentTimeSlots.includes(this.appointmentTime)) {
      this.appointmentTime = '';
    }
  }

  public onAppointmentDateChange(value: string | null | undefined): void {
    this.appointmentDate = value ? String(value).slice(0, 10) : '';
    this.appointmentTime = '';
  }

  public appointmentStatusLabel(status: AppointmentStatus): string {
    switch (status) {
      case 'confirmed':
        return 'Confirmada';
      case 'completed':
        return 'Completada';
      case 'cancelled':
        return 'Cancelada';
      default:
        return 'Agendada';
    }
  }

  public isAppointmentOverdue(appointment: AppointmentRow): boolean {
    const activeStatus = appointment.status === 'scheduled' || appointment.status === 'confirmed';
    return activeStatus && new Date(appointment.scheduled_for).getTime() < Date.now();
  }

  public hasOverdueAppointments(requestId: string | null | undefined): boolean {
    if (!requestId) return false;
    return (this.overdueAppointmentsByRequestId[requestId] ?? 0) > 0;
  }

  public hasOverdueTasks(requestId: string | null | undefined): boolean {
    if (!requestId) return false;
    return (this.overdueTasksByRequestId[requestId] ?? 0) > 0;
  }

  public isRequestStale(request: ExpertRequest | null | undefined): boolean {
    if (!request) return false;
    if (request.status === 'resolved' || request.status === 'closed') return false;

    const lastActivityAt = new Date(request.updated_at || request.created_at).getTime();
    const staleAfterHours = 24;
    return Date.now() - lastActivityAt >= staleAfterHours * 60 * 60 * 1000;
  }

  public requestNeedsAttention(request: ExpertRequest | null | undefined): boolean {
    if (!request?.id) return false;
    return this.hasOverdueAppointments(request.id) || this.hasOverdueTasks(request.id) || this.isRequestStale(request);
  }

  public requestAttentionLabel(request: ExpertRequest | null | undefined): string {
    if (!request?.id) return '';
    const overdueAppointments = this.overdueAppointmentsByRequestId[request.id] ?? 0;
    const overdueTasks = this.overdueTasksByRequestId[request.id] ?? 0;
    const stale = this.isRequestStale(request);

    if (overdueAppointments && overdueTasks) return 'Seguimiento vencido';
    if (overdueAppointments) return overdueAppointments === 1 ? 'Cita vencida' : `${overdueAppointments} citas vencidas`;
    if (overdueTasks) return overdueTasks === 1 ? 'Tarea vencida' : `${overdueTasks} tareas vencidas`;
    if (stale) {
      const lastActivityAt = new Date(request.updated_at || request.created_at).getTime();
      const elapsedDays = Math.max(1, Math.floor((Date.now() - lastActivityAt) / (24 * 60 * 60 * 1000)));
      return elapsedDays === 1 ? 'Sin seguimiento desde ayer' : `Sin seguimiento hace ${elapsedDays} días`;
    }
    return '';
  }

  public taskStatusLabel(status: CareTaskStatus): string {
    switch (status) {
      case 'in_progress':
        return 'En progreso';
      case 'done':
        return 'Hecha';
      default:
        return 'Pendiente';
    }
  }

  public taskRequestLabel(task: CareTaskRow): string {
    if (!task.request_id) return 'Tarea personal';
    if (task.request_id === this.activeRequestId) return 'Asociada a este caso';
    return 'Asociada a otra solicitud';
  }

  public hasMeetingLink(appointment: AppointmentRow): boolean {
    return !!appointment.meeting_url && appointment.kind === 'Videollamada';
  }

  public get nextAppointment(): AppointmentRow | null {
    const now = Date.now();
    return (
      this.employeeAppointments
        .filter(
          (appointment) =>
            (appointment.status === 'scheduled' || appointment.status === 'confirmed') &&
            new Date(appointment.scheduled_for).getTime() >= now
        )
        .sort((left, right) => new Date(left.scheduled_for).getTime() - new Date(right.scheduled_for).getTime())[0] ??
      null
    );
  }

  public get visibleEmployeeTasks(): CareTaskRow[] {
    const currentRequestId = this.activeRequestId;
    return [...this.employeeTasks].sort((left, right) => {
      const leftCurrent = left.request_id && left.request_id === currentRequestId ? 1 : 0;
      const rightCurrent = right.request_id && right.request_id === currentRequestId ? 1 : 0;
      if (leftCurrent !== rightCurrent) return rightCurrent - leftCurrent;
      if (left.status !== right.status) {
        const weight: Record<CareTaskStatus, number> = { pending: 0, in_progress: 1, done: 2 };
        return weight[left.status] - weight[right.status];
      }
      return new Date(left.created_at).getTime() - new Date(right.created_at).getTime();
    });
  }

  public get selectedPrimaryAppointment(): AppointmentRow | null {
    return (
      this.selectedAppointments.find(
        (appointment) =>
          (appointment.status === 'scheduled' || appointment.status === 'confirmed') && this.hasMeetingLink(appointment)
      ) ??
      this.selectedAppointments.find(
        (appointment) => appointment.status === 'scheduled' || appointment.status === 'confirmed'
      ) ??
      this.selectedAppointments[0] ??
      null
    );
  }

  public async addTask(): Promise<void> {
    const user = this.auth.user;
    const title = this.taskDraftTitle.trim();
    if (!user || !title) return;

    this.loading = true;
    try {
      const dueAt = this.taskDraftDueDate ? new Date(`${this.taskDraftDueDate}T23:59:00`).toISOString() : null;
      const { error } = await this.supabase.client.from('care_tasks').insert({
        request_id: this.activeRequestId,
        employee_id: user.id,
        created_by: user.id,
        title,
        due_at: dueAt,
        priority: 'medium',
        status: 'pending',
      } as any);
      if (error) throw error;

      this.taskDraftTitle = '';
      this.taskDraftDueDate = '';
      await this.loadEmployeeTasks();
    } catch (err: any) {
      alert(err?.message ?? 'No se pudo crear la tarea.');
    } finally {
      this.loading = false;
    }
  }

  public async updateTaskStatus(task: CareTaskRow, status: CareTaskStatus): Promise<void> {
    const { error } = await this.supabase.client.from('care_tasks').update({ status }).eq('id', task.id);
    if (error) {
      alert(error.message);
      return;
    }
    await this.loadEmployeeTasks();
  }

  public async removeTask(task: CareTaskRow): Promise<void> {
    const { error } = await this.supabase.client.from('care_tasks').delete().eq('id', task.id);
    if (error) {
      alert(error.message);
      return;
    }
    await this.loadEmployeeTasks();
  }

  public async scheduleAppointment(): Promise<void> {
    if (this.expertMode) return;
    if (!this.ensureBenefitAccess()) return;

    const user = this.auth.user;
    if (!user) {
      await this.router.navigateByUrl('/login');
      return;
    }

    if (!this.appointmentDate || !this.appointmentTime) {
      alert('Selecciona día y hora.');
      return;
    }

    const scheduledFor = new Date(`${this.appointmentDate}T${this.appointmentTime}:00`);
    if (Number.isNaN(scheduledFor.getTime()) || scheduledFor.getTime() <= Date.now()) {
      alert('La cita debe quedar agendada en una fecha futura.');
      return;
    }

    this.loading = true;
    try {
      let requestId = this.activeRequestId;
      if (!requestId) {
        const requestSummary = this.details.trim() || `Solicitud para ${this.appointmentKind.toLowerCase()}`;
        const { data: requestRow, error: requestError } = await this.supabase.client
          .from('care_requests')
          .insert({
            employee_id: user.id,
            channel: this.appointmentKind,
            topic: this.topic,
            details: requestSummary,
          })
          .select('id')
          .single();

        if (requestError) throw requestError;
        requestId = requestRow.id as string;
        this.activeRequestId = requestId;
        this.activeRequestChannel = this.appointmentKind;
      }

      const { data: appointmentRow, error } = await this.supabase.client
        .from('appointments')
        .insert({
          request_id: requestId,
          employee_id: user.id,
          expert_id: null,
          kind: this.appointmentKind,
          scheduled_for: scheduledFor.toISOString(),
          notes: this.appointmentNotes.trim() || this.details.trim() || null,
          created_by: user.id,
        })
        .select('id')
        .single<{ id: string }>();
      if (error) throw error;

      if (this.appointmentKind === 'Videollamada' && appointmentRow?.id) {
        const { error: meetingError } = await this.createGoogleMeetForAppointment(appointmentRow.id);
        if (meetingError) {
          alert(`La cita se creó, pero no se pudo generar el enlace de Google Meet. ${meetingError}`);
        }
      }

      this.appointmentDate = '';
      this.appointmentTime = '';
      this.appointmentNotes = '';
      await this.loadEmployeeAppointments();
      if (requestId) {
        await this.openRequest(requestId);
      }
    } catch (err: any) {
      alert(err?.message ?? 'No se pudo agendar la hora.');
    } finally {
      this.loading = false;
    }
  }

  public selectAppointmentTime(slot: string): void {
    this.appointmentTime = slot;
  }

  public openMeeting(appointment: AppointmentRow): void {
    if (!appointment.meeting_url) return;
    window.open(appointment.meeting_url, '_blank', 'noopener,noreferrer');
  }

  public advisorSummaryValue(field: 'channel' | 'topic' | 'details' | 'date' | 'time'): string {
    switch (field) {
      case 'channel':
        return this.channel;
      case 'topic':
        return this.topic;
      case 'details':
        return this.details.trim() || 'Sin contexto adicional por ahora.';
      case 'date':
        return this.appointmentDate || 'No seleccionado';
      case 'time':
        return this.appointmentTime || 'No seleccionado';
      default:
        return '';
    }
  }

  public async sendMessage(): Promise<void> {
    const requestId = this.activeRequestId;
    if (!requestId) return;
    if (!this.expertMode && !this.ensureBenefitAccess()) return;

    const user = this.auth.user;
    if (!user) {
      await this.router.navigateByUrl('/login');
      return;
    }

    const body = this.messageDraft.trim();
    if (!body) return;

    this.messageDraft = '';
    this.showQuickReplies = false;
    this.showAttachmentMenu = false;

    if (this.expertMode && this.composerMode === 'internal') {
      await this.insertInternalNote(requestId, body, user.id);
      return;
    }

    const optimisticMessage: CareMessage = {
      id: `tmp-${Date.now()}`,
      body,
      created_at: new Date().toISOString(),
      sender_id: user.id,
      sender_name: 'Tú',
      kind: 'client',
    };

    this.messages = [...this.messages, optimisticMessage];

    const { data, error } = await this.supabase.client
      .from('care_messages')
      .insert({
        request_id: requestId,
        sender_id: user.id,
        body,
      })
      .select('id, body, created_at, sender_id')
      .single();

    if (error) {
      this.messages = this.messages.filter((message) => message.id !== optimisticMessage.id);
      alert(error.message);
      return;
    }

    this.messages = this.messages.map((message) =>
      message.id === optimisticMessage.id ? { ...(data as CareMessage), sender_name: 'Tú', kind: 'client' } : message
    );
  }

  public isOwnMessage(senderId: string): boolean {
    return senderId === this.auth.user?.id;
  }

  public isInternalMessage(message: CareMessage): boolean {
    return message.kind === 'internal';
  }

  public messageAuthorLabel(message: CareMessage): string {
    if (message.kind === 'internal') return 'Nota interna';
    if (this.isOwnMessage(message.sender_id)) return 'Tú';
    if (message.sender_name?.trim()) return message.sender_name;
    if (this.selectedRequest?.employee_name?.trim() && message.sender_id === this.selectedRequest.employee_id) {
      return this.selectedRequest.employee_name;
    }
    return 'Colaborador';
  }

  public statusLabel(status: string): string {
    switch (status) {
      case 'open':
        return 'Abierto';
      case 'assigned':
        return 'Asignado';
      case 'in_progress':
        return 'En progreso';
      case 'resolved':
        return 'Resuelto';
      case 'closed':
        return 'Cerrado';
      default:
        return status;
    }
  }

  public memberRoleLabel(value: string | null | undefined): string {
    switch (value) {
      case 'hr_admin':
        return 'RR.HH.';
      case 'manager':
        return 'Manager';
      case 'employee':
        return 'Empleado';
      case 'company_admin':
        return 'Administrador empresa';
      default:
        return value || 'No informado';
    }
  }

  public setExpertFilter(filter: ExpertFilter): void {
    this.expertActiveFilter = filter;
  }

  public toggleExpertMenu(): void {
    this.showExpertMenu = !this.showExpertMenu;
  }

  public async setAvailability(state: ExpertAvailability): Promise<void> {
    const userId = this.auth.user?.id;
    if (!userId) return;

    this.availability = state;

    const { error } = await this.supabase.client
      .from('expert_presence')
      .upsert({
        expert_id: userId,
        status: state,
      })
      .select('expert_id')
      .maybeSingle();

    if (error) {
      alert(error.message);
    }
  }

  public async updateAppointmentStatus(appointment: AppointmentRow, status: AppointmentStatus): Promise<void> {
    const { error } = await this.supabase.client.from('appointments').update({ status }).eq('id', appointment.id);
    if (error) {
      alert(error.message);
      return;
    }

    appointment.status = status;
    if (this.expertMode) {
      await this.loadSelectedAppointments();
      return;
    }

    await this.loadEmployeeAppointments();
  }

  public expertAvailabilityLabel(): string {
    switch (this.availability) {
      case 'busy':
        return 'Ocupado';
      case 'away':
        return 'Ausente';
      default:
        return 'Online';
    }
  }

  public slaLabel(request: ExpertRequest): string {
    const hours = Math.max(0, Math.floor((Date.now() - new Date(request.updated_at || request.created_at).getTime()) / 3600000));
    if (hours < 1) return 'Ahora';
    if (hours < 24) return `Hace ${hours}h`;
    return `Hace ${Math.floor(hours / 24)}d`;
  }

  public slaClass(request: ExpertRequest): string {
    const hours = Math.max(0, (Date.now() - new Date(request.updated_at || request.created_at).getTime()) / 3600000);
    if (hours >= 24) return 'is-critical';
    if (hours >= 6) return 'is-warning';
    return 'is-good';
  }

  public async toggleTag(tag: string): Promise<void> {
    const request = this.selectedRequest;
    const userId = this.auth.user?.id;
    if (!request || !userId) return;

    const alreadySelected = this.selectedTags.includes(tag);
    const next = alreadySelected
      ? this.selectedTags.filter((item) => item !== tag)
      : [...this.selectedTags, tag];

    this.selectedTags = next;

    if (alreadySelected) {
      const { error } = await this.supabase.client
        .from('care_request_tags')
        .delete()
        .eq('request_id', request.id)
        .eq('tag', tag);
      if (error) alert(error.message);
      return;
    }

    const { error } = await this.supabase.client.from('care_request_tags').insert({
      request_id: request.id,
      tag,
      created_by: userId,
    });
    if (error) alert(error.message);
  }

  public insertQuickReply(body: string): void {
    this.messageDraft = body;
    this.composerMode = 'client';
    this.showQuickReplies = false;
  }

  public insertAttachmentTemplate(body: string): void {
    this.messageDraft = body;
    this.showAttachmentMenu = false;
  }

  public get expertFilteredItems(): ExpertRequest[] {
    const term = this.searchTerm.trim().toLowerCase();
    return this.expertRequests
      .filter((request) => {
        const matchesTerm =
          !term ||
          request.topic.toLowerCase().includes(term) ||
          (request.employee_name ?? '').toLowerCase().includes(term) ||
          (request.employee_email ?? '').toLowerCase().includes(term);

        if (!matchesTerm) return false;

        switch (this.expertActiveFilter) {
          case 'mine':
            return request.assigned_expert_id === this.auth.user?.id;
          case 'open':
            return request.status === 'open';
          case 'unread':
            return request.status === 'open' && request.assigned_expert_id !== this.auth.user?.id;
          default:
            return true;
        }
      })
      .sort((left, right) => {
        const leftAttention = this.requestNeedsAttention(left) ? 1 : 0;
        const rightAttention = this.requestNeedsAttention(right) ? 1 : 0;
        if (leftAttention !== rightAttention) return rightAttention - leftAttention;

        return new Date(right.updated_at || right.created_at).getTime() - new Date(left.updated_at || left.created_at).getTime();
      });
  }

  public async selectRequest(request: ExpertRequest): Promise<void> {
    this.selectedRequest = request;
    this.activeRequestId = request.id;
    this.activeRequestChannel = request.channel;
    this.statusDraft = request.status;
    this.channel = request.channel;
    this.topic = request.topic;
    this.composerMode = 'client';
    this.showQuickReplies = false;
    this.showAttachmentMenu = false;
    await this.loadMessages();
    await this.setupRealtime();
    await this.loadSelectedContext();
    await this.loadSelectedAppointments();
  }

  public async claimSelectedRequest(): Promise<void> {
    const request = this.selectedRequest;
    const userId = this.auth.user?.id;
    if (!request || !userId) return;

    this.loading = true;
    try {
      const { error } = await this.supabase.client
        .from('care_requests')
        .update({ assigned_expert_id: userId, status: request.status === 'open' ? 'assigned' : request.status })
        .eq('id', request.id);
      if (error) throw error;

      await this.supabase.client
        .from('appointments')
        .update({ expert_id: userId })
        .eq('request_id', request.id)
        .is('expert_id', null);

      await this.loadExpertRequests(request.id);
    } catch (err: any) {
      alert(err?.message ?? 'No se pudo tomar el caso.');
    } finally {
      this.loading = false;
    }
  }

  public async saveSelectedStatus(): Promise<void> {
    const request = this.selectedRequest;
    if (!request) return;

    this.loading = true;
    try {
      const { error } = await this.supabase.client
        .from('care_requests')
        .update({ status: this.statusDraft })
        .eq('id', request.id);
      if (error) throw error;

      await this.loadExpertRequests(request.id);
    } catch (err: any) {
      alert(err?.message ?? 'No se pudo actualizar el estado.');
    } finally {
      this.loading = false;
    }
  }

  private canAdvanceFromCurrentStep(): boolean {
    if (this.advisorStep === 1) {
      return true;
    }

    if (this.advisorStep === 2 && this.channel === 'Chat' && !this.details.trim()) {
      alert('Cuéntanos brevemente tu situación antes de continuar.');
      return false;
    }

    if (this.advisorStep === 2 && this.canScheduleAppointment && (!this.appointmentDate || !this.appointmentTime)) {
      alert('Selecciona día y hora para continuar con la reserva.');
      return false;
    }

    return true;
  }

  private async bootstrap(): Promise<void> {
    this.loading = true;
    const { data: sessionData } = await this.supabase.client.auth.getSession();

    try {
      const role = await this.auth.getCurrentProfileRole();
      this.profileRole = role;
      if (!role || !this.allowedRoles.includes(role)) {
        await this.router.navigateByUrl('/company');
        return;
      }

      this.expertMode = role === 'pet_expert' || role === 'admin';
      if (this.expertMode) {
        this.hasBenefitAccess = true;
        await this.loadExpertPresence();
        await this.loadExpertRequests();
        this.loading = false;
        return;
      }

      this.hasBenefitAccess = await this.loadCurrentUserBenefitAccess(sessionData?.session?.user?.id ?? null);
      if (!this.hasBenefitAccess) {
        alert('Tu empresa necesita una suscripcion activa para solicitar Pet Experts.');
        await this.router.navigateByUrl('/dashboard');
        return;
      }
    } catch {
      await this.router.navigateByUrl('/home');
      return;
    }

    await this.loadEmployeeAppointments();
    await this.loadEmployeeTasks();

    let isInitialRender = true;
    this.route.queryParamMap.subscribe((params) => {
      const requestId = params.get('request');
      if (!requestId || requestId === this.activeRequestId) {
        if (isInitialRender) {
          this.loading = false;
          isInitialRender = false;
        }
        return;
      }
      isInitialRender = false;
      void this.openRequest(requestId);
    });
  }

  private ensureBenefitAccess(): boolean {
    if (this.hasBenefitAccess) return true;
    alert('Tu empresa necesita una suscripcion activa para usar Pet Experts.');
    return false;
  }

  private async loadCurrentUserBenefitAccess(userId: string | null): Promise<boolean> {
    if (!userId) return false;

    const { data: membership, error: membershipError } = await this.supabase.client
      .from('company_members')
      .select('company_id')
      .eq('user_id', userId)
      .maybeSingle();

    if (membershipError || !membership?.company_id) return false;

    const { data, error } = await this.supabase.client.rpc('can_company_use_benefits', {
      target_company_id: membership.company_id,
    });

    if (error) return false;
    return data === true;
  }

  private async openRequest(requestId: string): Promise<void> {
    if (!this.expertMode && !this.ensureBenefitAccess()) return;
    this.loading = true;
    try {
      const { data, error } = await this.supabase.client
        .from('care_requests')
        .select('id, channel, topic')
        .eq('id', requestId)
        .maybeSingle();

      if (error) throw error;
      if (!data?.id) throw new Error('No se encontró la solicitud.');

      this.activeRequestId = data.id as string;
      this.activeRequestChannel = (data.channel as SupportChannel) ?? 'Chat';
      this.channel = (data.channel as SupportChannel) ?? 'Chat';
      this.topic = (data.topic as string) ?? this.topic;

      await this.loadMessages();
      await this.setupRealtime();
      await this.loadEmployeeAppointments();
      await this.loadEmployeeTasks();
    } catch (err: any) {
      console.error(err);
      alert(err?.message ?? 'No se pudo abrir el chat.');
    } finally {
      this.loading = false;
    }
  }

  private async loadMessages(): Promise<void> {
    const requestId = this.activeRequestId;
    if (!requestId) return;

    const { data, error } = await this.supabase.client
      .from('care_messages')
      .select('id, body, created_at, sender_id')
      .eq('request_id', requestId)
      .order('created_at', { ascending: true });

    if (error) throw error;

    const messages = (data ?? []) as CareMessage[];
    const senderIds = Array.from(new Set(messages.map((message) => message.sender_id).filter(Boolean)));

    let senderNames = new Map<string, string | null>();
    if (senderIds.length) {
      const { data: profiles, error: profilesError } = await this.supabase.client
        .from('profiles')
        .select('id, full_name, email')
        .in('id', senderIds);

      if (profilesError) throw profilesError;

      senderNames = new Map(
        (profiles ?? []).map((profile: any) => [
          profile.id as string,
          ((profile.full_name as string | null | undefined) ?? (profile.email as string | null | undefined) ?? null),
        ])
      );
    }

    const dbMessages = messages.map((message) => ({
      ...message,
      sender_name: senderNames.get(message.sender_id) ?? null,
      kind: 'client' as const,
    }));

    if (!this.expertMode) {
      this.messages = dbMessages;
      return;
    }

    const { data: internalNotes, error: internalNotesError } = await this.supabase.client
      .from('internal_notes')
      .select('id, body, created_at, author_id')
      .eq('request_id', requestId)
      .order('created_at', { ascending: true });

    if (internalNotesError) throw internalNotesError;

    const notes = (internalNotes ?? []).map((note: any) => ({
      id: note.id as string,
      body: note.body as string,
      created_at: note.created_at as string,
      sender_id: note.author_id as string,
      sender_name: 'Nota interna',
      kind: 'internal' as const,
    }));

    this.messages = [...dbMessages, ...notes].sort(
      (left, right) => new Date(left.created_at).getTime() - new Date(right.created_at).getTime()
    );
  }

  private async loadEmployeeAppointments(): Promise<void> {
    const userId = this.auth.user?.id;
    if (!userId) return;

    const { data, error } = await this.supabase.client
      .from('appointments')
      .select(
        'id, request_id, employee_id, expert_id, kind, scheduled_for, notes, status, created_at, meeting_provider, meeting_url, meeting_code, meeting_space_name'
      )
      .eq('employee_id', userId)
      .order('scheduled_for', { ascending: true })
      .limit(6);

    if (error) {
      this.employeeAppointments = [];
      return;
    }

    this.employeeAppointments = (data ?? []) as AppointmentRow[];
  }

  private async loadEmployeeTasks(): Promise<void> {
    const userId = this.auth.user?.id;
    if (!userId) {
      this.employeeTasks = [];
      return;
    }

    const { data, error } = await this.supabase.client
      .from('care_tasks')
      .select('id, request_id, employee_id, created_by, title, notes, due_at, priority, status, created_at')
      .eq('employee_id', userId)
      .order('created_at', { ascending: true });

    if (error) {
      this.employeeTasks = [];
      return;
    }

    this.employeeTasks = (data ?? []) as CareTaskRow[];
  }

  private async loadSelectedAppointments(): Promise<void> {
    const request = this.selectedRequest;
    if (!request) {
      this.selectedAppointments = [];
      return;
    }

    const { data, error } = await this.supabase.client
      .from('appointments')
      .select(
        'id, request_id, employee_id, expert_id, kind, scheduled_for, notes, status, created_at, meeting_provider, meeting_url, meeting_code, meeting_space_name'
      )
      .eq('request_id', request.id)
      .order('scheduled_for', { ascending: true })
      .limit(6);

    if (error) {
      this.selectedAppointments = [];
      return;
    }

    this.selectedAppointments = (data ?? []) as AppointmentRow[];
  }

  private async loadExpertRequests(preferredRequestId?: string): Promise<void> {
    const { data: requests, error } = await this.supabase.client
      .from('care_requests')
      .select('id, topic, channel, status, created_at, updated_at, details, employee_id, assigned_expert_id')
      .order('created_at', { ascending: false })
      .limit(20);

    if (error) throw error;

    const requestIds = (requests ?? []).map((request: any) => request.id as string).filter(Boolean);

    const employeeIds = Array.from(
      new Set((requests ?? []).map((request: any) => request.employee_id as string).filter(Boolean))
    );

    let profilesById = new Map<string, { full_name: string | null; email: string | null }>();
    if (employeeIds.length) {
      const { data: profiles, error: profilesError } = await this.supabase.client
        .from('profiles')
        .select('id, full_name, email')
        .in('id', employeeIds);
      if (profilesError) throw profilesError;

      profilesById = new Map(
        (profiles ?? []).map((profile: any) => [
          profile.id as string,
          {
            full_name: profile.full_name ?? null,
            email: profile.email ?? null,
          },
        ])
      );
    }

    let overdueAppointmentsByRequestId: Record<string, number> = {};
    let overdueTasksByRequestId: Record<string, number> = {};

    if (requestIds.length) {
      const [appointmentsResult, tasksResult] = await Promise.all([
        this.supabase.client
          .from('appointments')
          .select('request_id, scheduled_for, status')
          .in('request_id', requestIds),
        this.supabase.client
          .from('care_tasks')
          .select('request_id, due_at, status')
          .in('request_id', requestIds),
      ]);

      if (appointmentsResult.error) throw appointmentsResult.error;
      if (tasksResult.error) throw tasksResult.error;

      overdueAppointmentsByRequestId = ((appointmentsResult.data ?? []) as Array<{
        request_id: string | null;
        scheduled_for: string;
        status: AppointmentStatus;
      }>).reduce<Record<string, number>>((acc, appointment) => {
        if (!appointment.request_id) return acc;
        const isActive = appointment.status === 'scheduled' || appointment.status === 'confirmed';
        const isOverdue = new Date(appointment.scheduled_for).getTime() < Date.now();
        if (isActive && isOverdue) {
          acc[appointment.request_id] = (acc[appointment.request_id] ?? 0) + 1;
        }
        return acc;
      }, {});

      overdueTasksByRequestId = ((tasksResult.data ?? []) as Array<{
        request_id: string | null;
        due_at: string | null;
        status: CareTaskStatus;
      }>).reduce<Record<string, number>>((acc, task) => {
        if (!task.request_id || !task.due_at || task.status === 'done') return acc;
        const isOverdue = new Date(task.due_at).getTime() < Date.now();
        if (isOverdue) {
          acc[task.request_id] = (acc[task.request_id] ?? 0) + 1;
        }
        return acc;
      }, {});
    }

    this.overdueAppointmentsByRequestId = overdueAppointmentsByRequestId;
    this.overdueTasksByRequestId = overdueTasksByRequestId;

    this.expertRequests = (requests ?? []).map((request: any) => {
      const profile = profilesById.get(request.employee_id as string);
      return {
        id: request.id as string,
        topic: request.topic as string,
        channel: request.channel as SupportChannel,
        status: request.status as CareRequestStatus,
        created_at: request.created_at as string,
        updated_at: request.updated_at as string,
        details: (request.details as string | null | undefined) ?? null,
        employee_id: request.employee_id as string,
        assigned_expert_id: (request.assigned_expert_id as string | null | undefined) ?? null,
        employee_name: profile?.full_name ?? null,
        employee_email: profile?.email ?? null,
      };
    });

    await this.computeExpertMetrics();

    const nextRequest =
      this.expertRequests.find((request) => request.id === preferredRequestId) ??
      this.expertRequests.find((request) => request.id === this.selectedRequest?.id) ??
      this.expertRequests[0] ??
      null;

    this.selectedRequest = nextRequest;
    this.activeRequestId = nextRequest?.id ?? null;
    this.activeRequestChannel = nextRequest?.channel ?? null;
    this.statusDraft = nextRequest?.status ?? 'open';

    if (nextRequest) {
      this.channel = nextRequest.channel;
      this.topic = nextRequest.topic;
      await this.loadMessages();
      await this.setupRealtime();
      await this.loadSelectedContext();
      await this.loadSelectedAppointments();
    } else {
      this.messages = [];
      this.selectedCollaborator = null;
      this.selectedHistory = [];
      this.selectedTags = [];
      this.selectedAppointments = [];
      this.activeRequestChannel = null;
      await this.teardownRealtime();
    }
  }

  private async setupRealtime(): Promise<void> {
    const requestId = this.activeRequestId;
    if (!requestId) return;

    await this.teardownRealtime();

    this.realtimeChannel = this.supabase.client
      .channel(`care_messages:${requestId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'care_messages',
          filter: `request_id=eq.${requestId}`,
        },
        (payload: any) => {
          const row = payload?.new as CareMessage | undefined;
          if (!row?.id) return;
          if (this.messages.some((message) => message.id === row.id)) return;
          this.messages = [
            ...this.messages,
            {
              ...row,
              sender_name:
                this.selectedRequest?.employee_id === row.sender_id ? this.selectedRequest.employee_name : null,
              kind: 'client',
            },
          ];
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'internal_notes',
          filter: `request_id=eq.${requestId}`,
        },
        (payload: any) => {
          const row = payload?.new as { id: string; body: string; created_at: string; author_id: string } | undefined;
          if (!row?.id) return;
          if (this.messages.some((message) => message.id === row.id)) return;
          this.messages = [
            ...this.messages,
            {
              id: row.id,
              body: row.body,
              created_at: row.created_at,
              sender_id: row.author_id,
              sender_name: 'Nota interna',
              kind: 'internal',
            },
          ];
        }
      )
      .subscribe();
  }

  private async teardownRealtime(): Promise<void> {
    if (!this.realtimeChannel) return;
    try {
      await this.supabase.client.removeChannel(this.realtimeChannel);
    } catch {
      // ignore
    } finally {
      this.realtimeChannel = null;
    }
  }

  private async computeExpertMetrics(): Promise<void> {
    const today = new Date().toDateString();
    this.resolvedToday = this.expertRequests.filter(
      (request) => request.status === 'resolved' && new Date(request.updated_at).toDateString() === today
    ).length;

    const requestIds = this.expertRequests.map((request) => request.id);
    if (!requestIds.length) {
      this.averageResponseMinutes = 0;
      return;
    }

    const { data, error } = await this.supabase.client
      .from('care_messages')
      .select('request_id, sender_id, created_at')
      .in('request_id', requestIds)
      .order('created_at', { ascending: true });

    if (error) {
      this.averageResponseMinutes = 0;
      return;
    }

    const requestMap = new Map(this.expertRequests.map((request) => [request.id, request]));
    const grouped = new Map<string, Array<{ sender_id: string; created_at: string }>>();

    for (const row of data ?? []) {
      const requestId = row.request_id as string;
      const current = grouped.get(requestId) ?? [];
      current.push({
        sender_id: row.sender_id as string,
        created_at: row.created_at as string,
      });
      grouped.set(requestId, current);
    }

    const minutes: number[] = [];
    grouped.forEach((rows, requestId) => {
      const request = requestMap.get(requestId);
      if (!request) return;
      const firstEmployeeMessage = rows.find((row) => row.sender_id === request.employee_id);
      const firstExpertMessage = rows.find((row) => row.sender_id !== request.employee_id);
      if (!firstEmployeeMessage || !firstExpertMessage) return;

      const diff =
        new Date(firstExpertMessage.created_at).getTime() - new Date(firstEmployeeMessage.created_at).getTime();
      if (diff >= 0) minutes.push(Math.round(diff / 60000));
    });

    this.averageResponseMinutes = minutes.length
      ? Math.round(minutes.reduce((sum, value) => sum + value, 0) / minutes.length)
      : 0;
  }

  private async loadSelectedContext(): Promise<void> {
    const request = this.selectedRequest;
    if (!request) return;

    this.selectedHistory = this.expertRequests
      .filter((item) => item.employee_id === request.employee_id && item.id !== request.id)
      .slice(0, 4);

    const { data: tags } = await this.supabase.client
      .from('care_request_tags')
      .select('tag')
      .eq('request_id', request.id)
      .order('created_at', { ascending: true });
    this.selectedTags = (tags ?? []).map((item: any) => item.tag as string);

    let company: string | null = null;
    let memberRole: string | null = null;
    let location: string | null = null;
    let familyAge: string | null = null;
    let relation: string | null = null;
    let condition: string | null = null;
    let dependencyLevel: string | null = null;
    let preferredContact: string | null = null;
    let supportNetwork: string | null = null;

    const { data: profile } = await this.supabase.client
      .from('profiles')
      .select('full_name, email, company, role')
      .eq('id', request.employee_id)
      .maybeSingle();

    company = (profile?.company as string | undefined) ?? null;
    memberRole = (profile?.role as string | undefined) ?? null;

    try {
      const { data: membership } = await this.supabase.client
        .from('company_members')
        .select('member_role, companies:companies(name)')
        .eq('user_id', request.employee_id)
        .maybeSingle();

      const companyRow = Array.isArray((membership as any)?.companies)
        ? (membership as any).companies[0]
        : (membership as any)?.companies;
      company = (companyRow?.name as string | undefined) ?? company;
      memberRole = ((membership as any)?.member_role as string | undefined) ?? memberRole;
    } catch {
      // ignore
    }

    try {
      const { data: intake } = await this.supabase.client
        .from('care_intakes')
        .select('payload')
        .eq('employee_id', request.employee_id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      const payload = (intake?.payload as any) ?? null;
      location = this.readPayloadValue(payload, [
        ['location', 'postal_code'],
        ['location', 'comuna'],
        ['location', 'city'],
        ['location', 'address'],
      ]);
      familyAge = this.readPayloadValue(payload, [
        ['family', 'age'],
        ['relative', 'age'],
        ['care_receiver', 'age'],
        ['dependent', 'age'],
      ]);
      relation = this.readPayloadValue(payload, [['caregiver', 'relation'], ['family', 'relation']]);
      condition = this.readPayloadValue(payload, [['care_receiver', 'primary_condition'], ['clinical_profile']]);
      dependencyLevel = this.readPayloadValue(payload, [['care_receiver', 'dependency_level']]);
      preferredContact = this.readPayloadValue(payload, [['preferences', 'preferred_contact']]);
      supportNetwork = this.readPayloadValue(payload, [['family_context', 'support_network']]);
    } catch {
      // ignore
    }

    this.selectedCollaborator = {
      fullName: request.employee_name ?? (profile?.full_name as string | undefined) ?? null,
      email: request.employee_email ?? (profile?.email as string | undefined) ?? null,
      company,
      memberRole,
      location,
      familyAge,
      relation,
      condition,
      dependencyLevel,
      preferredContact,
      supportNetwork,
    };
  }

  private readPayloadValue(payload: any, candidates: string[][]): string | null {
    if (!payload || typeof payload !== 'object') return null;
    for (const path of candidates) {
      let current = payload;
      for (const segment of path) current = current?.[segment];
      if (current !== null && current !== undefined && `${current}`.trim()) {
        return `${current}`;
      }
    }
    return null;
  }

  private async loadExpertPresence(): Promise<void> {
    const userId = this.auth.user?.id;
    if (!userId) return;

    const { data, error } = await this.supabase.client
      .from('expert_presence')
      .select('status')
      .eq('expert_id', userId)
      .maybeSingle();

    if (error) return;
    this.availability = ((data?.status as ExpertAvailability | undefined) ?? 'online');
  }

  private async insertInternalNote(requestId: string, body: string, authorId: string): Promise<void> {
    const optimisticNote: CareMessage = {
      id: `note-${Date.now()}`,
      body,
      created_at: new Date().toISOString(),
      sender_id: authorId,
      sender_name: 'Nota interna',
      kind: 'internal',
    };

    this.messages = [...this.messages, optimisticNote].sort(
      (left, right) => new Date(left.created_at).getTime() - new Date(right.created_at).getTime()
    );

    const { data, error } = await this.supabase.client
      .from('internal_notes')
      .insert({
        request_id: requestId,
        author_id: authorId,
        body,
      })
      .select('id, body, created_at, author_id')
      .single();

    if (error) {
      this.messages = this.messages.filter((message) => message.id !== optimisticNote.id);
      alert(error.message);
      return;
    }

    this.messages = this.messages.map((message) =>
      message.id === optimisticNote.id
        ? {
            id: data.id as string,
            body: data.body as string,
            created_at: data.created_at as string,
            sender_id: data.author_id as string,
            sender_name: 'Nota interna',
            kind: 'internal',
          }
        : message
    );
  }

  private async createGoogleMeetForAppointment(appointmentId: string): Promise<{ error: string | null }> {
    const session = await this.supabase.client.auth.getSession();
    const accessToken = session.data.session?.access_token;

    if (!accessToken) {
      return { error: 'Tu sesión expiró. Vuelve a iniciar sesión e inténtalo otra vez.' };
    }

    const { data, error } = await this.supabase.client.functions.invoke(
      'create-google-meet',
      {
        body: { appointmentId },
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    if (error) {
      const context = (error as any).context;

      if (context instanceof Response) {
        try {
          const payload = await context.json();
          if (payload?.error) {
            return { error: String(payload.error) };
          }
        } catch {
          try {
            const text = await context.text();
            if (text.trim()) {
              return { error: text };
            }
          } catch {
            // ignore secondary parsing errors
          }
        }
      }

      if (error.message === 'Failed to send a request to the Edge Function') {
        return {
          error:
            'No se pudo conectar con la Edge Function. Verifica que `create-google-meet` esté desplegada y que la configuración CORS/JWT actualizada ya esté publicada en Supabase.',
        };
      }

      return { error: error.message };
    }

    if ((data as any)?.error) {
      return { error: String((data as any).error) };
    }

    return { error: null };
  }
}
