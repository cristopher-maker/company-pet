import { Component, Input, OnInit, OnDestroy } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { SupabaseService } from '../../core/services/supabase.service';
import { AuthService } from '../../core/services/auth.service';
import { CdkDragDrop, moveItemInArray, transferArrayItem } from '@angular/cdk/drag-drop';
import { ChartConfiguration } from 'chart.js';

type LeadStatus = 'nuevo' | 'contactado' | 'evaluacion' | 'match' | 'cerrado' | 'perdido';
type ConfigSection = 'company' | 'appearance' | 'workflow' | 'business' | 'documents' | 'messages';
type DashboardView = 'metricas' | 'sedes' | 'camas' | 'pacientes' | 'admisiones' | 'tareas' | 'empleados' | 'vouchers' | 'config' | 'facturacion' | 'gastos';
type SummaryTone = 'primary' | 'blue' | 'green' | 'warn' | 'danger' | 'neutral';
type DashboardNavItem = { view: DashboardView; label: string; icon: string; locked?: boolean };
type ToastTone = 'info' | 'success' | 'warning' | 'error';
type DashboardToast = { id: number; tone: ToastTone; message: string };

@Component({
  selector: 'app-admin-dashboard',
  templateUrl: './admin-dashboard.component.html',
  styleUrl: './admin-dashboard.component.scss'
})
export class AdminDashboardComponent implements OnInit, OnDestroy {
  @Input() hideWorkflowConfig = false;
  @Input() companyConfigMode = false;

  // Controla qu tabla/vista se est mostrando actualmente
  currentView: DashboardView = 'metricas';
  mobileNavOpen = false;
  toasts: DashboardToast[] = [];
  confirmState = {
    open: false,
    title: 'Confirmar accion',
    message: '',
    tone: 'warning' as ToastTone,
    confirmLabel: 'Confirmar',
    cancelLabel: 'Cancelar'
  };

  loading = true;
  hasLoadedOnce = false;
  profileRole: string | null = null;
  hasActivePlan = false;
  activePlanTier: string | null = null;

  // Variables de Modal y Formulario
  companyId: string | null = null;
  showSedeModal = false;
  showCamaModal = false;
  showPacienteModal = false;
  showLeadModal = false;
  showLeadDetailModal = false;
  showTareaModal = false;
  savingSede = false;
  savingCama = false;
  savingPaciente = false;
  savingLead = false;
  loadingLeadDetail = false;
  savingTarea = false;
  savingGasto = false;
  showGastoModal = false;
  private toastCounter = 0;
  private readonly toastTimeouts = new Map<number, ReturnType<typeof setTimeout>>();
  private confirmResolver: ((value: boolean) => void) | null = null;

  readonly dashboardViewLabels: Record<DashboardView, string> = {
    metricas: 'M\u00e9tricas',
    sedes: 'Mis sedes',
    camas: 'Camas y vacantes',
    pacientes: 'Pacientes',
    admisiones: 'Admisiones',
    tareas: 'Tareas',
    empleados: 'Empleados',
    vouchers: 'Vouchers',
    config: 'Configuraci\u00f3n',
    facturacion: 'Facturaci\u00f3n',
    gastos: 'Gastos y finanzas'
  };

  readonly mobileNavSections: Array<{ label: string; items: DashboardNavItem[] }> = [
    {
      label: 'Gesti\u00f3n',
      items: [
        { view: 'metricas', label: 'M\u00e9tricas', icon: 'monitoring' },
        { view: 'admisiones', label: 'Admisiones', icon: 'view_kanban', locked: true },
        { view: 'tareas', label: 'Tareas', icon: 'checklist', locked: true },
        { view: 'sedes', label: 'Mis sedes', icon: 'business', locked: true },
        { view: 'camas', label: 'Camas y vacantes', icon: 'bed', locked: true },
        { view: 'pacientes', label: 'Pacientes', icon: 'people', locked: true },
        { view: 'facturacion', label: 'Facturaci\u00f3n', icon: 'receipt_long', locked: true },
        { view: 'gastos', label: 'Gastos y finanzas', icon: 'account_balance_wallet', locked: true }
      ]
    },
    {
      label: 'Configuraci\u00f3n',
      items: [
        { view: 'empleados', label: 'Empleados', icon: 'badge', locked: true },
        { view: 'vouchers', label: 'Vouchers', icon: 'local_activity', locked: true },
        { view: 'config', label: 'Configuraci\u00f3n', icon: 'settings' }
      ]
    }
  ];

  // Modal de Historial de Cobros
  showInvoicesModal = false;
  selectedPatientInvoices: any[] = [];
  selectedPatientForInvoices: any = null;
  selectedLead: any = null;
  selectedLeadIntake: any = null;

  sedeDraft: any = { id: null, nombre: '', ubicacion: '' };
  camaDraft: any = { db_id: null, resource_code: '', provider_id: '', care_type: 'Basico', status: 'Disponible', notes: '' };
  pacienteDraft: any = { id: null, first_name: '', last_name: '', document_id: '', emergency_contact_name: '', emergency_contact_phone: '', resource_id: null, monthly_fee: null, guarantor_name: '', guarantor_document_id: '', guarantor_email: '' };
  leadDraft: any = { id: null, nombre: '', comuna: '', dependencia: '', presupuesto: null };
  tareaDraft: any = {
    id: null,
    title: '',
    employee_id: null,
    due_at: null,
    status: 'pending',
    priority: 'medium',
    entity_type: null,
    entity_id: null,
    entity_label: ''
  };
  gastoDraft: any = { id: null, category: 'Operativos', amount: null, expense_date: '', description: '' };
  rawProviders: any[] = [];
  leads: any[] = [];
  pacientes: any[] = [];
  patientContracts: any[] = [];
  patientInvoices: any[] = [];
  gastos: any[] = [];
  private readonly planLockedViews = new Set<DashboardView>([
    'sedes',
    'camas',
    'pacientes',
    'admisiones',
    'tareas',
    'empleados',
    'vouchers',
    'facturacion',
    'gastos'
  ]);

  // Estadsticas generales
  totalSedes = 0;
  camasTotales = 0;
  camasOcupadas = 0;
  camasDisponibles = 0;
  camasEnMantenimiento = 0;
  porcentajeOcupacion = 0;

