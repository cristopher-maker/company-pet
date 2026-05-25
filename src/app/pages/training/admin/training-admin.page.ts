import { Component, OnInit } from '@angular/core';
import { AuthService } from '../../../core/services/auth.service';
import { SupabaseService } from '../../../core/services/supabase.service';

type CourseLevel = 'Básico' | 'Intermedio';

type DbCourse = {
  id: string;
  title: string;
  description: string | null;
  duration_minutes: number;
  level: CourseLevel;
  active: boolean;
  created_at: string;
};

type CourseDraft = {
  id: string | null;
  title: string;
  description: string;
  durationMinutes: number | null;
  level: CourseLevel;
  active: boolean;
};

@Component({
  selector: 'app-training-admin',
  templateUrl: './training-admin.page.html',
  styleUrls: ['./training-admin.page.scss'],
})
export class TrainingAdminPage implements OnInit {
  public isStaff = false;
  public loading = true;
  public saving = false;

  public courses: DbCourse[] = [];

  public draft: CourseDraft = this.newDraft();

  constructor(
    private readonly auth: AuthService,
    private readonly supabase: SupabaseService
  ) {}

  public async ngOnInit(): Promise<void> {
    await this.load();
  }

  private newDraft(): CourseDraft {
    return {
      id: null,
      title: '',
      description: '',
      durationMinutes: null,
      level: 'Básico',
      active: true,
    };
  }

  public resetDraft(): void {
    this.draft = this.newDraft();
  }

  public selectCourse(c: DbCourse): void {
    this.draft = {
      id: c.id,
      title: c.title,
      description: c.description ?? '',
      durationMinutes: c.duration_minutes,
      level: c.level,
      active: c.active,
    };
  }

  private async load(): Promise<void> {
    this.loading = true;
    try {
      await this.loadRole();
      await this.loadCourses();
    } finally {
      this.loading = false;
    }
  }

  private async loadRole(): Promise<void> {
    const userId = this.auth.user?.id ?? null;
    if (!userId) {
      this.isStaff = false;
      return;
    }

    const { data, error } = await this.supabase.client
      .from('profiles')
      .select('role')
      .eq('id', userId)
      .maybeSingle();
    if (error) throw error;

    const role = (data?.role as string | undefined) ?? null;
    this.isStaff = role === 'admin' || role === 'company_admin' || role === 'pet_expert';
  }

  private async loadCourses(): Promise<void> {
    if (!this.isStaff) {
      this.courses = [];
      return;
    }

    const { data, error } = await this.supabase.client
      .from('training_courses')
      .select('id,title,description,duration_minutes,level,active,created_at')
      .order('created_at', { ascending: true });
    if (error) throw error;
    this.courses = (data ?? []) as DbCourse[];
  }

  public trackById(_: number, item: { id: string }): string {
    return item.id;
  }

  public async save(): Promise<void> {
    if (!this.isStaff) return;

    const title = this.draft.title.trim();
    if (!title) {
      alert('Ingresa un título.');
      return;
    }

    const duration = this.draft.durationMinutes ?? 0;
    if (!Number.isFinite(duration) || duration <= 0) {
      alert('Ingresa una duración válida en minutos.');
      return;
    }

    this.saving = true;
    try {
      if (this.draft.id) {
        const { error } = await this.supabase.client
          .from('training_courses')
          .update({
            title,
            description: this.draft.description.trim() || null,
            duration_minutes: duration,
            level: this.draft.level,
            active: this.draft.active,
          })
          .eq('id', this.draft.id);
        if (error) throw error;
      } else {
        const { error } = await this.supabase.client.from('training_courses').insert({
          title,
          description: this.draft.description.trim() || null,
          duration_minutes: duration,
          level: this.draft.level,
          active: this.draft.active,
        });
        if (error) throw error;
      }

      await this.loadCourses();
      this.resetDraft();
    } finally {
      this.saving = false;
    }
  }

  public async toggleActive(c: DbCourse): Promise<void> {
    if (!this.isStaff) return;

    const { error } = await this.supabase.client
      .from('training_courses')
      .update({ active: !c.active })
      .eq('id', c.id);
    if (error) throw error;
    await this.loadCourses();
  }
}
