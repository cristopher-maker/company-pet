import { Component, OnDestroy, OnInit } from '@angular/core'; // ✅ eliminado ChangeDetectorRef
import { SupabaseService } from '../../core/services/supabase.service';
import { UiService } from '../../core/services/ui.service';

type ProviderType = 'Hotel para mascotas' | 'Pet sitter a domicilio' | 'Servicio médico';
type Availability = 'Hoy' | 'Esta semana' | 'Sin cupo';
type SortKey = 'rating' | 'reviews' | 'price_low' | 'price_high';

type ProviderListingRow = {
  price_from: number | null;
  availability: Availability | null;
};

type ProviderRow = {
  id: string;
  name: string;
  type: ProviderType;
  area: string;
  verified: boolean;
  rating: number;
  metadata: Record<string, any> | null;
  provider_listings: ProviderListingRow[] | null;
};

type ProviderCard = {
  id: string;
  name: string;
  type: ProviderType;
  area: string;
  verified: boolean;
  rating: number;
  reviews: number;
  availability: Availability;
  priceFrom: number | null;
  description: string;
  website: string | null;
  imageUrl: string | null;
  images: string[];
  phone: string | null;
  email: string | null;
  address: string | null;
  placeId: string | null;
  whatsapp: string | null;
};

@Component({
  selector: 'app-providers',
  templateUrl: './providers.page.html',
  styleUrls: ['./providers.page.scss'],
})
export class ProvidersPage implements OnInit, OnDestroy {
  public loading = true;
  public error = '';

  public q = '';
  public type: ProviderType | 'Todos' = 'Todos';
  public verifiedOnly = true;
  public maxPrice = 1500000;
  public sortBy: SortKey = 'rating';

  public readonly types: ProviderType[] = ['Hotel para mascotas', 'Pet sitter a domicilio', 'Servicio médico'];
  public readonly sortOptions: Array<{ value: SortKey; label: string }> = [
    { value: 'rating', label: 'Mejor rating' },
    { value: 'reviews', label: 'Más reseñas' },
    { value: 'price_low', label: 'Menor precio' },
    { value: 'price_high', label: 'Mayor precio' },
  ];

  private allProviders: ProviderCard[] = [];
  public filteredProviders: ProviderCard[] = [];
  public visibleProviders: ProviderCard[] = [];
  public currentPage = 1;
  public pageSize = 12;
  public totalPages = 1;
  
  public averageRating = 0;
  public totalProviders = 0;
  public totalReviews = 0;
  public verifiedCount = 0;

  public selectedProvider: ProviderCard | null = null;
  public selectedProviderImages: string[] = [];
  public selectedProviderDistribution: Array<{ stars: number; value: number }> = [];
  
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

  public openProvider(provider: ProviderCard): void {
    this.selectedProvider = provider;
    this.selectedProviderImages = provider.images;
    
    const total = Math.max(provider.reviews, 1);
    const five = Math.round(total * Math.min(provider.rating / 5, 1) * 0.78);
    const four = Math.round(total * 0.14);
    const three = Math.round(total * 0.05);
    const two = Math.round(total * 0.02);
    const one = Math.max(total - (five + four + three + two), 0);
    this.selectedProviderDistribution = [
      { stars: 5, value: five },
      { stars: 4, value: four },
      { stars: 3, value: three },
      { stars: 2, value: two },
      { stars: 1, value: one },
    ];
  }

  public closeProvider(event?: Event): void {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    this.selectedProvider = null;
  }

  public removeSelectedImage(index: number): void {
    if (index < 0 || index >= this.selectedProviderImages.length) return;
    this.selectedProviderImages = this.selectedProviderImages.filter((_, currentIndex) => currentIndex !== index);
  }

