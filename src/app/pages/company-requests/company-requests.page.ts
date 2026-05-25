import { Component, OnDestroy, OnInit } from '@angular/core';
import { SupabaseService } from '../../core/services/supabase.service';
import { UiService } from '../../core/services/ui.service';

type CompanyRequestRow = {
  id: string;
  topic: string;
  channel: string;
  status: string;
  created_at: string;
  employee_name: string | null;
  employee_email: string | null;
};

@Component({
  selector: 'app-company-requests',
  templateUrl: './company-requests.page.html',
  styleUrls: ['./company-requests.page.scss'],
})
export class CompanyRequestsPage implements OnInit, OnDestroy {
  public loading = true;
  public error: string | null = null;
  public items: CompanyRequestRow[] = [];
  public companyName: string | null = null;

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

    try {
      const { data, error } = await this.supabase.client.rpc('get_company_requests');
      if (error) throw error;

      this.items = (data ?? []) as CompanyRequestRow[];
      if (this.items.length > 0) {
        // This is a simplification; in a real app, you'd get the company name properly.
        this.companyName = 'tu Empresa';
      }
    } catch (err: any) {
      this.error = err.message;
    } finally {
      this.loading = false;
    }
  }

  public get totalRequests(): number {
    return this.items.length;
  }

  public get openRequests(): number {
    return this.items.filter((item) => item.status === 'open' || item.status === 'assigned' || item.status === 'in_progress').length;
  }

  public get resolvedRequests(): number {
    return this.items.filter((item) => item.status === 'resolved' || item.status === 'closed').length;
  }

  public statusLabel(status: string): string {
    const labels: Record<string, string> = {
      open: 'Abierto',
      assigned: 'Asignado',
      in_progress: 'En curso',
      resolved: 'Resuelto',
      closed: 'Cerrado',
    };
    return labels[status] ?? status;
  }

  public statusClass(status: string): string {
    const normalized = status.replace(/_/g, '-');
    return `company-request-card__status--${normalized}`;
  }
}
