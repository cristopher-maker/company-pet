import { Component, OnDestroy, OnInit } from '@angular/core';

import { UiService } from '../../core/services/ui.service';
import { SupabaseService } from '../../core/services/supabase.service';

type VoucherRow = {
  id: string;
  code: string;
  title: string;
  description: string | null;
  discount_type: string;
  discount_value: number | null;
  currency: string;
  active: boolean;
};

@Component({
  selector: 'app-vouchers',
  templateUrl: './vouchers.page.html',
  styleUrls: ['./vouchers.page.scss'],
})
export class VouchersPage implements OnInit, OnDestroy {
  public loading = true;
  public error: string | null = null;
  public items: VoucherRow[] = [];

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
    if (!sessionData.session) {
      this.loading = false;
      this.items = [];
      return;
    }

    const { data, error } = await this.supabase.client
      .from('vouchers')
      .select('id, code, title, description, discount_type, discount_value, currency, active')
      .eq('active', true)
      .order('title', { ascending: true });

    this.loading = false;
    if (error) {
      this.error = error.message;
      return;
    }

    this.items = (data ?? []) as VoucherRow[];
  }

  public get percentageCount(): number {
    return this.items.filter((item) => item.discount_type === 'percentage').length;
  }

  public get fixedAmountCount(): number {
    return this.items.filter((item) => item.discount_type === 'fixed_amount').length;
  }

  public discountLabel(item: VoucherRow): string {
    if (item.discount_type === 'percentage') {
      return `${item.discount_value ?? 0}% OFF`;
    }

    const currency = item.currency || 'CLP';
    const amount = new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
    }).format(item.discount_value ?? 0);

    return `${amount} OFF`;
  }
}