  public async refresh(): Promise<void> {
    this.loading = true;
    this.error = '';
    try {
      const { data, error } = await this.supabase.client
        .from('providers')
        .select('id, name, type, area, verified, rating, metadata, provider_listings(price_from, availability)')
        .eq('active', true)
        .order('rating', { ascending: false });

      if (error) throw error;
      this.allProviders = ((data ?? []) as ProviderRow[]).map((row) => this.toProviderCard(row));

      const maxDetected = this.allProviders
        .map((provider) => provider.priceFrom ?? 0)
        .reduce((max, value) => Math.max(max, value), 0);
      if (maxDetected > 0) {
        this.maxPrice = Math.max(this.maxPrice, maxDetected);
      }
      
      this.calculateStats();
      this.applyFilters();
    } catch (err: any) {
      this.error = err?.message ?? 'No se pudieron cargar los proveedores.';
      this.allProviders = [];
      this.calculateStats();
      this.applyFilters();
      this.selectedProvider = null;
    } finally {
      this.loading = false;
    }
  }

  private calculateStats(): void {
    this.totalProviders = this.allProviders.length;
    this.verifiedCount = this.allProviders.filter((p) => p.verified).length;
    this.totalReviews = this.allProviders.reduce((sum, p) => sum + p.reviews, 0);

    if (this.allProviders.length) {
      const total = this.allProviders.reduce((sum, p) => sum + p.rating, 0);
      this.averageRating = Number((total / this.allProviders.length).toFixed(1));
    } else {
      this.averageRating = 0;
    }
  }

  public applyFilters(): void {
    const query = this.q.trim().toLowerCase();

    const filtered = this.allProviders
      .filter((provider) => (this.type === 'Todos' ? true : provider.type === this.type))
      .filter((provider) => (this.verifiedOnly ? provider.verified : true))
      .filter((provider) => (provider.priceFrom == null ? true : provider.priceFrom <= this.maxPrice))
      .filter((provider) => {
        if (!query) return true;
        return `${provider.name} ${provider.type} ${provider.area} ${provider.description}`
          .toLowerCase()
          .includes(query);
      });

    this.filteredProviders = [...filtered].sort((left, right) => {
      if (this.sortBy === 'reviews') return right.reviews - left.reviews;
      if (this.sortBy === 'price_low') {
        return (left.priceFrom ?? Number.MAX_SAFE_INTEGER) - (right.priceFrom ?? Number.MAX_SAFE_INTEGER);
      }
      if (this.sortBy === 'price_high') return (right.priceFrom ?? 0) - (left.priceFrom ?? 0);
      return right.rating - left.rating;
    });

    this.currentPage = 1; // Reset when filters change
    this.updateVisibleProviders();
  }

  private updateVisibleProviders(): void {
    this.totalPages = Math.ceil(this.filteredProviders.length / this.pageSize) || 1;
    if (this.currentPage > this.totalPages) {
      this.currentPage = this.totalPages;
    }
    const start = (this.currentPage - 1) * this.pageSize;
    this.visibleProviders = this.filteredProviders.slice(start, start + this.pageSize);
  }

  public get pages(): number[] {
    const maxPagesToShow = 5;
    let start = Math.max(1, this.currentPage - Math.floor(maxPagesToShow / 2));
    let end = Math.min(this.totalPages, start + maxPagesToShow - 1);

    if (end - start + 1 < maxPagesToShow) {
      start = Math.max(1, end - maxPagesToShow + 1);
    }

    const p = [];
    for (let i = start; i <= end; i++) {
      p.push(i);
    }
    return p;
  }

