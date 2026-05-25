import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { SupabaseService } from '../../core/services/supabase.service';
import { UiService } from '../../core/services/ui.service';

@Component({
  selector: 'app-tasks',
  templateUrl: './tasks.page.html',
  styleUrls: ['./tasks.page.scss'],
})
export class TasksPage implements OnInit {
  tasks: any[] = [];
  loading = true;
  companyId: string | null = null;
  filters = {
    status: 'all',
    entity: 'all'
  };

  constructor(
    public ui: UiService,
    private auth: AuthService,
    private supabase: SupabaseService,
    private router: Router
  ) {}

  async ngOnInit() {
    await this.loadTasks();
  }

  async loadTasks() {
    this.loading = true;
    try {
      const user = this.auth.user;
      if (!user) return;

      // Obtener el ID de la empresa del usuario para poder registrar los eventos
      const { data: memberData } = await this.supabase.client
        .from('company_members')
        .select('company_id')
        .eq('user_id', user.id)
        .maybeSingle();
      this.companyId = memberData?.company_id;

      const { data, error } = await this.supabase.client
        .from('care_tasks')
        .select('*')
        .eq('employee_id', user.id)
        .order('due_at', { ascending: true });

      if (error) throw error;
      
      // Ordenar para que las pendientes salgan arriba, completadas al final,
      // y las de alta prioridad primero.
      const priorityWeight: Record<string, number> = { high: 3, medium: 2, low: 1 };

      this.tasks = (data || []).sort((a, b) => {
        // 1. Completadas al final
        if (a.status === 'done' && b.status !== 'done') return 1;
        if (a.status !== 'done' && b.status === 'done') return -1;
        
        // 2. Si no están completadas, ordenar por prioridad (mayor a menor)
        if (a.status !== 'done' && b.status !== 'done') {
          const pA = priorityWeight[a.priority] || 0;
          const pB = priorityWeight[b.priority] || 0;
          if (pA !== pB) return pB - pA;
        }

        return 0;
      });
    } catch (error) {
      console.error('Error cargando tareas:', error);
    } finally {
      this.loading = false;
    }
  }

  get filteredTasks() {
    return this.tasks.filter((task) => {
      const matchesStatus = this.filters.status === 'all' || task.status === this.filters.status;
      const matchesEntity = this.filters.entity === 'all' || (task.entity_type || 'none') === this.filters.entity;
      return matchesStatus && matchesEntity;
    });
  }

  async updateStatus(task: any, newStatus: string) {
    try {
      const { error } = await this.supabase.client.from('care_tasks').update({ status: newStatus }).eq('id', task.id);
      if (error) throw error;
      task.status = newStatus;

      // Si la tarea se marcó como completada, registramos el evento en las analíticas
      if (newStatus === 'done' && this.companyId) {
        await this.supabase.client.from('analytics_events').insert({
          company_id: this.companyId,
          user_id: this.auth.user?.id,
          event_name: `Completó la tarea: ${task.title}`,
          metadata: { task_id: task.id }
        });
      }
      
    } catch (error) {
      console.error('Error actualizando tarea:', error);
      alert('No se pudo actualizar la tarea.');
    }
  }

  isOverdue(dateString: string): boolean {
    if (!dateString) return false;
    const due = new Date(dateString);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return due < today;
  }

  openLinkedEntity(task: any) {
    if (!task?.entity_type || !task?.entity_id) return;

    const targetViewMap: Record<string, string> = {
      lead: 'admisiones',
      sede: 'sedes',
      cama: 'camas',
      paciente: 'pacientes'
    };

    const view = targetViewMap[task.entity_type];
    if (!view) return;

    this.router.navigate(['/admin'], {
      queryParams: {
        view,
        entityType: task.entity_type,
        entityId: task.entity_id
      }
    });
  }
}
