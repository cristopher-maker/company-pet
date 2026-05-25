import { Component, OnDestroy, OnInit, ViewEncapsulation } from '@angular/core';
import { SupabaseService } from '../../core/services/supabase.service';
import { UiService } from '../../core/services/ui.service';

type CareRequestRow = {
  id: string;
  topic: string;
  channel: string;
  status: 'open' | 'assigned' | 'in_progress' | 'resolved' | 'closed';
  created_at: string;
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

  private unsub?: { data: { subscription: { unsubscribe: () => void } } };

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
        .from('care_requests')
        .select('id, topic, channel, status, created_at')
        .eq('employee_id', userId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      this.items = (data ?? []) as CareRequestRow[];
      const totalPages = this.totalPages;
      if (this.currentPage > totalPages) this.currentPage = totalPages;
    } catch (err: any) {
      this.error = err.message;
    } finally {
      this.loading = false;
    }
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