  public goToPage(page: number): void {
    if (page >= 1 && page <= this.totalPages) {
      this.currentPage = page;
      this.updateVisibleProviders();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  public prevPage(): void {
    this.goToPage(this.currentPage - 1);
  }

  public nextPage(): void {
    this.goToPage(this.currentPage + 1);
  }

  public priceLabel(value: number | null): string {
    if (value == null) return 'Sin precio informado';
    return `Desde ${new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency: 'CLP',
      maximumFractionDigits: 0,
    }).format(value)}`;
  }

  public openExternal(url: string | null): void {
    if (!url) return;
    const target = /^https?:\/\//i.test(url) ? url : `https://${url}`;
    window.open(target, '_blank', 'noopener');
  }

  public openEmail(email: string | null): void {
    if (!email) return;
    window.location.href = `mailto:${email}`;
  }

  public openPhone(phone: string | null): void {
    if (!phone) return;
    const digits = phone.replace(/[^\d+]/g, '');
    if (!digits) return;
    window.location.href = `tel:${digits}`;
  }

  public openMap(provider: ProviderCard | null): void {
    if (!provider) return;
    if (provider.placeId) {
      window.open(`https://www.google.com/maps/search/?api=1&query_place_id=${encodeURIComponent(provider.placeId)}`, '_blank', 'noopener');
      return;
    }
    if (provider.address) {
      window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(provider.address)}`, '_blank', 'noopener');
    }
  }

  public get ratingDistribution(): Array<{ stars: number; value: number }> {
    const provider = this.selectedProvider;
    if (!provider) return [];

    const total = Math.max(provider.reviews, 1);
    const five = Math.round(total * Math.min(provider.rating / 5, 1) * 0.78);
    const four = Math.round(total * 0.14);
    const three = Math.round(total * 0.05);
    const two = Math.round(total * 0.02);
    const one = Math.max(total - (five + four + three + two), 0);
    return [
      { stars: 5, value: five },
      { stars: 4, value: four },
      { stars: 3, value: three },
      { stars: 2, value: two },
      { stars: 1, value: one },
    ];
  }

  public trackById(_: number, provider: ProviderCard): string {
    return provider.id;
  }

  private toProviderCard(row: ProviderRow): ProviderCard {
    const metadata = row.metadata ?? {};
    const listings = (row.provider_listings ?? []).filter((item) => !!item);
    const listingPrices = listings
      .map((item) => item.price_from)
      .filter((value): value is number => typeof value === 'number' && value > 0);
    const priceFrom = listingPrices.length ? Math.min(...listingPrices) : null;

    const availabilityOrder: Availability[] = ['Hoy', 'Esta semana', 'Sin cupo'];
    const availability =
      availabilityOrder.find((status) => listings.some((item) => item.availability === status)) ?? 'Esta semana';

    const images = Array.isArray(metadata['imagenes']) ? metadata['imagenes'] : [];
    const cleanImages = images
      .filter((url: unknown): url is string => typeof url === 'string' && !!url.trim())
      .map((url) => url.trim());
    const imageUrl = cleanImages[0] ?? null;
    const reviewsRaw = metadata['cant_resenas'];
    const parsedReviews =
      typeof reviewsRaw === 'number' ? reviewsRaw : Number.parseInt(String(reviewsRaw ?? '0'), 10);
    const reviewsCount = Number.isFinite(parsedReviews) ? parsedReviews : 0;
    const email = typeof metadata['email'] === 'string' ? metadata['email'] : null;
    const phone = typeof metadata['telefono'] === 'string' ? metadata['telefono'] : null;
    const address = typeof metadata['direccion'] === 'string' ? metadata['direccion'] : null;
    const placeId = typeof metadata['place_id'] === 'string' ? metadata['place_id'] : null;
    const whatsapp = typeof metadata['whatsapp'] === 'string' ? metadata['whatsapp'] : null;

    return {
      id: row.id,
      name: row.name,
      type: row.type,
      area: row.area,
      verified: !!row.verified,
      rating: Number(row.rating ?? 0),
      reviews: reviewsCount,
      availability,
      priceFrom,
      description: String(metadata['descripcion'] ?? metadata['bio'] ?? '').trim(),
      website: typeof metadata['website'] === 'string' ? metadata['website'] : null,
      imageUrl: typeof imageUrl === 'string' ? imageUrl : null,
      images: cleanImages,
      phone,
      email,
      address,
      placeId,
      whatsapp,
    };
  }
}
