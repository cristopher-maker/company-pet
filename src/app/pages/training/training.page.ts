import { Component, OnInit } from '@angular/core';
import { AuthService } from '../../core/services/auth.service';
import { UiService } from '../../core/services/ui.service';
import { SupabaseService } from '../../core/services/supabase.service';

type TrainingTab = 'Cursos' | 'Eventos';
type CourseLevel = 'Básico' | 'Intermedio';

type DbCourse = {
  id: string;
  title: string;
  duration_minutes: number;
  level: CourseLevel;
};

type DbEnrollment = {
  course_id: string | null;
  status: 'enrolled' | 'completed' | 'canceled';
  progress_percent: number;
  last_accessed_at: string | null;
};

type CourseState = 'not_started' | 'in_progress' | 'completed';

type CourseCard = {
  id: string;
  title: string;
  duration: string;
  level: CourseLevel;
  state: CourseState;
  progress: number;
  lastAccessedAt: number | null;
  isActive: boolean;
  actionLabel: string;
  actionArrow: boolean;
};

type EventItem = {
  id: string;
  title: string;
  date: string;
  format: 'Online' | 'Presencial';
};

@Component({
  selector: 'app-training',
  templateUrl: './training.page.html',
  styleUrls: ['./training.page.scss'],
})
export class TrainingPage implements OnInit {
  public tab: TrainingTab = 'Cursos';
  public isStaff = false;

  public courses: DbCourse[] = [];
  public enrollments: DbEnrollment[] = [];

  public readonly events: EventItem[] = [
    {
      id: 'e1',
      title: 'Webinar: navegación de beneficios y financiación',
      date: 'Próximamente',
      format: 'Online',
    },
    {
      id: 'e2',
      title: 'Taller: conversaciones difíciles en familia',
      date: 'Próximamente',
      format: 'Online',
    },
  ];

  constructor(
    private readonly auth: AuthService,
    private readonly supabase: SupabaseService,
    public readonly ui: UiService
  ) {}

  public get userId(): string | null {
    return this.auth.user?.id ?? null;
  }

  public get completedCount(): number {
    return this.courseCards.filter((c) => c.state === 'completed').length;
  }

  public get overallProgressPercent(): number {
    const total = this.courses.length;
    if (!total) return 0;
    return Math.round((this.completedCount / total) * 100);
  }

  public get inProgressCount(): number {
    return this.courseCards.filter((c) => c.state === 'in_progress').length;
  }

  public get notStartedCount(): number {
    return this.courseCards.filter((c) => c.state === 'not_started').length;
  }

  public get courseCards(): CourseCard[] {
    const byCourseId = new Map<string, DbEnrollment>();
    for (const e of this.enrollments) {
      if (e.course_id) byCourseId.set(e.course_id, e);
    }

    const cards = this.courses.map((c) => {
      const e = byCourseId.get(c.id) ?? null;
      const progress = Math.max(0, Math.min(100, e?.progress_percent ?? 0));
      const state: CourseState =
        e?.status === 'completed' || progress >= 100 ? 'completed' : progress > 0 ? 'in_progress' : 'not_started';

      const lastAccessedAt = e?.last_accessed_at ? Date.parse(e.last_accessed_at) : null;

      const actionLabel = state === 'completed' ? 'Repasar' : state === 'in_progress' ? 'Continuar' : 'Iniciar';
      const actionArrow = state !== 'completed';

      return {
        id: c.id,
        title: c.title,
        duration: `${c.duration_minutes} min`,
        level: c.level,
        state,
        progress,
        lastAccessedAt,
        isActive: false,
        actionLabel,
        actionArrow,
      };
    });

    const activeId = this.pickActiveCourseId(cards);
    for (const card of cards) card.isActive = card.id === activeId;
    return cards;
  }

  private pickActiveCourseId(cards: CourseCard[]): string | null {
    const withLast = cards.filter((c) => c.lastAccessedAt != null);
    if (withLast.length) {
      withLast.sort((a, b) => (b.lastAccessedAt ?? 0) - (a.lastAccessedAt ?? 0));
      return withLast[0]!.id;
    }

    const inProgress = cards.find((c) => c.state === 'in_progress');
    return inProgress?.id ?? null;
  }

  public async ngOnInit(): Promise<void> {
    await this.loadData();
  }

  private async loadData(): Promise<void> {
    await this.loadRole();

    const { data: courseData, error: courseError } = await this.supabase.client
      .from('training_courses')
      .select('id,title,duration_minutes,level')
      .eq('active', true)
      .order('created_at', { ascending: true });
    if (courseError) throw courseError;
    this.courses = (courseData ?? []) as DbCourse[];

    const userId = this.userId;
    if (!userId) {
      this.enrollments = [];
      return;
    }

    const { data: enrollmentData, error: enrollmentError } = await this.supabase.client
      .from('training_enrollments')
      .select('course_id,status,progress_percent,last_accessed_at')
      .eq('user_id', userId)
      .not('course_id', 'is', null);
    if (enrollmentError) throw enrollmentError;
    this.enrollments = (enrollmentData ?? []) as DbEnrollment[];
  }

  private async loadRole(): Promise<void> {
    const userId = this.userId;
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

  public async onCourseAction(course: CourseCard): Promise<void> {
    if (!this.userId) return;

    if (course.state === 'not_started') {
      await this.startCourse(course.id);
    } else if (course.state === 'in_progress') {
      await this.advanceCourse(course.id, course.progress);
    } else {
      await this.touchCourse(course.id);
    }

    await this.loadData();
  }

  private async startCourse(courseId: string): Promise<void> {
    const userId = this.userId!;
    const now = new Date().toISOString();

    const { error } = await this.supabase.client.from('training_enrollments').upsert(
      {
        user_id: userId,
        course_id: courseId,
        status: 'enrolled',
        progress_percent: 5,
        last_accessed_at: now,
      } as any,
      { onConflict: 'user_id,course_id' }
    );
    if (error) throw error;
  }

  private async advanceCourse(courseId: string, currentProgress: number): Promise<void> {
    const userId = this.userId!;
    const next = Math.min(100, Math.max(0, currentProgress) + 15);
    const now = new Date().toISOString();

    const { error } = await this.supabase.client
      .from('training_enrollments')
      .update({
        progress_percent: next,
        status: next >= 100 ? 'completed' : 'enrolled',
        last_accessed_at: now,
      } as any)
      .eq('user_id', userId)
      .eq('course_id', courseId);
    if (error) throw error;
  }

  private async touchCourse(courseId: string): Promise<void> {
    const userId = this.userId!;
    const now = new Date().toISOString();

    const { error } = await this.supabase.client
      .from('training_enrollments')
      .update({ last_accessed_at: now } as any)
      .eq('user_id', userId)
      .eq('course_id', courseId);
    if (error) throw error;
  }

  public trackById(_: number, item: { id: string }): string {
    return item.id;
  }

  public courseStateIcon(state: CourseState): string {
    if (state === 'completed') return 'task_alt';
    if (state === 'in_progress') return 'play_circle';
    return 'lock';
  }

  public courseStateClass(state: CourseState): string {
    return state;
  }
}
