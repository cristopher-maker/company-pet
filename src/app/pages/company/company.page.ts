import { Component, OnInit } from '@angular/core';
import { AuthService } from '../../core/services/auth.service';
import { SupabaseService } from '../../core/services/supabase.service';
import { UiService } from '../../core/services/ui.service';

type ClientSummary = {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  direccion: string | null;
  comuna: string | null;
  notas_entrega_llaves: string | null;
  pets: PetSummary[];
  emergencias: EmergencyContact[];
  member_role?: string | null;
};

type PetSummary = {
  id: string;
  name: string;
  species: string;
  breed: string | null;
  birth_date: string | null;
  sex: string | null;
  weight_kg: number | null;
  photo_url: string | null;
};

type PetFull = PetSummary & {
  neutered: string | null;
  microchip_number: string | null;
  vaccine_status: string | null;
  veterinary_clinic_name: string | null;
  veterinary_clinic_commune: string | null;
  treating_vet_name: string | null;
  treating_vet_contact: string | null;
  chronic_conditions_allergies: string | null;
  current_medications: string | null;
  behavior_notes: string | null;
  feeding_schedule: string | null;
  food_brand: string | null;
  food_portion: string | null;
  food_allergies: string | null;
  emergency_vet_name: string | null;
  emergency_vet_phone: string | null;
  emergency_vet_address: string | null;
  notes: string | null;
};

type EmergencyContact = {
  id: string;
  nombre: string;
  telefono: string;
  parentesco: string | null;
};

type PetDraft = {
  name: string;
  species: string;
  breed: string;
  birth_date: string;
  sex: string;
  weight_kg: number | null;
  neutered: string;
  microchip_number: string;
  vaccine_status: string;
  veterinary_clinic_name: string;
  veterinary_clinic_commune: string;
  treating_vet_name: string;
  treating_vet_contact: string;
  chronic_conditions_allergies: string;
  current_medications: string;
  behavior_notes: string;
  feeding_schedule: string;
  food_brand: string;
  food_portion: string;
  food_allergies: string;
  emergency_vet_name: string;
  emergency_vet_phone: string;
  emergency_vet_address: string;
  notes: string;
};

@Component({
  selector: 'app-company',
  templateUrl: './company.page.html',
  styleUrls: ['./company.page.scss'],
})
export class CompanyPage implements OnInit {
  loading = true;
  clients: ClientSummary[] = [];
  searchQuery = '';
  profileRole: string | null = null;

  // Pet modal
  showPetModal = false;
  editingPetId: string | null = null;
  editingClientId: string | null = null;
  petDraft: PetDraft = this.emptyPetDraft();
  saving = false;

  // Emergency modal
  showEmergenciaModal = false;
  editingEmergenciaId: string | null = null;
  emergenciaDraft: { nombre: string; telefono: string; parentesco: string } = {
    nombre: '', telefono: '', parentesco: ''
  };
  emergenciaClientId: string | null = null;

  constructor(
    private auth: AuthService,
    private supabase: SupabaseService,
    public ui: UiService,
  ) {}

  async ngOnInit() {
    this.profileRole = await this.auth.getCurrentProfileRole();
    await this.loadClients();
  }

  get isCuidador(): boolean {
    return this.profileRole === 'cuidador';
  }

  get isCompanyAdmin(): boolean {
    return this.profileRole === 'company_admin' || this.profileRole === 'manager';
  }

  get filteredClients(): ClientSummary[] {
    if (!this.searchQuery) return this.clients;
    const q = this.searchQuery.toLowerCase();
    return this.clients.filter(c =>
      c.full_name.toLowerCase().includes(q) ||
      c.email.toLowerCase().includes(q) ||
      c.pets.some(p => p.name.toLowerCase().includes(q))
    );
  }

  get totalPets(): number {
    return this.clients.reduce((sum, c) => sum + c.pets.length, 0);
  }