  // Configuracion del grafico de ocupacion
  public doughnutChartLabels: string[] = ['Ocupadas', 'Disponibles', 'En mantenimiento'];
  public doughnutChartDatasets: ChartConfiguration<'doughnut'>['data']['datasets'] = [
    { data: [0, 0, 0], backgroundColor: ['#3b82f6', '#22c55e', '#f59e0b'] }
  ];
  public doughnutChartOptions: ChartConfiguration<'doughnut'>['options'] = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: '70%',
    plugins: { legend: { position: 'bottom', labels: { boxWidth: 12, font: { size: 11, family: "'DM Sans', sans-serif" } } } }
  };

  // Configuracion del grafico de admisiones (Leads)
  totalLeads = 0;
  public barChartLabels: string[] = ['Nuevas', 'Contact.', 'Eval.', 'Propuesta', 'Cerrado', 'Perdido'];
  public barChartDatasets: ChartConfiguration<'bar'>['data']['datasets'] = [
    { data: [0, 0, 0, 0, 0, 0], backgroundColor: '#6366f1', borderRadius: 4 }
  ];
  public barChartOptions: ChartConfiguration<'bar'>['options'] = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: {
      y: { beginAtZero: true, ticks: { stepSize: 1, precision: 0 } },
      x: { grid: { display: false } }
    }
  };

  // Configuracion del grafico de tareas
  totalTareas = 0;
  totalIngresos = 0;
  totalGastos = 0;
  public tasksChartLabels: string[] = ['Pendientes', 'En progreso', 'Completadas'];
  public tasksChartDatasets: ChartConfiguration<'doughnut'>['data']['datasets'] = [
    { data: [0, 0, 0], backgroundColor: ['#f59e0b', '#3b82f6', '#22c55e'] }
  ];
  public tasksChartOptions: ChartConfiguration<'doughnut'>['options'] = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: '70%',
    plugins: {
      legend: {
        position: 'bottom',
        labels: { boxWidth: 12, font: { size: 11, family: "'DM Sans', sans-serif" } }
      }
    }
  };

  // Configuracion del grafico de gastos
  public expensesChartLabels: string[] = [];
  public expensesChartDatasets: ChartConfiguration<'doughnut'>['data']['datasets'] = [
    { data: [], backgroundColor: ['#ef4444', '#f97316', '#f59e0b', '#eab308', '#84cc16', '#22c55e', '#10b981'] }
  ];
  public expensesChartOptions: ChartConfiguration<'doughnut'>['options'] = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: '70%',
    plugins: {
      legend: {
        position: 'bottom',
        labels: { boxWidth: 12, font: { size: 11, family: "'DM Sans', sans-serif" } }
      }
    }
  };

  taskSummaryCards: Array<{ label: string; value: number; tone: 'warn' | 'blue' | 'green' | 'neutral' }> = [];
  operationalAlerts: Array<{ level: 'high' | 'medium' | 'info'; title: string; detail: string }> = [];
  selectedEntityType: 'lead' | 'sede' | 'cama' | 'paciente' | null = null;
  selectedEntityId: string | null = null;
  taskFilters = {
    query: '',
    status: 'all',
    entityType: 'all',
    priority: 'all'
  };
  leadFilters = {
    query: '',
    status: 'all',
    comuna: ''
  };
  configSearch = '';
  configSection: ConfigSection = 'appearance';
  configLoading = false;
  systemCategories: any[] = [];
  systemStatuses: any[] = [];
  emailTemplates: any[] = [];
  planSlas: any[] = [];
  businessParameters: any[] = [];
  companyDocuments: any[] = [];
  selectedDocumentFile: File | null = null;
  uploadingDocument = false;
  entityComments: any[] = [];
  onboardingProjects: any[] = [];
  onboardingSteps: any[] = [];
  companyInvitations: any[] = [];
  categoryDraft: any = { scope: 'task', name: '', color: '#f27a5e' };
  statusDraft: any = { scope: 'task', code: '', label: '', color: '#123c4a', is_terminal: false };
  emailTemplateDraft: any = { code: '', name: '', subject: '', body_html: '' };
  planSlaDraft: any = { plan_tier: '', request_response_hours: 24, task_due_hours: 72, escalation_hours: 96 };
  parameterDraft: any = { key: '', label: '', value: '', value_type: 'text', description: '' };
  documentDraft: any = { document_type: 'company_file', title: '', entity_type: 'company', storage_path: '' };
  commentDraft: any = { entity_type: 'company', entity_id: null, body: '', visibility: 'internal' };
  onboardingDraft: any = { title: 'Activacion de empresa', starts_at: null };
  onboardingStepDraft: any = { project_id: null, title: '', description: '', step_key: '' };
  brandingDraft: any = {
    logo_url: '',
    primary_color: '#123c4a',
    secondary_color: '#f27a5e',
    erp_primary_color: '#123c4a',
    erp_accent_color: '#f27a5e',
    erp_background_color: '#f8fafc',
    erp_surface_color: '#ffffff',
    erp_text_color: '#0f172a',
    erp_button_style: 'solid',
    erp_radius: 'compact',
    erp_density: 'comfortable',
    erp_font_family: 'dm_sans'
  };

  // Lista de sedes de la empresa actual
  sedes: any[] = [];

  // Lista de camas para la vista de "Camas y Vacantes"
  camasDetalle: any[] = [];

  // Lista de tareas y empleados para la vista "Tareas"
  tareas: any[] = [];
  empleados: any[] = [];

  // Actividad reciente
  recentActivity: any[] = [];
  taskHistory: any[] = [];

  get dashboardGreeting() {
    const hour = new Date().getHours();
    if (hour < 12) return 'Buenos d\u00edas';
    if (hour < 20) return 'Buenas tardes';
    return 'Buenas noches';
  }

  get currentViewLabel(): string {
    return this.dashboardViewLabels[this.currentView] || 'Dashboard';
  }

  get dashboardSummaryCards(): Array<{ label: string; value: string | number; detail: string; icon: string; tone: SummaryTone }> {
    const pendingTasks = this.tareas.filter((task) => task.status === 'pending').length;
    const openLeads = this.leads.filter((lead) => !['cerrado', 'perdido'].includes(lead.estado)).length;
    const activeAlerts = this.operationalAlerts.filter((alert) => alert.level !== 'info').length;

    return [
      {
        label: 'Admisiones abiertas',
        value: openLeads,
        detail: `${this.totalLeads} admisiones totales`,
        icon: 'view_kanban',
        tone: openLeads > 0 ? 'blue' : 'neutral'
      },
      {
        label: 'Tareas pendientes',
        value: pendingTasks,
        detail: `${this.tareas.filter((task) => task.status === 'in_progress').length} en progreso`,
        icon: 'checklist',
        tone: pendingTasks > 0 ? 'warn' : 'green'
      },
      {
        label: 'Camas libres',
        value: this.camasDisponibles,
        detail: this.camasTotales > 0 ? `${this.porcentajeOcupacion}% de ocupaci\u00f3n` : 'Sin camas registradas',
        icon: 'bed',
        tone: this.camasDisponibles === 0 && this.camasTotales > 0 ? 'danger' : 'primary'
      },
      {
        label: 'Alertas activas',
        value: activeAlerts,
        detail: activeAlerts > 0 ? 'Requieren revisi\u00f3n' : 'Sin alertas cr\u00edticas',
        icon: 'notification_important',
        tone: activeAlerts > 0 ? 'warn' : 'green'
      }
    ];
  }

  get dashboardActionItems(): Array<{ title: string; detail: string; icon: string; view: DashboardView; tone: SummaryTone }> {
    const now = new Date();
    const overdueTasks = this.tareas.filter((task) => task.due_at && task.status !== 'done' && new Date(task.due_at) < now).length;
    const newLeads = this.kanbanData['nuevo']?.length || 0;
    const items: Array<{ title: string; detail: string; icon: string; view: DashboardView; tone: SummaryTone }> = [];

    if (overdueTasks > 0) {
      items.push({ title: 'Resolver tareas vencidas', detail: `${overdueTasks} pendientes fuera de plazo`, icon: 'priority_high', view: 'tareas', tone: 'danger' });
    }
    if (newLeads > 0) {
      items.push({ title: 'Contactar admisiones nuevas', detail: `${newLeads} consultas esperan primer contacto`, icon: 'record_voice_over', view: 'admisiones', tone: 'blue' });
    }
    if (this.camasTotales > 0 && this.camasDisponibles <= 2) {
      items.push({ title: 'Revisar disponibilidad', detail: `${this.camasDisponibles} camas libres registradas`, icon: 'bed', view: 'camas', tone: this.camasDisponibles === 0 ? 'danger' : 'warn' });
    }
    return items.slice(0, 5);
  }

  get latestOperationalEvents(): Array<{ title: string; detail: string; icon: string; created_at: string }> {
    const taskEvents = this.tareas.slice(0, 3).map((task) => ({
      title: task.title || 'Tarea sin titulo',
      detail: this.statusLabel(task.status),
      icon: 'checklist',
      created_at: task.created_at
    }));
    const leadEvents = this.leads.slice(0, 3).map((lead) => ({
      title: lead.nombre || 'Admision sin nombre',
      detail: this.leadStatusLabel(lead.estado),
      icon: 'view_kanban',
      created_at: lead.created_at
    }));
    return [...taskEvents, ...leadEvents]
      .filter((event) => !!event.created_at)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 6);
  }

  get filteredTareas() {
    const query = this.taskFilters.query.trim().toLowerCase();
    return this.tareas.filter((tarea) => {
      const matchesStatus = this.taskFilters.status === 'all' || tarea.status === this.taskFilters.status;
      const matchesEntity = this.taskFilters.entityType === 'all' || (tarea.entity_type || 'none') === this.taskFilters.entityType;
      const matchesPriority = this.taskFilters.priority === 'all' || (tarea.priority || 'medium') === this.taskFilters.priority;
      const haystack = [
        tarea.title,
        tarea.entity_label,
        tarea.assigned?.full_name,
        tarea.assigned?.email
      ].join(' ').toLowerCase();
      const matchesQuery = !query || haystack.includes(query);
      return matchesStatus && matchesEntity && matchesPriority && matchesQuery;
    });
  }

  get filteredKanbanColumns() {
    if (this.leadFilters.status === 'all') return this.kanbanColumns;
    return this.kanbanColumns.filter((column) => column.id === this.leadFilters.status);
  }

  get filteredTotalKanbanLeads(): number {
    return this.filteredKanbanColumns.reduce((total, column) => total + this.getFilteredKanbanItems(column.id).length, 0);
  }

  get filteredFinalKanbanLeads(): number {
    return ['cerrado', 'perdido'].reduce((total, status) => total + this.getFilteredKanbanItems(status as LeadStatus).length, 0);
  }

  get adminThemeVars() {
    const primary = this.normalizeHex(this.brandingDraft.erp_primary_color, '#123c4a');
    const accent = this.normalizeHex(this.brandingDraft.erp_accent_color, '#f27a5e');
    const background = this.normalizeHex(this.brandingDraft.erp_background_color, '#f8fafc');
    const surface = this.normalizeHex(this.brandingDraft.erp_surface_color, '#ffffff');
    const text = this.normalizeHex(this.brandingDraft.erp_text_color, '#0f172a');

    return {
      '--bg': background,
      '--bg2': surface,
      '--bg3': this.mixHex(background, surface, 0.55),
      '--bg4': this.mixHex(background, text, 0.12),
      '--border': this.mixHex(background, text, 0.14),
      '--border2': this.mixHex(background, text, 0.22),
      '--text': text,
      '--text2': this.mixHex(text, surface, 0.2),
      '--text3': this.mixHex(text, surface, 0.45),
      '--accent': primary,
      '--accent-dim': accent,
      '--accent-bg': this.hexToRgba(primary, 0.1),
      '--font-ui': this.resolveThemeFont()
    };
  }

  get adminThemeClasses() {
    return {
      'theme-buttons-soft': this.brandingDraft.erp_button_style === 'soft',
      'theme-buttons-outline': this.brandingDraft.erp_button_style === 'outline',
      'theme-radius-rounded': this.brandingDraft.erp_radius === 'rounded',
      'theme-radius-pill': this.brandingDraft.erp_radius === 'pill',
      'theme-density-compact': this.brandingDraft.erp_density === 'compact',
      'theme-density-spacious': this.brandingDraft.erp_density === 'spacious'
    };
  }

  private isMissingRelationError(error: any, relation: string): boolean {
    const message = String(error?.message || '').toLowerCase();
    return error?.code === 'PGRST205' || message.includes(`public.${relation}`) || message.includes(`'${relation}'`);
  }

  get allInvoicesView() {
    return this.patientInvoices.map(inv => {
      const patient = this.pacientes.find(p => p.id === inv.patient_id);
      return {
        ...inv,
        patientName: patient ? `${patient.first_name} ${patient.last_name}` : 'Paciente desconocido',
        document: patient ? patient.document_id : '-'
      };
    }).sort((a, b) => new Date(b.issue_date).getTime() - new Date(a.issue_date).getTime());
  }

  get pacientesActivos() {
    // Mapear los pacientes reales y cruzar con la cama que tienen asignada
    return this.pacientes.filter(p => p.status === 'active').map(p => {
      const cama = this.camasDetalle.find(c => c.paciente_id === p.id);
      const contract = this.patientContracts.find(c => c.patient_id === p.id);
      return {
        id: p.id,
        nombreCompleto: `${p.first_name} ${p.last_name}`,
        documento: p.document_id || 'N/A',
        contacto: p.emergency_contact_name ? `${p.emergency_contact_name} (${p.emergency_contact_phone || '-'})` : 'Sin contacto',
        camaAsignada: cama ? `${cama.sede} - ${cama.id}` : 'Sin cama',
        cama_id: cama ? cama.dbId : null,
        monthly_fee: contract?.monthly_fee || 0,
        guarantor_name: contract?.guarantor_name || 'Sin tutor',
        contract_id: contract?.id || null,
        raw: p
      };
    });
  }

  // Extrae las camas que estn disponibles para asignar un nuevo paciente
  get camasLibres() {
    return this.camasDetalle.filter(c => c.estado === 'Disponible');
  }

  // Muestra las camas libres + la cama actual del paciente (para no perderla en el select)
  get camasAsignables() {
    const libres = this.camasLibres;
    if (this.pacienteDraft.resource_id) {
      const camaActual = this.camasDetalle.find(c => c.dbId === this.pacienteDraft.resource_id);
      if (camaActual && camaActual.estado !== 'Disponible') {
        return [camaActual, ...libres];
      }
    }
    return libres;
  }

  get hasOperationalAccess(): boolean {
    return this.profileRole === 'admin' || this.hasActivePlan;
  }

  get planGateMessage(): string {
    return this.hasActivePlan
      ? `Plan activo: ${this.activePlanTier || 'empresa'}`
      : 'Contrata un plan para activar sedes, camas, pacientes, admisiones, tareas, empleados y vouchers.';
  }

  // --- Estado del tablero Kanban de Admisiones ---
  kanbanColumns: { id: LeadStatus; label: string }[] = [
    { id: 'nuevo', label: 'Nuevas Consultas' },
    { id: 'contactado', label: 'Contactado' },
    { id: 'evaluacion', label: 'Evaluacion Clinica' },
    { id: 'match', label: 'Propuesta' },
    { id: 'cerrado', label: 'Ingresado / Cerrado' },
    { id: 'perdido', label: 'Perdido' }
  ];
  // Usamos un Record para que sea ms seguro y fcil de acceder
  kanbanData: Record<LeadStatus, any[]> = {
    nuevo: [], contactado: [], evaluacion: [], match: [], cerrado: [], perdido: []
  };

  get totalKanbanLeads(): number {
    return this.kanbanColumns.reduce((total, column) => total + (this.kanbanData[column.id]?.length || 0), 0);
  }

  isTerminalKanbanColumn(columnId: LeadStatus): boolean {
    return columnId === 'cerrado' || columnId === 'perdido';
  }

  getKanbanColumnHint(columnId: LeadStatus): string {
    const hints: Record<LeadStatus, string> = {
      nuevo: 'Entrada del pipeline',
      contactado: 'Primer seguimiento',
      evaluacion: 'Validacion clinica',
      match: 'Definicion comercial',
      cerrado: 'Resultado favorable',
      perdido: 'Salida no concretada'
    };
    return hints[columnId];
  }

  getKanbanEmptyTitle(columnId: LeadStatus): string {
    return this.isTerminalKanbanColumn(columnId)
      ? `Sin casos ${columnId === 'cerrado' ? 'cerrados' : 'perdidos'}`
      : `Sin casos en ${this.leadStatusLabel(columnId).toLowerCase()}`;
  }

  getKanbanEmptyHint(columnId: LeadStatus): string {
    if (this.hasActiveLeadFilters()) {
      return 'Prueba con otro texto, comuna o etapa para ampliar el resultado.';
    }
    const hints: Record<LeadStatus, string> = {
      nuevo: 'Las nuevas consultas apareceran aquii.',
      contactado: 'Arrastra una consulta cuando ya exista contacto inicial.',
      evaluacion: 'Mueve aquii los casos que requieran evaluacion clinica.',
      match: 'Usa esta etapa para propuestas o ajuste de oferta.',
      cerrado: 'Los ingresos concretados quedan agrupados aquii.',
      perdido: 'Marca aquii los casos que no avanzaron.'
    };
    return hints[columnId];
  }

  getFilteredKanbanItems(columnId: LeadStatus) {
    const query = this.leadFilters.query.trim().toLowerCase();
    const comuna = this.leadFilters.comuna.trim().toLowerCase();
    return (this.kanbanData[columnId] || []).filter((lead) => {
      const haystack = [
        lead.nombre,
        lead.comuna,
        lead.dependencia
      ].join(' ').toLowerCase();
      const matchesQuery = !query || haystack.includes(query);
      const matchesComuna = !comuna || String(lead.comuna || '').toLowerCase().includes(comuna);
      return matchesQuery && matchesComuna;
    });
  }

  resetTaskFilters() {
    this.taskFilters = {
      query: '',
      status: 'all',
      entityType: 'all',
      priority: 'all'
    };
  }

  resetLeadFilters() {
    this.leadFilters = {
      query: '',
      status: 'all',
      comuna: ''
    };
  }

  hasActiveLeadFilters(): boolean {
    return this.leadFilters.query.trim().length > 0 || this.leadFilters.comuna.trim().length > 0 || this.leadFilters.status !== 'all';
  }

  private realtimeChannel: any;

  constructor(
    private supabase: SupabaseService,
    private auth: AuthService,
    private route: ActivatedRoute
  ) {}

  async ngOnInit() {
    if (this.companyConfigMode) {
      this.configSection = 'company';
    }

    this.route.queryParamMap.subscribe((params) => {
      const requestedView = params.get('view') as any;
      if (requestedView) {
        this.currentView = requestedView;
      }
      this.selectedEntityType = (params.get('entityType') as any) || null;
      this.selectedEntityId = params.get('entityId');
    });
    await this.loadData();
    this.setupRealtimeSubscriptions();
  }

  ngOnDestroy() {
    if (this.realtimeChannel) {
      this.supabase.client.removeChannel(this.realtimeChannel);
    }
    this.toastTimeouts.forEach((timeoutId) => clearTimeout(timeoutId));
    this.toastTimeouts.clear();
    if (this.confirmResolver) {
      this.confirmResolver(false);
      this.confirmResolver = null;
    }
  }

  setupRealtimeSubscriptions() {
    // Suscribirse a cambios en Leads para la misma empresa
    this.realtimeChannel = this.supabase.client
      .channel('leads-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'leads' }, (payload) => {
        // Recargamos los datos para reflejar el estado actual
        this.loadData();
      })
      .subscribe();
  }

  async loadData() {
    this.loading = true;
    try {
      // 1. Obtener la sesion y usuario actual
      const { data: sessionData } = await this.supabase.client.auth.getSession();
      const userId = sessionData?.session?.user?.id;
      if (!userId) return;

      const { data: profileData } = await this.supabase.client
        .from('profiles')
        .select('role')
        .eq('id', userId)
        .maybeSingle();
      this.profileRole = (profileData?.role as string | undefined) ?? null;

      // 2. Obtener el company_id del usuario (para mostrar solo lo de su empresa)
      const { data: memberData } = await this.supabase.client
        .from('company_members')
        .select('company_id')
        .eq('user_id', userId)
        .maybeSingle();
      
      const companyId = memberData?.company_id;
      if (!companyId) {
        this.companyId = null;
        this.hasActivePlan = false;
        this.activePlanTier = null;
        this.sedes = [];
        this.camasDetalle = [];
        return;
      }
      this.companyId = companyId;

      const { data: activeSubscription } = await this.supabase.client
        .from('company_subscriptions')
        .select('plan_tier,status,current_period_end')
        .eq('company_id', companyId)
        .eq('status', 'active')
        .or(`current_period_end.is.null,current_period_end.gte.${new Date().toISOString()}`)
        .order('current_period_end', { ascending: false, nullsFirst: false })
        .limit(1)
        .maybeSingle();
      this.hasActivePlan = !!activeSubscription;
      this.activePlanTier = (activeSubscription?.plan_tier as string | undefined) ?? null;

      if (this.isPlanLockedView(this.currentView)) {
        this.currentView = 'metricas';
      }

      // Cargar sedes (providers) de la empresa para que aparezcan en el selector, 
      // incluso si an no tienen camas asignadas.
      const { data: providersData } = await this.supabase.client
        .from('providers')
        .select('*')
        .eq('company_id', companyId);
      this.rawProviders = providersData || [];

      // Cargar tabla de Pacientes
      const { data: patientsData } = await this.supabase.client.from('patients').select('*').eq('company_id', companyId);
      this.pacientes = patientsData || [];

      const { data: contractsData, error: contractsError } = await this.supabase.client
        .from('patient_contracts')
        .select('*')
        .eq('company_id', companyId);
      if (contractsError && !this.isMissingRelationError(contractsError, 'patient_contracts')) throw contractsError;
      this.patientContracts = contractsData || [];

      const { data: invoicesData, error: invoicesError } = await this.supabase.client
        .from('patient_invoices')
        .select('*')
        .eq('company_id', companyId);
      if (invoicesError && !this.isMissingRelationError(invoicesError, 'patient_invoices')) throw invoicesError;
      this.patientInvoices = invoicesData || [];

      const { data: gastosData } = await this.supabase.client.from('company_expenses').select('*').eq('company_id', companyId).order('expense_date', { ascending: false });
      this.gastos = gastosData || [];

      // Calcular balance financiero (Ingresos pagados vs Gastos totales)
      this.totalIngresos = this.patientInvoices.filter(i => i.status === 'paid').reduce((sum, i) => sum + Number(i.amount || 0), 0);
      this.totalGastos = this.gastos.reduce((sum, g) => sum + Number(g.amount || 0), 0);

      // Procesar datos para el grafico de gastos
      const gastosPorCategoria = this.gastos.reduce((acc, gasto) => {
        const category = gasto.category || 'Otros';
        acc[category] = (acc[category] || 0) + Number(gasto.amount || 0);
        return acc;
      }, {} as Record<string, number>);

      this.expensesChartLabels = Object.keys(gastosPorCategoria);
      this.expensesChartDatasets = [
        {
          data: Object.values(gastosPorCategoria),
          backgroundColor: ['#ef4444', '#f97316', '#f59e0b', '#eab308', '#84cc16', '#22c55e', '#10b981', '#14b8a6', '#06b6d4', '#3b82f6']
        }
      ];

      // 3. Obtener los cupos/camas de la empresa junto a la info de su sede (provider)
      const { data: resources } = await this.supabase.client
        .from('care_resources')
        .select('*, provider:providers(id, name, area), patient:patients(id, first_name, last_name)')
        .eq('company_id', companyId);

      const resArray = resources || [];

      // 4. Mapear care_resources para la tabla "Camas y Vacantes"
      this.camasDetalle = resArray.map(r => ({
        dbId: r.id,
        provider_id: r.provider_id,
        id: r.resource_code,
        sede: (r.provider as any)?.name || r.location_label || 'Sede no especificada',
        tipo: r.care_type,
        estado: r.status,
          paciente_id: r.patient_id,
          paciente: r.patient ? `${r.patient.first_name} ${r.patient.last_name}` : '-'
      }));

      // 5. Agrupar las camas por Proveedor/Sede para armar la tabla "Mis Sedes"
      const sedesMap = new Map<string, any>();
      
      // Inicializar el mapa con las sedes vacas
      this.rawProviders.forEach(p => {
        sedesMap.set(p.id, {
          id: p.id,
          nombre: p.name,
          ubicacion: p.area || 'Sin ubicacion',
          camasTotales: 0,
          camasDisponibles: 0
        });
      });

      resArray.forEach(r => {
        const provId = r.provider_id || r.location_label || 'unknown';
        if (!sedesMap.has(provId)) {
          sedesMap.set(provId, {
            id: provId,
            nombre: (r.provider as any)?.name || r.location_label || 'Sede sin nombre',
            ubicacion: (r.provider as any)?.area || 'Sin ubicacion',
            camasTotales: 0,
            camasDisponibles: 0
          });
        }
        const sede = sedesMap.get(provId);
        sede.camasTotales++;
        if (r.status === 'Disponible') {
          sede.camasDisponibles++;
        }
      });

      // Asignar estado a las sedes dependiendo de sus cupos
      this.sedes = Array.from(sedesMap.values()).map(s => {
        let estado = 'Normal';
        
        if (s.camasTotales > 0 && s.camasDisponibles === 0) estado = 'Critico';
        else if (s.camasTotales > 0 && (s.camasDisponibles / s.camasTotales) <= 0.3) estado = 'Atencion';
        
        return { ...s, estado };
      });

      // 6. Clculos dinamicos de estadisticas generales
      this.totalSedes = this.sedes.length;
      this.camasTotales = resArray.length;
      this.camasDisponibles = resArray.filter(r => r.status === 'Disponible').length;
      this.camasOcupadas = resArray.filter(r => r.status === 'Ocupada').length;
      this.camasEnMantenimiento = resArray.filter(r => r.status === 'En limpieza').length;
      
      this.porcentajeOcupacion = this.camasTotales > 0 
        ? Number(((this.camasOcupadas / this.camasTotales) * 100).toFixed(1)) 
        : 0;

      // Actualizar datos del grafico
      this.doughnutChartDatasets = [
        {
          data: [this.camasOcupadas, this.camasDisponibles, this.camasEnMantenimiento],
          backgroundColor: ['#3b82f6', '#22c55e', '#f59e0b']
        }
      ];

      // 7. Cargar Leads para el Kanban de Admisiones
      const { data: leadsData, error: leadsError } = await this.supabase.client
        .from('leads')
        .select('*')
        .eq('company_id', companyId);

      if (leadsError) throw leadsError;
      this.leads = leadsData || [];

      // Inicializar/limpiar el contenedor de datos del kanban
      this.kanbanColumns.forEach(col => this.kanbanData[col.id] = []);

      // Agrupar leads en sus columnas correspondientes
      this.leads.forEach(lead => {
        const status = lead.estado as LeadStatus;
        if (this.kanbanData[status]) {
          this.kanbanData[status].push(lead);
        } else {
          this.kanbanData['nuevo'].push(lead); // Fallback a 'nuevo' si el estado es invalido
        }
      });

      // Actualizar datos del grafico de barras
      this.totalLeads = this.leads.length;
      this.barChartDatasets = [
        {
          data: [
            this.kanbanData['nuevo'].length,
            this.kanbanData['contactado'].length,
            this.kanbanData['evaluacion'].length,
            this.kanbanData['match'].length,
            this.kanbanData['cerrado'].length,
            this.kanbanData['perdido'].length
          ],
          // Usamos colores similares a los badges de cada estado en el Kanban
          backgroundColor: ['#f59e0b', '#3b82f6', '#94a3b8', '#3b82f6', '#22c55e', '#ef4444'],
          borderRadius: 4
        }
      ];

      // 8. Cargar Empleados para selectores
      const { data: membersData, error: membersError } = await this.supabase.client
        .from('company_members')
        .select('user_id, profiles(full_name, email)')
        .eq('company_id', companyId);
      
      if (membersError) console.warn('No se pudieron cargar los empleados:', membersError.message);
      this.empleados = (membersData || []).map(m => ({
        id: m.user_id,
        name: (m.profiles as any)?.full_name?.trim() || '',
        email: (m.profiles as any)?.email || '',
        displayName: (m.profiles as any)?.full_name?.trim()
          ? `${(m.profiles as any)?.full_name?.trim()}${(m.profiles as any)?.email ? ' (' + (m.profiles as any).email + ')' : ''}`
          : ((m.profiles as any)?.email || 'Empleado sin perfil')
      }));

      // 9. Cargar Tareas
      const employeeIds = this.empleados.map(e => e.id);
      let tasksData: any[] = [];
      
      if (employeeIds.length > 0) {
        const res = await this.supabase.client
          .from('care_tasks')
          .select('*, assigned:profiles!employee_id(full_name, email)')
          .in('employee_id', employeeIds)
          .order('created_at', { ascending: false });
        tasksData = res.data || [];
        if (res.error) console.warn('Error cargando tareas:', res.error);
      }
      this.tareas = tasksData || [];
      this.totalTareas = this.tareas.length;
      this.tasksChartDatasets = [
        {
          data: [
            this.tareas.filter(t => t.status === 'pending').length,
            this.tareas.filter(t => t.status === 'in_progress').length,
            this.tareas.filter(t => t.status === 'done').length
          ],
          backgroundColor: ['#f59e0b', '#3b82f6', '#22c55e']
        }
      ];
      this.buildOperationalSummary();

      if (this.tareas.length > 0) {
        const { data: taskHistoryData, error: taskHistoryError } = await this.supabase.client
          .from('care_task_history')
          .select('*, author:profiles!changed_by(full_name, email)')
          .in('task_id', this.tareas.map((task) => task.id))
          .order('created_at', { ascending: false })
          .limit(10);

        if (taskHistoryError) {
          console.warn('Error cargando historial de tareas:', taskHistoryError);
        }
        this.taskHistory = taskHistoryData || [];
      } else {
        this.taskHistory = [];
      }
      await this.loadErpOperationalModules(companyId);

    } catch (error) {
      console.error('Error cargando datos del dashboard:', error);
    } finally {
      this.hasLoadedOnce = true;
      this.loading = false;
    }
  }
  
  // Evento Drag & Drop del Kanban
  async dropKanban(event: CdkDragDrop<any[]>) {
    if (!this.ensureOperationalAccess()) return;
    if (event.previousContainer === event.container) {
      // Mover dentro de la misma columna (reordenar)
      moveItemInArray(event.container.data, event.previousIndex, event.currentIndex);
    } else {
      // Mover a otra columna (y actualizar estado)
      const newStatus = event.container.id as LeadStatus;
      const movedItem = event.item.data;

      // 1. Actualizar el estado en Supabase
      const { error } = await this.supabase.client
        .from('leads')
        .update({ estado: newStatus })
        .eq('id', movedItem.id);

      if (error) {
        console.error('Error actualizando el estado del lead:', error);
        this.flash('No se pudo mover el lead. Revisa la consola para ms detalles.');
        // No hacemos el transfer si falla la BD para mantener la UI consistente con la data.
        return;
      }
      
      // 2. Si la BD se actualiz, movemos el item en la UI
      transferArrayItem(
        event.previousContainer.data,
        event.container.data,
        event.previousIndex,
        event.currentIndex,
      );
      
      // 3. Flujo automatico: Si pas a Cerrado (Admitido), sugerir crear paciente
      if (newStatus === 'cerrado' && event.previousContainer.id !== 'cerrado') {
        if (await this.confirmAction('El prospecto ha sido cerrado con exito. Deseas ingresarlo como paciente activo y configurar su tarifa mensual ahora?')) {
           this.openNewPacienteFromLead(movedItem);
        }
      }
    }
  }

  trackByKanbanColumn = (_index: number, column: { id: LeadStatus }) => column.id;

  trackByLead = (_index: number, lead: { id?: string | number }) => lead.id ?? _index;

  getTimeAgo(dateString: string): string {
    if (!dateString) return '';
    const date = new Date(dateString);
    const now = new Date();
    const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    let interval = Math.floor(seconds / 31536000);
    if (interval >= 1) return `Hace ${interval} a\u00f1o${interval === 1 ? '' : 's'}`;
    interval = Math.floor(seconds / 2592000);
    if (interval >= 1) return `Hace ${interval} mes${interval === 1 ? '' : 'es'}`;
    interval = Math.floor(seconds / 86400);
    if (interval >= 1) return `Hace ${interval} d\u00eda${interval === 1 ? '' : 's'}`;
    interval = Math.floor(seconds / 3600);
    if (interval >= 1) return `Hace ${interval} hora${interval === 1 ? '' : 's'}`;
    interval = Math.floor(seconds / 60);
    if (interval >= 1) return `Hace ${interval} minuto${interval === 1 ? '' : 's'}`;
    return 'Hace unos segundos';
  }

  formatMoney(value: number | string | null | undefined): string {
    return new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency: 'CLP',
      maximumFractionDigits: 0
    }).format(Number(value || 0));
  }

  statusLabel(status: string | null | undefined): string {
    const labels: Record<string, string> = {
      pending: 'Pendiente',
      in_progress: 'En progreso',
      done: 'Completada',
      canceled: 'Cancelada'
    };
    return labels[status || ''] || 'Sin estado';
  }

  leadStatusLabel(status: string | null | undefined): string {
    const labels: Record<string, string> = {
      nuevo: 'Nuevo',
      contactado: 'Contactado',
      evaluacion: 'En evaluaci\u00f3n',
      match: 'Propuesta',
      cerrado: 'Cerrado',
      perdido: 'Perdido'
    };
    return labels[status || ''] || 'Sin etapa';
  }

  careTypeLabel(value: string | null | undefined): string {
    const labels: Record<string, string> = {
      guidance: 'Orientaci\u00f3n general',
      home_care: 'Cuidados a domicilio',
      residential: 'Hotel para mascotas',
      nursing: 'Enfermer\u00eda',
      dementia: 'Demencia / Alzheimer',
      respite: 'Cuidado de respiro'
    };
    return labels[value || ''] || value || 'Sin dato';
  }

  dependencyLevelLabel(value: string | null | undefined): string {
    const labels: Record<string, string> = {
      low: 'Baja',
      medium: 'Media',
      high: 'Alta',
      full: 'Dependencia total'
    };
    return labels[value || ''] || value || 'Sin dato';
  }

  preferredContactLabel(value: string | null | undefined): string {
    const labels: Record<string, string> = {
      chat: 'Chat',
      phone: 'Llamada',
      video: 'Videollamada'
    };
    return labels[value || ''] || value || 'Sin dato';
  }

  fundingLabel(value: string | null | undefined): string {
    const labels: Record<string, string> = {
      self_funder: 'Pago privado',
      local_authority: 'Ayuda publica'
    };
    return labels[value || ''] || value || 'Sin dato';
  }

  urgencyLabel(value: string | null | undefined): string {
    const labels: Record<string, string> = {
      immediate: 'Inmediata',
      '3m': 'En 3 meses',
      '6m': 'En 6 meses',
      exploring: 'Explorando opciones'
    };
    return labels[value || ''] || value || 'Sin dato';
  }

  async openLeadDetail(lead: any): Promise<void> {
    this.selectedLead = lead;
    this.selectedLeadIntake = null;
    this.showLeadDetailModal = true;

    if (!lead?.employee_id || !lead?.company_id) return;

    this.loadingLeadDetail = true;
    try {
      const { data, error } = await this.supabase.client
        .from('care_intakes')
        .select('id, payload, created_at, updated_at')
        .eq('company_id', lead.company_id)
        .eq('employee_id', lead.employee_id)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      this.selectedLeadIntake = data || null;
    } catch (error) {
      console.warn('No se pudo cargar la ficha de la admision:', error);
    } finally {
      this.loadingLeadDetail = false;
    }
  }

  closeLeadDetail(): void {
    this.showLeadDetailModal = false;
    this.selectedLead = null;
    this.selectedLeadIntake = null;
    this.loadingLeadDetail = false;
  }

  exportActivityToCSV() {
    if (!this.recentActivity || this.recentActivity.length === 0) {
      this.flash('No hay datos de actividad para exportar.');
      return;
    }

    // 1. Crear los encabezados
    let csvContent = 'Fecha,Usuario,Evento\n';

    // 2. Formatear cada fila de datos
    this.recentActivity.forEach(act => {
      const fecha = new Date(act.created_at).toLocaleString('es-CL');
      const usuario = act.profiles?.full_name || 'Usuario desconocido';
      const evento = act.event_name || 'Sin evento';
      
      // Escapar texto por si contiene comas o comillas
      const escapeCSV = (str: string) => `"${str.replace(/"/g, '""')}"`;
      csvContent += `${escapeCSV(fecha)},${escapeCSV(usuario)},${escapeCSV(evento)}\n`;
    });

    // 3. Crear el archivo y forzar la descarga (BOM \ufeff asegura que Excel lea bien los acentos)
    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `actividad_reciente_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  }

  isPlanLockedView(view: DashboardView): boolean {
    return this.planLockedViews.has(view) && !this.hasOperationalAccess;
  }

  setView(view: DashboardView) {
    if (this.isPlanLockedView(view)) {
      this.notifyWarning('Necesitas un plan activo para usar este modulo.');
      return;
    }
    this.currentView = view;
    this.mobileNavOpen = false;
    this.clearSelectedEntity();
  }

  toggleMobileNav() {
    this.mobileNavOpen = !this.mobileNavOpen;
  }

  closeMobileNav() {
    this.mobileNavOpen = false;
  }

  dismissToast(id: number) {
    this.toasts = this.toasts.filter((toast) => toast.id !== id);
    const timeoutId = this.toastTimeouts.get(id);
    if (timeoutId) {
      clearTimeout(timeoutId);
      this.toastTimeouts.delete(id);
    }
  }

  resolveConfirmation(confirmed: boolean) {
    const resolver = this.confirmResolver;
    this.confirmResolver = null;
    this.confirmState.open = false;
    if (resolver) resolver(confirmed);
  }

  private showToast(message: string, tone: ToastTone = 'info', duration = 4200) {
    const id = ++this.toastCounter;
    this.toasts = [...this.toasts, { id, message, tone }];
    const timeoutId = setTimeout(() => this.dismissToast(id), duration);
    this.toastTimeouts.set(id, timeoutId);
  }

  private notifySuccess(message: string) {
    this.showToast(message, 'success');
  }

  private notifyInfo(message: string) {
    this.showToast(message, 'info');
  }

  private notifyWarning(message: string) {
    this.showToast(message, 'warning');
  }

  private notifyError(message: string) {
    this.showToast(message, 'error', 5200);
  }

  private flash(message: string) {
    const normalized = message.toLowerCase();
    if (normalized.includes('guardado correctamente') || normalized.includes('apariencia guardada') || normalized.includes('correctamente')) {
      this.notifySuccess(message);
      return;
    }
    if (normalized.includes('obligatorio') || normalized.includes('necesitas') || normalized.includes('no hay') || normalized.includes('selecciona')) {
      this.notifyWarning(message);
      return;
    }
    if (normalized.includes('error') || normalized.includes('no se pudo') || normalized.includes('no tiene') || normalized.includes('supera') || normalized.includes('no es v')) {
      this.notifyError(message);
      return;
    }
    this.notifyInfo(message);
  }

  private requestConfirmation(options: {
    title?: string;
    message: string;
    tone?: ToastTone;
    confirmLabel?: string;
    cancelLabel?: string;
  }) {
    if (this.confirmResolver) {
      this.confirmResolver(false);
    }

    this.confirmState = {
      open: true,
      title: options.title || 'Confirmar accion',
      message: options.message,
      tone: options.tone || 'warning',
      confirmLabel: options.confirmLabel || 'Confirmar',
      cancelLabel: options.cancelLabel || 'Cancelar'
    };

    return new Promise<boolean>((resolve) => {
      this.confirmResolver = resolve;
    });
  }

  private confirmAction(message: string, options?: {
    title?: string;
    tone?: ToastTone;
    confirmLabel?: string;
    cancelLabel?: string;
  }) {
    return this.requestConfirmation({
      message,
      title: options?.title,
      tone: options?.tone,
      confirmLabel: options?.confirmLabel,
      cancelLabel: options?.cancelLabel
    });
  }

  private ensureOperationalAccess(): boolean {
    if (this.hasOperationalAccess) return true;
    this.notifyWarning('Necesitas un plan activo para realizar esta accion.');
    return false;
  }

  private buildOperationalSummary() {
    const now = new Date();
    const pendingTasks = this.tareas.filter(t => t.status === 'pending');
    const inProgressTasks = this.tareas.filter(t => t.status === 'in_progress');
    const doneTasks = this.tareas.filter(t => t.status === 'done');
    const overdueTasks = this.tareas.filter(t => {
      if (!t.due_at || t.status === 'done') return false;
      return new Date(t.due_at) < now;
    });

    this.taskSummaryCards = [
      { label: 'Tareas pendientes', value: pendingTasks.length, tone: 'warn' },
      { label: 'En progreso', value: inProgressTasks.length, tone: 'blue' },
      { label: 'Completadas', value: doneTasks.length, tone: 'green' },
      { label: 'Vencidas', value: overdueTasks.length, tone: 'neutral' }
    ];

    const alerts: Array<{ level: 'high' | 'medium' | 'info'; title: string; detail: string }> = [];

    if (overdueTasks.length > 0) {
      alerts.push({
        level: 'high',
        title: 'Tareas vencidas',
        detail: `${overdueTasks.length} tarea${overdueTasks.length === 1 ? '' : 's'} requiere${overdueTasks.length === 1 ? '' : 'n'} atenci\u00f3n inmediata.`
      });
    }

    if (this.camasTotales > 0 && this.camasDisponibles === 0) {
      alerts.push({
        level: 'high',
        title: 'Sin camas disponibles',
        detail: 'La ocupaci\u00f3n est\u00e1 al m\u00e1ximo y no hay vacantes libres para nuevas admisiones.'
      });
    } else if (this.camasTotales > 0 && this.camasDisponibles <= 2) {
      alerts.push({
        level: 'medium',
        title: 'Disponibilidad baja',
        detail: `Quedan ${this.camasDisponibles} camas disponibles en toda la operaci\u00f3n.`
      });
    }

    const newLeads = this.kanbanData['nuevo']?.length || 0;
    if (newLeads > 0) {
      alerts.push({
        level: newLeads >= 3 ? 'medium' : 'info',
        title: 'Consultas por contactar',
        detail: `${newLeads} lead${newLeads === 1 ? '' : 's'} sigue${newLeads === 1 ? '' : 'n'} en etapa inicial.`
      });
    }

    if (this.camasEnMantenimiento > 0) {
      alerts.push({
        level: 'info',
        title: 'Camas fuera de servicio',
        detail: `${this.camasEnMantenimiento} cama${this.camasEnMantenimiento === 1 ? '' : 's'} est\u00e1${this.camasEnMantenimiento === 1 ? '' : 'n'} en limpieza o mantenci\u00f3n.`
      });
    }

    this.operationalAlerts = alerts.length
      ? alerts
      : [{
          level: 'info',
          title: 'Operaci\u00f3n estable',
          detail: 'No hay alertas cr\u00edticas. La operaci\u00f3n se ve dentro de par\u00e1metros normales.'
        }];
  }

  openLeadModal(lead?: any) {
    if (!this.ensureOperationalAccess()) return;
    if (lead) {
      // Para editar (aunque el boton actual es solo para crear)
      this.leadDraft = { 
        id: lead.id, 
        nombre: lead.nombre, 
        comuna: lead.comuna, 
        dependencia: lead.dependencia,
        presupuesto: lead.presupuesto
      };
    } else {
      // Para crear
      this.leadDraft = { id: null, nombre: '', comuna: '', dependencia: '', presupuesto: null };
    }
    this.showLeadModal = true;
  }

  async saveLead() {
    if (!this.ensureOperationalAccess()) return;
    if (!this.companyId || !this.leadDraft.nombre?.trim()) {
      this.flash('El nombre del prospecto es obligatorio.');
      return;
    }
    this.savingLead = true;
    try {
      const payload: any = {
        company_id: this.companyId,
        nombre: this.leadDraft.nombre,
        comuna: this.leadDraft.comuna || null,
        dependencia: this.leadDraft.dependencia || null,
        presupuesto: this.leadDraft.presupuesto || null
      };

      if (!this.leadDraft.id) {
        payload.estado = 'nuevo'; // Las nuevas consultas siempre empiezan en la columna 'nuevo'
      }

      const { error } = this.leadDraft.id
        ? await this.supabase.client.from('leads').update(payload).eq('id', this.leadDraft.id)
        : await this.supabase.client.from('leads').insert(payload);
      if (error) throw error;

      this.showLeadModal = false;
      await this.loadData();
    } catch (error) {
      console.error('Error guardando la consulta/lead:', error);
      this.flash('No se pudo guardar la consulta. Revisa la consola para ms detalles.');
    } finally {
      this.savingLead = false;
    }
  }

  openSedeModal(sede?: any) {
    if (!this.ensureOperationalAccess()) return;
    if (sede) {
      this.sedeDraft = { id: sede.id, nombre: sede.nombre, ubicacion: sede.ubicacion };
    } else {
      this.sedeDraft = { id: null, nombre: '', ubicacion: '' };
    }
    this.showSedeModal = true;
  }

  async saveSede() {
    if (!this.ensureOperationalAccess()) return;
    if (!this.companyId || !this.sedeDraft.nombre) return;
    this.savingSede = true;
    try {
      let error;
      if (this.sedeDraft.id) {
        const res = await this.supabase.client.from('providers').update({
          name: this.sedeDraft.nombre,
          area: this.sedeDraft.ubicacion
        }).eq('id', this.sedeDraft.id);
        error = res.error;
      } else {
        const res = await this.supabase.client.from('providers').insert({
          company_id: this.companyId,
          name: this.sedeDraft.nombre,
          area: this.sedeDraft.ubicacion,
          type: 'Hotel para mascotas'
        });
        error = res.error;
      }
      if (error) throw error;
      this.showSedeModal = false;
      await this.loadData();
    } catch (error) {
      console.error('Error guardando sede:', error);
      this.flash('Error al guardar la sede. Revisa la conexion con Supabase.');
    } finally {
      this.savingSede = false;
    }
  }

  async deleteSede(sede: any) {
    if (!this.ensureOperationalAccess()) return;
    if (!await this.confirmAction(`Estas seguro de eliminar la sede "${sede.nombre}"?`)) return;
    try {
      const { error } = await this.supabase.client.from('providers').delete().eq('id', sede.id);
      if (error) throw error;
      await this.loadData();
    } catch (error: any) {
      console.error('Error eliminando sede:', error);
      this.flash('Error al eliminar la sede. Verifica que no tenga camas asociadas.');
    }
  }

  openCamaModal(cama?: any) {
    if (!this.ensureOperationalAccess()) return;
    if (cama) {
      // Mapeo inverso de Base de Datos -> Formulario
      let formCareType = 'Basico';
      if (cama.tipo === 'Post-operatorio') formCareType = 'Intermedio';
      if (cama.tipo === 'Intensivo') formCareType = 'Intensivo';

      this.camaDraft = {
        db_id: cama.dbId,
        resource_code: cama.id,
        provider_id: cama.provider_id,
        care_type: formCareType,
        status: cama.estado === 'Ocupada' ? 'Ocupada' : cama.estado === 'En limpieza' ? 'En limpieza' : 'Disponible',
        notes: cama.paciente !== '-' ? cama.paciente : ''
      };
    } else {
      this.camaDraft = { db_id: null, resource_code: '', provider_id: '', care_type: 'Basico', status: 'Disponible', notes: '' };
    }
    this.showCamaModal = true;
  }

  async saveCama() {
    if (!this.ensureOperationalAccess()) return;
    if (!this.companyId || !this.camaDraft.resource_code || !this.camaDraft.provider_id) {
      this.flash('Por favor ingresa un ID y selecciona una sede.');
      return;
    }
    this.savingCama = true;
    try {
      // Buscamos el nombre de la sede seleccionada para guardarlo como location_label
      const selectedSede = this.sedes.find(s => s.id === this.camaDraft.provider_id);
      const locationLabel = selectedSede ? selectedSede.nombre : 'Sede principal';

      // Mapear los valores del formulario a los valores EXACTOS de tu base de datos
      const careTypeMap: Record<string, string> = {
        'Basico': 'Basico', // Sin tilde, como exige tu BD
        'Intermedio': 'Post-operatorio', // Tu BD no tiene "Intermedio", usamos Post-operatorio
        'Intensivo': 'Intensivo'
      };
      const statusMap: Record<string, string> = {
        'Disponible': 'Disponible',
        'Ocupada': 'Ocupada',
        'En limpieza': 'En limpieza',
        'Mantenimiento': 'En limpieza' // Tu BD no tiene "Mantenimiento", lo asignamos a limpieza
      };

      const payload = {
        company_id: this.companyId,
        resource_code: this.camaDraft.resource_code,
        provider_id: this.camaDraft.provider_id,
        location_label: locationLabel,
        care_type: careTypeMap[this.camaDraft.care_type] || 'Basico',
        status: statusMap[this.camaDraft.status] || 'Disponible',
        notes: this.camaDraft.notes
      };

      let error;
      if (this.camaDraft.db_id) {
        const res = await this.supabase.client.from('care_resources').update(payload).eq('id', this.camaDraft.db_id);
        error = res.error;
      } else {
        const res = await this.supabase.client.from('care_resources').insert(payload);
        error = res.error;
      }
      if (error) throw error;
      this.showCamaModal = false;
      await this.loadData();
    } catch (error: any) {
      console.error('Error guardando cama:', error);
      if (error?.code === '23505') {
        this.flash('Ya existe una cama con ese ID / Codigo. Por favor, ingresa uno diferente.');
      } else {
        this.flash('Error al guardar la cama. Revisa la consola para ms detalles.');
      }
    } finally {
      this.savingCama = false;
    }
  }

  async deleteCama(cama: any) {
    if (!this.ensureOperationalAccess()) return;
    if (!await this.confirmAction(`Estas seguro de eliminar la cama/vacante "${cama.id}"?`)) return;
    try {
      const { error } = await this.supabase.client.from('care_resources').delete().eq('id', cama.dbId);
      if (error) throw error;
      await this.loadData();
    } catch (error: any) {
      console.error('Error eliminando cama:', error);
      this.flash('Error al eliminar la cama.');
    }
  }

  // --- GESTIN DE PACIENTES ---

  openNewPacienteModal() {
    if (!this.ensureOperationalAccess()) return;
    this.pacienteDraft = {
      id: null,
      first_name: '',
      last_name: '',
      document_id: '',
      emergency_contact_name: '',
      emergency_contact_phone: '',
      resource_id: null,
      monthly_fee: null,
      guarantor_name: '',
      guarantor_document_id: '',
      guarantor_email: ''
    };
    this.showPacienteModal = true;
  }

  openNewPacienteFromLead(lead: any) {
    this.openNewPacienteModal();
    const parts = (lead.nombre || '').split(' ');
    this.pacienteDraft.first_name = parts[0] || '';
    this.pacienteDraft.last_name = parts.slice(1).join(' ') || '';
    this.pacienteDraft.monthly_fee = lead.presupuesto || null;
  }

  openPacienteModal(pacienteView: any) {
    if (!this.ensureOperationalAccess()) return;
    const p = pacienteView.raw;
    const contract = this.patientContracts.find(c => c.patient_id === p.id);

    this.pacienteDraft = {
      id: p.id,
      first_name: p.first_name,
      last_name: p.last_name,
      document_id: p.document_id,
      emergency_contact_name: p.emergency_contact_name,
      emergency_contact_phone: p.emergency_contact_phone,
      resource_id: pacienteView.cama_id,
      monthly_fee: contract?.monthly_fee || null,
      guarantor_name: contract?.guarantor_name || '',
      guarantor_document_id: contract?.guarantor_document_id || '',
      guarantor_email: contract?.guarantor_email || ''
    };
    this.showPacienteModal = true;
  }

  async savePaciente() {
    if (!this.ensureOperationalAccess()) return;
    if (!this.pacienteDraft.first_name?.trim() || !this.pacienteDraft.last_name?.trim()) {
      this.flash('El nombre y los apellidos son obligatorios.');
      return;
    }
    this.savingPaciente = true;
    
    try {
      let patientId = this.pacienteDraft.id;
      const guarantorName = this.pacienteDraft.guarantor_name?.trim() || '';
      const guarantorEmail = this.pacienteDraft.guarantor_email?.trim() || '';
      const guarantorDocumentId = this.pacienteDraft.guarantor_document_id?.trim() || '';
      const patientPayload = {
        company_id: this.companyId,
        first_name: this.pacienteDraft.first_name.trim(),
        last_name: this.pacienteDraft.last_name.trim(),
        status: 'active',
        document_id: this.pacienteDraft.document_id || null,
        emergency_contact_name: this.pacienteDraft.emergency_contact_name || null,
        emergency_contact_phone: this.pacienteDraft.emergency_contact_phone || null
      };

      // Upsert paciente
      if (patientId) {
        const { error } = await this.supabase.client.from('patients').update(patientPayload).eq('id', patientId);
        if (error) throw error;
      } else {
        const res = await this.supabase.client.from('patients').insert(patientPayload).select('id').single();
        if (res.error) throw res.error;
        patientId = res.data.id;
      }

      // Gestionar la Cama: Liberar la cama anterior si exista
      const { error: releaseBedError } = await this.supabase.client
        .from('care_resources')
        .update({ patient_id: null, status: 'Disponible' })
        .eq('patient_id', patientId);
      if (releaseBedError) throw releaseBedError;

      // Asignar a la nueva cama
      if (this.pacienteDraft.resource_id) {
        const { error: assignBedError } = await this.supabase.client
          .from('care_resources')
          .update({ patient_id: patientId, status: 'Ocupada' })
          .eq('id', this.pacienteDraft.resource_id);
        if (assignBedError) throw assignBedError;
      }
      
      // Gestionar Contrato / Facturacion
      if (this.pacienteDraft.monthly_fee !== null || guarantorName || guarantorEmail || guarantorDocumentId) {
        const contractPayload = {
          company_id: this.companyId,
          patient_id: patientId,
          monthly_fee: this.pacienteDraft.monthly_fee || 0,
          guarantor_name: guarantorName || null,
          guarantor_email: guarantorEmail || null,
          guarantor_document_id: guarantorDocumentId || null,
        };
        const { error: contractError } = await this.supabase.client
          .from('patient_contracts')
          .upsert(contractPayload, { onConflict: 'patient_id' });
        if (contractError && !this.isMissingRelationError(contractError, 'patient_contracts')) throw contractError;
        if (contractError && this.isMissingRelationError(contractError, 'patient_contracts')) {
          this.flash('Paciente guardado, pero la seccin de tutor/facturacion no est disponible porque falta la tabla de contratos en esta base de datos.');
        }
      }

      this.showPacienteModal = false;
      await this.loadData();
    } catch (error: any) {
      console.error('Error guardando paciente:', error);
      this.flash(`Error al guardar los datos del paciente.${error?.message ? ' ' + error.message : ''}`);
    } finally {
      this.savingPaciente = false;
    }
  }

  openInvoicesModal(pacienteView: any) {
    if (!this.ensureOperationalAccess()) return;
    this.selectedPatientForInvoices = pacienteView;
    this.selectedPatientInvoices = this.patientInvoices.filter(inv => inv.patient_id === pacienteView.id);
    this.showInvoicesModal = true;
  }

  async emitirCobro(pacienteView: any) {
    if (!this.ensureOperationalAccess()) return;
    if (!pacienteView.contract_id || !pacienteView.monthly_fee) {
      this.flash('Primero debes configurar la tarifa mensual (editar paciente) para emitir cobros.');
      return;
    }
    if (await this.confirmAction(`Generar un recordatorio de cobro (boleta) por ${pacienteView.monthly_fee} para ${pacienteView.nombreCompleto}?`)) {
      const payload = {
        company_id: this.companyId,
        patient_id: pacienteView.id,
        contract_id: pacienteView.contract_id,
        amount: pacienteView.monthly_fee,
        issue_date: new Date().toISOString().split('T')[0],
        due_date: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 5 das de vencimiento
        status: 'draft'
      };
      const { error } = await this.supabase.client.from('patient_invoices').insert(payload);
      if (error) {
        this.flash('Error al generar cobro.');
      } else {
        this.flash('Cobro generado correctamente. (En una siguiente etapa podrs enviarlo por email o PDF).');
        await this.loadData(); // Recargamos para que aparezca en el historial
      }
    }
  }

  async updateInvoiceStatus(invoice: any, status: string) {
    if (!this.ensureOperationalAccess()) return;
    const { error } = await this.supabase.client.from('patient_invoices').update({ status }).eq('id', invoice.id);
    if (error) {
      this.flash('Error al actualizar el estado.');
    } else {
      invoice.status = status;
    }
  }

  exportExpensesToCSV() {
    if (!this.gastos || this.gastos.length === 0) {
      this.flash('No hay gastos para exportar.');
      return;
    }

    const escapeCSV = (str: any) => `"${String(str || '').replace(/"/g, '""')}"`;
    const headers = 'Fecha,Categoria,Descripcion,Monto,Moneda';
    const rows = this.gastos.map(g => 
      [
        g.expense_date,
        g.category,
        g.description,
        g.amount,
        g.currency
      ].map(escapeCSV).join(',')
    );

    const csvContent = [headers, ...rows].join('\n');
    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `gastos_operativos_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  }

  // --- GESTIN DE GASTOS ---

  openGastoModal(gasto?: any) {
    if (!this.ensureOperationalAccess()) return;
    if (gasto) {
      this.gastoDraft = { ...gasto, expense_date: gasto.expense_date ? new Date(gasto.expense_date).toISOString().split('T')[0] : '' };
    } else {
      this.gastoDraft = { id: null, category: 'Operativos', amount: null, expense_date: new Date().toISOString().split('T')[0], description: '' };
    }
    this.showGastoModal = true;
  }

  async saveGasto() {
    if (!this.ensureOperationalAccess()) return;
    if (!this.companyId || !this.gastoDraft.amount || !this.gastoDraft.expense_date) {
      this.flash('El monto y la fecha del gasto son obligatorios.');
      return;
    }
    this.savingGasto = true;
    try {
      const payload = {
        company_id: this.companyId,
        category: this.gastoDraft.category,
        amount: this.gastoDraft.amount,
        expense_date: this.gastoDraft.expense_date,
        description: this.gastoDraft.description || null,
        created_by: this.auth.user?.id
      };

      let error;
      if (this.gastoDraft.id) {
        const res = await this.supabase.client.from('company_expenses').update(payload).eq('id', this.gastoDraft.id);
        error = res.error;
      } else {
        const res = await this.supabase.client.from('company_expenses').insert(payload);
        error = res.error;
      }

      if (error) throw error;
      this.showGastoModal = false;
      await this.loadData();
    } catch (error) {
      console.error('Error guardando gasto:', error);
      this.flash('Error al guardar el gasto.');
    } finally {
      this.savingGasto = false;
    }
  }

  async deleteGasto(gasto: any) {
    if (!this.ensureOperationalAccess()) return;
    if (!await this.confirmAction('Estas seguro de eliminar este registro de gasto?')) return;
    const { error } = await this.supabase.client.from('company_expenses').delete().eq('id', gasto.id);
    if (error) this.flash('Error al eliminar el gasto.');
    else await this.loadData();
  }

  // --- GESTIN DE TAREAS ---

  openTareaModal(tarea?: any) {
    if (!this.ensureOperationalAccess()) return;
    if (tarea) {
      this.tareaDraft = { 
        id: tarea.id,
        title: tarea.title,
        employee_id: tarea.employee_id,
        due_at: tarea.due_at ? new Date(tarea.due_at).toISOString().split('T')[0] : null,
        status: tarea.status,
        priority: tarea.priority || 'medium',
        entity_type: tarea.entity_type || null,
        entity_id: tarea.entity_id || null,
        entity_label: tarea.entity_label || ''
      };
    } else {
      this.tareaDraft = {
        id: null,
        title: '',
        employee_id: null,
        due_at: null,
        status: 'pending',
        priority: 'medium',
        entity_type: null,
        entity_id: null,
        entity_label: ''
      };
    }
    this.showTareaModal = true;
  }

  async saveTarea() {
    if (!this.ensureOperationalAccess()) return;
    if (!this.tareaDraft.title?.trim() || !this.tareaDraft.employee_id) {
      this.flash('El titulo de la tarea y el empleado asignado son obligatorios.');
      return;
    }
    this.savingTarea = true;
    try {
      const payload: any = {
        title: this.tareaDraft.title,
        employee_id: this.tareaDraft.employee_id,
        due_at: this.tareaDraft.due_at || null,
        status: this.tareaDraft.status || 'pending',
        priority: this.tareaDraft.priority || 'medium',
        entity_type: this.tareaDraft.entity_type || null,
        entity_id: this.tareaDraft.entity_id || null,
        entity_label: this.resolveTaskEntityLabel()
      };

      let error;
      if (this.tareaDraft.id) {
        const res = await this.supabase.client.from('care_tasks').update(payload).eq('id', this.tareaDraft.id);
        error = res.error;
      } else {
        payload.created_by = this.auth.user?.id; // Obligatorio al crear
        const res = await this.supabase.client.from('care_tasks').insert(payload);
        error = res.error;
      }

      if (error) throw error;

      this.showTareaModal = false;
      await this.loadData();
    } catch (error) {
      console.error('Error guardando la tarea:', error);
      this.flash(`No se pudo guardar la tarea. Revisa la consola para ms detalles. Error: ${(error as any).message}`);
    } finally {
      this.savingTarea = false;
    }
  }

  async deleteTarea(tarea: any) {
    if (!this.ensureOperationalAccess()) return;
    if (!await this.confirmAction(`Estas seguro de eliminar esta tarea?`)) return;
    const { error } = await this.supabase.client.from('care_tasks').delete().eq('id', tarea.id);
    if (error) this.flash('Error al eliminar la tarea.');
    else await this.loadData();
  }
  onTaskEntityTypeChange() {
    this.tareaDraft.entity_id = null;
    this.tareaDraft.entity_label = '';
  }

  onTaskEntitySelectionChange() {
    this.tareaDraft.entity_label = this.resolveTaskEntityLabel() || '';
  }

  getTaskEntityOptions() {
    switch (this.tareaDraft.entity_type) {
      case 'lead':
        return this.leads.map(lead => ({
          id: lead.id,
          label: `${lead.nombre}${lead.comuna ? '  ' + lead.comuna : ''}`
        }));
      case 'sede':
        return this.sedes.map(sede => ({
          id: sede.id,
          label: `${sede.nombre}${sede.ubicacion ? '  ' + sede.ubicacion : ''}`
        }));
      case 'cama':
        return this.camasDetalle.map(cama => ({
          id: cama.dbId,
          label: `${cama.id}  ${cama.sede}`
        }));
      case 'paciente':
        return this.pacientesActivos.map(p => ({
          id: p.id,
          label: p.nombreCompleto
        }));
      default:
        return [];
    }
  }

  private resolveTaskEntityLabel(): string | null {
    if (!this.tareaDraft.entity_type || !this.tareaDraft.entity_id) return null;
    const selected = this.getTaskEntityOptions().find((option: any) => option.id === this.tareaDraft.entity_id);
    return selected?.label || this.tareaDraft.entity_label || null;
  }

  isSelectedEntity(type: 'lead' | 'sede' | 'cama' | 'paciente', id: string | null | undefined) {
    return this.selectedEntityType === type && !!id && this.selectedEntityId === id;
  }

  clearSelectedEntity() {
    this.selectedEntityType = null;
    this.selectedEntityId = null;
  }

  get onboardingCompletedCount() {
    return this.onboardingSteps.filter((step) => step.completed).length;
  }

  get onboardingProgressPercent() {
    if (!this.onboardingSteps.length) return 0;
    return Math.round((this.onboardingCompletedCount / this.onboardingSteps.length) * 100);
  }

  get completedOnboardingProjectsCount() {
    return this.onboardingProjects.filter((project) => project.status === 'completed').length;
  }

  get onboardingPendingCount() {
    return this.onboardingSteps.filter((step) => !step.completed).length;
  }

  get onboardingSummaryLabel() {
    if (!this.onboardingSteps.length) return 'Sin tareas creadas';
    return `${this.onboardingPendingCount} pendiente${this.onboardingPendingCount === 1 ? '' : 's'} de ${this.onboardingSteps.length}`;
  }

  async loadErpOperationalModules(companyId = this.companyId) {
    if (!companyId) return;
    this.configLoading = true;
    try {
      const [
        categoriesRes,
        statusesRes,
        templatesRes,
        slasRes,
        paramsRes,
        documentsRes,
        commentsRes,
        onboardingRes,
        invitationsRes,
        brandingRes
      ] = await Promise.all([
        this.supabase.client.from('system_categories').select('*').eq('company_id', companyId).order('sort_order'),
        this.supabase.client.from('system_statuses').select('*').eq('company_id', companyId).order('sort_order'),
        this.supabase.client.from('email_templates').select('*').eq('company_id', companyId).order('created_at', { ascending: false }),
        this.supabase.client.from('plan_slas').select('*').eq('company_id', companyId).order('plan_tier'),
        this.supabase.client.from('business_parameters').select('*').eq('company_id', companyId).order('key'),
        this.supabase.client.from('company_documents').select('*, uploaded:profiles!uploaded_by(full_name, email)').eq('company_id', companyId).order('created_at', { ascending: false }),
        this.supabase.client.from('entity_comments').select('*, author:profiles!created_by(full_name, email)').eq('company_id', companyId).order('created_at', { ascending: false }).limit(20),
        this.supabase.client.from('onboarding_projects').select('*, owner:profiles!owner_id(full_name, email), steps:onboarding_steps(*)').eq('company_id', companyId).order('created_at', { ascending: false }),
        this.supabase.client.from('company_invitations').select('*').eq('company_id', companyId).order('created_at', { ascending: false }),
        this.supabase.client.from('company_branding').select('*').eq('company_id', companyId).maybeSingle()
      ]);

      const results = [categoriesRes, statusesRes, templatesRes, slasRes, paramsRes, documentsRes, commentsRes, onboardingRes, invitationsRes, brandingRes];
      const failed = results.find((result) => result.error);
      if (failed?.error) {
        console.warn('Algunos modulos ERP an no estn disponibles. Aplicaste la migracin 020?', failed.error.message);
      }

      this.systemCategories = categoriesRes.data || [];
      this.systemStatuses = statusesRes.data || [];
      this.emailTemplates = templatesRes.data || [];
      this.planSlas = slasRes.data || [];
      this.businessParameters = paramsRes.data || [];
      this.companyDocuments = documentsRes.data || [];
      this.entityComments = commentsRes.data || [];
      this.onboardingProjects = onboardingRes.data || [];
      if (!this.onboardingStepDraft.project_id && this.onboardingProjects.length) {
        this.onboardingStepDraft.project_id = this.onboardingProjects[0].id;
      }
      if (this.onboardingStepDraft.project_id && !this.onboardingProjects.some((project) => project.id === this.onboardingStepDraft.project_id)) {
        this.onboardingStepDraft.project_id = this.onboardingProjects[0]?.id || null;
      }
      this.onboardingSteps = this.onboardingProjects
        .flatMap((project) => (project.steps || []).map((step: any) => ({ ...step, project })))
        .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
      this.companyInvitations = invitationsRes.data || [];
      if (brandingRes.data) {
        this.brandingDraft = { ...this.brandingDraft, ...brandingRes.data };
      }
    } finally {
      this.configLoading = false;
    }
  }

  get filteredConfigRows() {
    const term = this.configSearch.trim().toLowerCase();
    const groups = [
      ...this.systemCategories.map(item => ({ type: 'Categoria', title: item.name, detail: item.scope })),
      ...this.systemStatuses.map(item => ({ type: 'Estado', title: item.label, detail: item.scope })),
      ...this.emailTemplates.map(item => ({ type: 'Email', title: item.name, detail: item.subject })),
      ...this.planSlas.map(item => ({ type: 'SLA', title: item.plan_tier, detail: `${item.request_response_hours}h respuesta` })),
      ...this.businessParameters.map(item => ({ type: 'Parametro', title: item.label, detail: item.key })),
      ...this.companyDocuments.map(item => ({ type: 'Documento', title: item.title, detail: item.document_type })),
      ...this.companyInvitations.map(item => ({ type: 'Invitacin', title: item.email, detail: item.status }))
    ];
    if (!term) return groups.slice(0, 12);
    return groups.filter(row =>
      `${row.type} ${row.title} ${row.detail}`.toLowerCase().includes(term)
    ).slice(0, 20);
  }

  applyThemePreset(preset: 'care' | 'clinical' | 'corporate' | 'warm') {
    const presets = {
      care: {
        erp_primary_color: '#123c4a',
        erp_accent_color: '#f27a5e',
        erp_background_color: '#f8fafc',
        erp_surface_color: '#ffffff',
        erp_text_color: '#0f172a',
        erp_button_style: 'solid',
        erp_radius: 'compact',
        erp_density: 'comfortable'
      },
      clinical: {
        erp_primary_color: '#0f766e',
        erp_accent_color: '#14b8a6',
        erp_background_color: '#f0fdfa',
        erp_surface_color: '#ffffff',
        erp_text_color: '#134e4a',
        erp_button_style: 'soft',
        erp_radius: 'rounded',
        erp_density: 'comfortable'
      },
      corporate: {
        erp_primary_color: '#1d4ed8',
        erp_accent_color: '#0f172a',
        erp_background_color: '#f8fafc',
        erp_surface_color: '#ffffff',
        erp_text_color: '#111827',
        erp_button_style: 'outline',
        erp_radius: 'compact',
        erp_density: 'compact'
      },
      warm: {
        erp_primary_color: '#9a3412',
        erp_accent_color: '#ea580c',
        erp_background_color: '#fff7ed',
        erp_surface_color: '#ffffff',
        erp_text_color: '#1f2937',
        erp_button_style: 'solid',
        erp_radius: 'rounded',
        erp_density: 'spacious'
      }
    };
    this.brandingDraft = { ...this.brandingDraft, ...presets[preset] };
  }

  async saveBranding() {
    if (!this.companyId) return;
    const payload = {
      company_id: this.companyId,
      logo_url: this.brandingDraft.logo_url || null,
      primary_color: this.brandingDraft.erp_primary_color || this.brandingDraft.primary_color,
      secondary_color: this.brandingDraft.erp_accent_color || this.brandingDraft.secondary_color,
      erp_primary_color: this.normalizeHex(this.brandingDraft.erp_primary_color, '#123c4a'),
      erp_accent_color: this.normalizeHex(this.brandingDraft.erp_accent_color, '#f27a5e'),
      erp_background_color: this.normalizeHex(this.brandingDraft.erp_background_color, '#f8fafc'),
      erp_surface_color: this.normalizeHex(this.brandingDraft.erp_surface_color, '#ffffff'),
      erp_text_color: this.normalizeHex(this.brandingDraft.erp_text_color, '#0f172a'),
      erp_button_style: this.brandingDraft.erp_button_style || 'solid',
      erp_radius: this.brandingDraft.erp_radius || 'compact',
      erp_density: this.brandingDraft.erp_density || 'comfortable',
      erp_font_family: this.brandingDraft.erp_font_family || 'dm_sans'
    };
    const { error } = await this.supabase.client.from('company_branding').upsert(payload, { onConflict: 'company_id' });
    if (error) return this.flash('No se pudo guardar la apariencia del ERP.');
    this.brandingDraft = { ...this.brandingDraft, ...payload };
    this.flash('Apariencia guardada.');
  }

  async addCategory() {
    if (!this.companyId || !this.categoryDraft.name?.trim()) return;
    const { error } = await this.supabase.client.from('system_categories').insert({
      company_id: this.companyId,
      scope: this.categoryDraft.scope,
      name: this.categoryDraft.name.trim(),
      color: this.categoryDraft.color || null,
      created_by: this.auth.user?.id
    });
    if (error) return this.flash('No se pudo crear la categoria.');
    this.categoryDraft.name = '';
    await this.loadErpOperationalModules();
  }

  async addStatus() {
    if (!this.companyId || !this.statusDraft.code?.trim() || !this.statusDraft.label?.trim()) return;
    const { error } = await this.supabase.client.from('system_statuses').insert({
      company_id: this.companyId,
      scope: this.statusDraft.scope,
      code: this.statusDraft.code.trim().toLowerCase().replace(/\s+/g, '_'),
      label: this.statusDraft.label.trim(),
      color: this.statusDraft.color || null,
      is_terminal: !!this.statusDraft.is_terminal,
      created_by: this.auth.user?.id
    });
    if (error) return this.flash('No se pudo crear el estado.');
    this.statusDraft.code = '';
    this.statusDraft.label = '';
    this.statusDraft.is_terminal = false;
    await this.loadErpOperationalModules();
  }

  async addEmailTemplate() {
    if (!this.companyId || !this.emailTemplateDraft.code || !this.emailTemplateDraft.subject) return;
    const { error } = await this.supabase.client.from('email_templates').insert({
      company_id: this.companyId,
      code: this.emailTemplateDraft.code.trim().toLowerCase().replace(/\s+/g, '_'),
      name: this.emailTemplateDraft.name || this.emailTemplateDraft.code,
      subject: this.emailTemplateDraft.subject,
      body_html: this.emailTemplateDraft.body_html || '<p></p>',
      created_by: this.auth.user?.id
    });
    if (error) return this.flash('No se pudo crear la plantilla.');
    this.emailTemplateDraft = { code: '', name: '', subject: '', body_html: '' };
    await this.loadErpOperationalModules();
  }

  async addPlanSla() {
    if (!this.companyId || !this.planSlaDraft.plan_tier?.trim()) return;
    const { error } = await this.supabase.client.from('plan_slas').insert({
      company_id: this.companyId,
      plan_tier: this.planSlaDraft.plan_tier.trim(),
      request_response_hours: Number(this.planSlaDraft.request_response_hours) || 24,
      task_due_hours: Number(this.planSlaDraft.task_due_hours) || 72,
      escalation_hours: Number(this.planSlaDraft.escalation_hours) || 96,
      created_by: this.auth.user?.id
    });
    if (error) return this.flash('No se pudo crear el SLA.');
    this.planSlaDraft = { plan_tier: '', request_response_hours: 24, task_due_hours: 72, escalation_hours: 96 };
    await this.loadErpOperationalModules();
  }

  async addBusinessParameter() {
    if (!this.companyId || !this.parameterDraft.key?.trim()) return;
    let value: any = this.parameterDraft.value;
    if (this.parameterDraft.value_type === 'number') value = Number(value || 0);
    if (this.parameterDraft.value_type === 'boolean') value = value === true || value === 'true';
    if (this.parameterDraft.value_type === 'json') {
      try {
        value = JSON.parse(value || '{}');
      } catch {
        this.flash('El valor JSON no es vlido.');
        return;
      }
    }
    const { error } = await this.supabase.client.from('business_parameters').insert({
      company_id: this.companyId,
      key: this.parameterDraft.key.trim(),
      label: this.parameterDraft.label || this.parameterDraft.key,
      value,
      value_type: this.parameterDraft.value_type,
      description: this.parameterDraft.description || null,
      created_by: this.auth.user?.id
    });
    if (error) return this.flash('No se pudo guardar el parametro.');
    this.parameterDraft = { key: '', label: '', value: '', value_type: 'text', description: '' };
    await this.loadErpOperationalModules();
  }

  onDocumentFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    if (file) {
      const allowedTypes = new Set([
        'application/pdf',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/msword',
        'image/png',
        'image/jpeg'
      ]);
      const maxBytes = 12 * 1024 * 1024;
      if (!allowedTypes.has(file.type)) {
        input.value = '';
        this.selectedDocumentFile = null;
        return this.flash('Tipo de archivo no permitido. Usa PDF, Excel, Word, PNG o JPG.');
      }
      if (file.size > maxBytes) {
        input.value = '';
        this.selectedDocumentFile = null;
        return this.flash('El archivo supera 12 MB.');
      }
    }
    this.selectedDocumentFile = file;
    if (file && !this.documentDraft.title?.trim()) {
      this.documentDraft.title = file.name.replace(/\.[^/.]+$/, '');
    }
  }

  async addDocumentRecord() {
    if (!this.companyId || !this.documentDraft.title?.trim()) return;
    if (this.companyConfigMode && !this.selectedDocumentFile) {
      return this.flash('Selecciona un archivo para subir.');
    }
    this.uploadingDocument = true;

    let storagePath = this.documentDraft.storage_path || null;
    const file = this.selectedDocumentFile;

    if (file) {
      const safeName = file.name
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-zA-Z0-9._-]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .toLowerCase();
      storagePath = `${this.companyId}/${Date.now()}-${safeName || 'documento'}`;
      const { error: uploadError } = await this.supabase.client.storage
        .from('company-documents')
        .upload(storagePath, file, {
          cacheControl: '3600',
          contentType: file.type || undefined,
          upsert: false
        });

      if (uploadError) {
        this.uploadingDocument = false;
        return this.flash('No se pudo subir el archivo.');
      }
    }

    const { error } = await this.supabase.client.from('company_documents').insert({
      company_id: this.companyId,
      document_type: this.documentDraft.document_type,
      entity_type: this.documentDraft.entity_type || 'company',
      title: this.documentDraft.title.trim(),
      storage_path: storagePath,
      file_name: file?.name || (storagePath ? storagePath.split('/').pop() : null),
      mime_type: file?.type || null,
      size_bytes: file?.size || null,
      uploaded_by: this.auth.user?.id
    });
    this.uploadingDocument = false;
    if (error) return this.flash('No se pudo registrar el documento.');
    this.documentDraft = { document_type: 'company_file', title: '', entity_type: 'company', storage_path: '' };
    this.selectedDocumentFile = null;
    await this.loadErpOperationalModules();
  }

  async openCompanyDocument(doc: any) {
    const bucket = doc?.storage_bucket || 'company-documents';
    const path = doc?.storage_path;
    if (!path) return this.flash('Este documento no tiene archivo adjunto.');

    const { data, error } = await this.supabase.client.storage
      .from(bucket)
      .createSignedUrl(path, 60);

    if (error || !data?.signedUrl) {
      return this.flash('No se pudo abrir el documento.');
    }

    window.open(data.signedUrl, '_blank', 'noopener,noreferrer');
  }

  async updateCompanyDocumentStatus(doc: any, status: 'draft' | 'review' | 'approved' | 'archived') {
    const { error } = await this.supabase.client
      .from('company_documents')
      .update({ status })
      .eq('id', doc.id);
    if (error) return this.flash('No se pudo actualizar el documento.');
    doc.status = status;
    await this.loadErpOperationalModules();
  }

  async deleteCompanyDocument(doc: any) {
    if (!await this.confirmAction(`Eliminar "${doc.title}"? Esta accion no se puede deshacer.`)) return;
    const bucket = doc?.storage_bucket || 'company-documents';
    const path = doc?.storage_path;

    if (path) {
      const { error: storageError } = await this.supabase.client.storage.from(bucket).remove([path]);
      if (storageError) {
        return this.flash('No se pudo borrar el archivo del storage.');
      }
    }

    const { error } = await this.supabase.client.from('company_documents').delete().eq('id', doc.id);
    if (error) return this.flash('No se pudo eliminar el documento.');
    await this.loadErpOperationalModules();
  }

  formatBytes(bytes: number | null | undefined) {
    if (!bytes) return '';
    if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  }

  async addComment() {
    if (!this.companyId || !this.commentDraft.body?.trim()) return;
    const { error } = await this.supabase.client.from('entity_comments').insert({
      company_id: this.companyId,
      entity_type: this.commentDraft.entity_type,
      entity_id: this.commentDraft.entity_id || null,
      body: this.commentDraft.body.trim(),
      visibility: this.commentDraft.visibility,
      created_by: this.auth.user?.id
    });
    if (error) return this.flash('No se pudo agregar el comentario.');
    this.commentDraft.body = '';
    await this.loadErpOperationalModules();
  }

  async createOnboardingProject() {
    if (!this.companyId) return;
    const { data, error } = await this.supabase.client
      .from('onboarding_projects')
      .insert({
        company_id: this.companyId,
        title: this.onboardingDraft.title || 'Activacion de empresa',
        starts_at: this.onboardingDraft.starts_at || null,
        owner_id: this.auth.user?.id,
        created_by: this.auth.user?.id,
        status: 'active'
      })
      .select('id')
      .single();
    if (error) return this.flash('No se pudo crear el onboarding.');

    const defaultSteps = [
      { step_key: 'company_profile', title: 'Completar ficha empresa', sort_order: 1 },
      { step_key: 'upload_employees', title: 'Cargar colaboradores', sort_order: 2 },
      { step_key: 'benefits_setup', title: 'Configurar beneficios y SLA', sort_order: 3 },
      { step_key: 'review_employees', title: 'Revisar colaboradores', sort_order: 4 }
    ];
    await this.supabase.client.from('onboarding_steps').insert(
      defaultSteps.map(step => ({ ...step, project_id: data.id }))
    );
    this.onboardingStepDraft.project_id = data.id;
    await this.loadErpOperationalModules();
  }

  async addOnboardingStep() {
    if (!this.onboardingStepDraft.project_id || !this.onboardingStepDraft.title?.trim()) return;
    const stepKey = this.onboardingStepDraft.step_key?.trim() || this.onboardingStepDraft.title.trim().toLowerCase().replace(/\s+/g, '_');
    const { error } = await this.supabase.client.from('onboarding_steps').insert({
      project_id: this.onboardingStepDraft.project_id,
      step_key: stepKey,
      title: this.onboardingStepDraft.title.trim(),
      description: this.onboardingStepDraft.description || null,
      sort_order: this.onboardingSteps.length + 1
    });
    if (error) return this.flash('No se pudo crear el paso.');
    this.onboardingStepDraft = { project_id: this.onboardingStepDraft.project_id, title: '', description: '', step_key: '' };
    await this.loadErpOperationalModules();
  }

  async toggleOnboardingStep(step: any) {
    const completed = !step.completed;
    const { error } = await this.supabase.client.from('onboarding_steps').update({
      completed,
      completed_by: completed ? this.auth.user?.id : null,
      completed_at: completed ? new Date().toISOString() : null
    }).eq('id', step.id);
    if (error) return this.flash('No se pudo actualizar el paso.');
    await this.syncOnboardingProjectStatus(step.project_id);
    await this.loadErpOperationalModules();
  }

  private async syncOnboardingProjectStatus(projectId: string) {
    const { data, error } = await this.supabase.client
      .from('onboarding_steps')
      .select('completed')
      .eq('project_id', projectId);
    if (error || !data?.length) return;

    const isCompleted = data.every((step) => step.completed);
    await this.supabase.client
      .from('onboarding_projects')
      .update({
        status: isCompleted ? 'completed' : 'active',
        completed_at: isCompleted ? new Date().toISOString() : null
      })
      .eq('id', projectId);
  }

  exportConfigSnapshotToCSV() {
    const rows = this.filteredConfigRows;
    if (!rows.length) return;
    const escapeCSV = (value: string) => `"${String(value || '').replace(/"/g, '""')}"`;
    const csv = ['Tipo,Nombre,Detalle', ...rows.map(row => [row.type, row.title, row.detail].map(escapeCSV).join(','))].join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `configuracion_erp_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
  }

  private normalizeHex(value: string | null | undefined, fallback: string) {
    if (!value || !/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(value)) return fallback;
    if (value.length === 4) {
      return `#${value[1]}${value[1]}${value[2]}${value[2]}${value[3]}${value[3]}`;
    }
    return value;
  }

  private hexToRgba(hex: string, alpha: number) {
    const normalized = this.normalizeHex(hex, '#123c4a').replace('#', '');
    const red = parseInt(normalized.slice(0, 2), 16);
    const green = parseInt(normalized.slice(2, 4), 16);
    const blue = parseInt(normalized.slice(4, 6), 16);
    return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
  }

  private mixHex(baseHex: string, blendHex: string, weight: number) {
    const base = this.normalizeHex(baseHex, '#f8fafc').replace('#', '');
    const blend = this.normalizeHex(blendHex, '#ffffff').replace('#', '');
    const mix = (start: number, end: number) => Math.round(start + (end - start) * weight);
    const channels = [0, 2, 4].map(index => {
      const value = mix(parseInt(base.slice(index, index + 2), 16), parseInt(blend.slice(index, index + 2), 16));
      return value.toString(16).padStart(2, '0');
    });
    return `#${channels.join('')}`;
  }

  private resolveThemeFont() {
    if (this.brandingDraft.erp_font_family === 'system') return 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
    if (this.brandingDraft.erp_font_family === 'inter') return 'Inter, "DM Sans", sans-serif';
    return '"DM Sans", sans-serif';
  }

  setConfigSection(section: ConfigSection) {
    const companySections: ConfigSection[] = ['company', 'appearance', 'documents', 'messages'];
    if (this.companyConfigMode && !companySections.includes(section)) {
      this.configSection = 'company';
      return;
    }
    if ((section as string) === 'onboarding') {
      this.configSection = this.companyConfigMode ? 'company' : 'messages';
      return;
    }
    if (section === 'workflow' && (this.hideWorkflowConfig || this.companyConfigMode)) {
      this.configSection = this.companyConfigMode ? 'company' : 'business';
      return;
    }
    this.configSection = section;
  }
}