  speciesLabel(s: string): string {
    const map: Record<string, string> = { dog: 'Perro', cat: 'Gato', other: 'Otra' };
    return map[s] || s;
  }

  sexLabel(s: string | null): string {
    const map: Record<string, string> = { male: 'Macho', female: 'Hembra', unknown: 'Sin dato' };
    return s ? (map[s] || s) : 'Sin dato';
  }

  vacunaLabel(s: string | null): string {
    const map: Record<string, string> = { up_to_date: 'Al día', pending: 'Pendientes', unknown: 'Sin dato' };
    return s ? (map[s] || s) : 'Sin dato';
  }

  memberRoleLabel(role: string | null | undefined): string {
    const labels: Record<string, string> = {
      employee: 'Colaborador',
      hr_admin: 'RR.HH.',
      manager: 'Manager',
    };
    return labels[role || ''] || 'Colaborador';
  }

  calculateAge(birthDate: string | null): string {
    if (!birthDate) return '';
    const bd = new Date(birthDate + 'T12:00:00');
    if (isNaN(bd.getTime())) return '';
    const today = new Date();
    let months = (today.getFullYear() - bd.getFullYear()) * 12 + (today.getMonth() - bd.getMonth());
    if (today.getDate() < bd.getDate()) {
      months--;
    }
    if (months < 0) return 'Recién nacido';
    if (months < 12) {
      if (months === 0) {
        const diffDays = Math.ceil(Math.abs(today.getTime() - bd.getTime()) / (1000 * 60 * 60 * 24));
        return diffDays <= 1 ? '1 día' : `${diffDays} días`;
      }
      return months === 1 ? '1 mes' : `${months} meses`;
    }
    const y = Math.floor(months / 12);
    const m = months % 12;
    if (m === 0) return y === 1 ? '1 año' : `${y} años`;
    return `${y} ${y === 1 ? 'año' : 'años'} y ${m} ${m === 1 ? 'mes' : 'meses'}`;
  }

  async loadClients() {
    this.loading = true;
    try {
      const user = this.auth.user;
      if (!user) return;

      if (this.isCompanyAdmin) {
        await this.loadCompanyMembers(user.id);
        return;
      }

      // Get tutor IDs from reservas for this cuidador
      const { data: reservas, error: reservasError } = await this.supabase.client
        .from('reservas')
        .select('tutor_id')
        .eq('cuidador_id', user.id);

      if (reservasError) throw reservasError;

      const tutorIds = [...new Set((reservas ?? []).map((r: any) => r.tutor_id))];

      if (tutorIds.length === 0) {
        this.clients = [];
        this.loading = false;
        return;
      }

      // Load profiles
      const { data: profiles } = await this.supabase.client
        .from('profiles')
        .select('id, full_name, email')
        .in('id', tutorIds);

      // Load tutor profiles
      const { data: tutorProfiles } = await this.supabase.client
        .from('tutor_profiles')
        .select('*')
        .in('id', tutorIds);

      // Load pets for all tutors
      const { data: pets } = await this.supabase.client
        .from('pets')
        .select('*')
        .in('owner_id', tutorIds);

      // Load emergency contacts
      const { data: emergencias } = await this.supabase.client
        .from('emergencias')
        .select('*')
        .in('tutor_id', tutorIds);

      const profileMap = new Map((profiles ?? []).map((p: any) => [p.id, p]));
      const tutorProfileMap = new Map((tutorProfiles ?? []).map((tp: any) => [tp.id, tp]));
      const petsByOwner = new Map<string, any[]>();
      for (const pet of (pets ?? [])) {
        const arr = petsByOwner.get((pet as any).owner_id) || [];
        arr.push(pet);
        petsByOwner.set((pet as any).owner_id, arr);
      }
      const emergenciasByTutor = new Map((emergencias ?? []).map((e: any) => [e.tutor_id, e]));

      this.clients = tutorIds.map(tutorId => {
        const profile = profileMap.get(tutorId) as any || {};
        const tp = tutorProfileMap.get(tutorId) as any || {};
        const clientPets = (petsByOwner.get(tutorId) || []) as any[];
        const emg = (emergenciasByTutor.get(tutorId) || []) as any[];

        return {
          id: tutorId,
          full_name: profile.full_name ?? 'Sin nombre',
          email: profile.email ?? '',
          phone: tp.phone ?? null,
          direccion: tp.direccion ?? null,
          comuna: tp.comuna ?? null,
          notas_entrega_llaves: tp.notas_entrega_llaves ?? null,
          pets: clientPets.map((p: any) => ({
            id: p.id,
            name: p.name,
            species: p.species,
            breed: p.breed,
            birth_date: p.birth_date,
            sex: p.sex,
            weight_kg: p.weight_kg,
            photo_url: p.pet_photo_url,
          } as PetSummary)),
          emergencias: emg.map((e: any) => ({
            id: e.id,
            nombre: e.nombre,
            telefono: e.telefono,
            parentesco: e.parentesco,
          })),
        };
      });

    } catch (error) {
      console.error('Error cargando clientes:', error);
    } finally {
      this.loading = false;
    }
  }

  private async loadCompanyMembers(userId: string): Promise<void> {
    const { data: membership, error: membershipError } = await this.supabase.client
      .from('company_members')
      .select('company_id')
      .eq('user_id', userId)
      .maybeSingle();

    if (membershipError) throw membershipError;
    const companyId = membership?.company_id;
    if (!companyId) {
      this.clients = [];
      return;
    }

    const { data: members, error: membersError } = await this.supabase.client
      .from('company_members_view')
      .select('user_id, full_name, email, member_role')
      .eq('company_id', companyId);
    if (membersError) throw membersError;

    const memberIds = (members ?? []).map((member: any) => member.user_id);
    if (!memberIds.length) {
      this.clients = [];
      return;
    }

    const [{ data: tutorProfiles }, { data: pets }, { data: emergencias }] = await Promise.all([
      this.supabase.client.from('tutor_profiles').select('*').in('id', memberIds),
      this.supabase.client.from('pets').select('*').eq('company_id', companyId),
      this.supabase.client.from('emergencias').select('*').in('tutor_id', memberIds),
    ]);

    const tutorProfileMap = new Map((tutorProfiles ?? []).map((profile: any) => [profile.id, profile]));
    const petsByOwner = new Map<string, any[]>();
    for (const pet of pets ?? []) {
      const ownerPets = petsByOwner.get((pet as any).owner_id) || [];
      ownerPets.push(pet);
      petsByOwner.set((pet as any).owner_id, ownerPets);
    }
    const emergenciasByTutor = new Map<string, any[]>();
    for (const emergencia of emergencias ?? []) {
      const contacts = emergenciasByTutor.get((emergencia as any).tutor_id) || [];
      contacts.push(emergencia);
      emergenciasByTutor.set((emergencia as any).tutor_id, contacts);
    }

    this.clients = (members ?? []).map((member: any) => {
      const tutorProfile = tutorProfileMap.get(member.user_id) as any || {};
      const memberPets = petsByOwner.get(member.user_id) || [];
      const memberEmergencias = emergenciasByTutor.get(member.user_id) || [];
      return {
        id: member.user_id,
        full_name: member.full_name || 'Sin nombre',
        email: member.email || '',
        phone: tutorProfile.phone ?? null,
        direccion: tutorProfile.direccion ?? null,
        comuna: tutorProfile.comuna ?? null,
        notas_entrega_llaves: tutorProfile.notas_entrega_llaves ?? null,
        member_role: member.member_role ?? null,
        pets: memberPets.map((pet: any) => ({
          id: pet.id,
          name: pet.name,
          species: pet.species,
          breed: pet.breed,
          birth_date: pet.birth_date,
          sex: pet.sex,
          weight_kg: pet.weight_kg,
          photo_url: pet.pet_photo_url,
        })),
        emergencias: memberEmergencias.map((contact: any) => ({
          id: contact.id,
          nombre: contact.nombre,
          telefono: contact.telefono,
          parentesco: contact.parentesco,
        })),
      };
    });
  }

  // ── Pet modal ──

  async openPetModal(clientId: string, pet: any | null) {
    this.editingClientId = clientId;
    if (pet) {
      this.editingPetId = pet.id;
      const { data } = await this.supabase.client
        .from('pets')
        .select('*')
        .eq('id', pet.id)
        .single();
      const p = (data ?? {}) as any;
      this.petDraft = {
        name: p.name ?? '',
        species: p.species ?? 'dog',
        breed: p.breed ?? '',
        birth_date: p.birth_date ?? '',
        sex: p.sex ?? 'unknown',
        weight_kg: p.weight_kg ?? null,
        neutered: p.neutered ?? 'unknown',
        microchip_number: p.microchip_number ?? '',
        vaccine_status: p.vaccine_status ?? 'unknown',
        veterinary_clinic_name: p.veterinary_clinic_name ?? '',
        veterinary_clinic_commune: p.veterinary_clinic_commune ?? '',
        treating_vet_name: p.treating_vet_name ?? '',
        treating_vet_contact: p.treating_vet_contact ?? '',
        chronic_conditions_allergies: p.chronic_conditions_allergies ?? '',
        current_medications: p.current_medications ?? '',
        behavior_notes: p.behavior_notes ?? '',
        feeding_schedule: p.feeding_schedule ?? '',
        food_brand: p.food_brand ?? '',
        food_portion: p.food_portion ?? '',
        food_allergies: p.food_allergies ?? '',
        emergency_vet_name: p.emergency_vet_name ?? '',
        emergency_vet_phone: p.emergency_vet_phone ?? '',
        emergency_vet_address: p.emergency_vet_address ?? '',
        notes: p.notes ?? '',
      };
    } else {
      this.editingPetId = null;
      this.petDraft = this.emptyPetDraft();
    }
    this.showPetModal = true;
  }

  closePetModal() {
    this.showPetModal = false;
    this.editingPetId = null;
    this.editingClientId = null;
  }

  async savePet() {
    if (this.isCompanyAdmin) return;
    if (!this.editingClientId) return;
    this.saving = true;
    try {
      const payload = {
        owner_id: this.editingClientId,
        name: this.petDraft.name.trim() || 'Mascota sin nombre',
        species: this.petDraft.species,
        breed: this.petDraft.breed.trim() || null,
        birth_date: this.petDraft.birth_date || null,
        sex: this.petDraft.sex || 'unknown',
        weight_kg: this.petDraft.weight_kg,
        neutered: this.petDraft.neutered || 'unknown',
        microchip_number: this.petDraft.microchip_number.trim() || null,
        vaccine_status: this.petDraft.vaccine_status || 'unknown',
        veterinary_clinic_name: this.petDraft.veterinary_clinic_name.trim() || null,
        veterinary_clinic_commune: this.petDraft.veterinary_clinic_commune.trim() || null,
        treating_vet_name: this.petDraft.treating_vet_name.trim() || null,
        treating_vet_contact: this.petDraft.treating_vet_contact.trim() || null,
        chronic_conditions_allergies: this.petDraft.chronic_conditions_allergies.trim() || null,
        current_medications: this.petDraft.current_medications.trim() || null,
        behavior_notes: this.petDraft.behavior_notes.trim() || null,
        feeding_schedule: this.petDraft.feeding_schedule.trim() || null,
        food_brand: this.petDraft.food_brand.trim() || null,
        food_portion: this.petDraft.food_portion.trim() || null,
        food_allergies: this.petDraft.food_allergies.trim() || null,
        emergency_vet_name: this.petDraft.emergency_vet_name.trim() || null,
        emergency_vet_phone: this.petDraft.emergency_vet_phone.trim() || null,
        emergency_vet_address: this.petDraft.emergency_vet_address.trim() || null,
        notes: this.petDraft.notes.trim() || null,
      };

      if (this.editingPetId) {
        const { error } = await this.supabase.client
          .from('pets')
          .update(payload)
          .eq('id', this.editingPetId);
        if (error) throw error;
      } else {
        const { error } = await this.supabase.client
          .from('pets')
          .insert(payload);
        if (error) throw error;
      }

      this.closePetModal();
      await this.loadClients();
    } catch (err: any) {
      alert(`Error al guardar mascota: ${err?.message ?? 'Desconocido'}`);
    } finally {
      this.saving = false;
    }
  }

  // ── Emergency contact modal ──

  openEmergenciaModal(clientId: string, emergencia: any | null) {
    this.emergenciaClientId = clientId;
    this.editingEmergenciaId = emergencia?.id ?? null;
    this.emergenciaDraft = {
      nombre: emergencia?.nombre ?? '',
      telefono: emergencia?.telefono ?? '',
      parentesco: emergencia?.parentesco ?? '',
    };
    this.showEmergenciaModal = true;
  }

  closeEmergenciaModal() {
    this.showEmergenciaModal = false;
    this.editingEmergenciaId = null;
    this.emergenciaClientId = null;
  }

  async saveEmergencia() {
    if (this.isCompanyAdmin) return;
    if (!this.emergenciaClientId) return;
    this.saving = true;
    try {
      const payload = {
        tutor_id: this.emergenciaClientId,
        nombre: this.emergenciaDraft.nombre.trim(),
        telefono: this.emergenciaDraft.telefono.trim(),
        parentesco: this.emergenciaDraft.parentesco.trim() || null,
      };

      if (this.editingEmergenciaId) {
        const { error } = await this.supabase.client
          .from('emergencias')
          .update(payload)
          .eq('id', this.editingEmergenciaId);
        if (error) throw error;
      } else {
        const { error } = await this.supabase.client
          .from('emergencias')
          .insert(payload);
        if (error) throw error;
      }

      this.closeEmergenciaModal();
      await this.loadClients();
    } catch (err: any) {
      alert(`Error al guardar emergencia: ${err?.message ?? 'Desconocido'}`);
    } finally {
      this.saving = false;
    }
  }

  async deleteEmergencia(id: string) {
    if (this.isCompanyAdmin) return;
    if (!confirm('¿Eliminar este contacto de emergencia?')) return;
    try {
      await this.supabase.client.from('emergencias').delete().eq('id', id);
      await this.loadClients();
    } catch (err: any) {
      alert(`Error: ${err?.message ?? 'Desconocido'}`);
    }
  }

  async deletePet(id: string, name: string) {
    if (this.isCompanyAdmin) return;
    if (!confirm(`¿Eliminar a ${name}? No se puede deshacer.`)) return;
    try {
      await this.supabase.client.from('pets').delete().eq('id', id);
      await this.loadClients();
    } catch (err: any) {
      alert(`Error: ${err?.message ?? 'Desconocido'}`);
    }
  }

  private emptyPetDraft(): PetDraft {
    return {
      name: '', species: 'dog', breed: '', birth_date: '',
      sex: 'unknown', weight_kg: null, neutered: 'unknown',
      microchip_number: '', vaccine_status: 'unknown',
      veterinary_clinic_name: '', veterinary_clinic_commune: '',
      treating_vet_name: '', treating_vet_contact: '',
      chronic_conditions_allergies: '', current_medications: '',
      behavior_notes: '', feeding_schedule: '', food_brand: '',
      food_portion: '', food_allergies: '',
      emergency_vet_name: '', emergency_vet_phone: '', emergency_vet_address: '',
      notes: '',
    };
  }
}
