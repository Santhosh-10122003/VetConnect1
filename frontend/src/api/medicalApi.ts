import { apiClient } from './client';

export interface Prescription {
  id: number;
  medicalRecordId: number;
  medicationName: string;
  dosage: string;
  frequency: string;
  durationDays: number;
  instructions?: string;
  createdAt: string;
}

export interface MedicalRecord {
  id: number;
  petId: number;
  petName: string;
  appointmentId?: number;
  bookingReference?: string;
  doctorId: number;
  doctorName: string;
  clinicName: string;
  visitDate: string;
  diagnosis: string;
  symptoms?: string;
  clinicalNotes?: string;
  treatmentPlan?: string;
  weightAtVisit?: number;
  prescriptions: Prescription[];
  createdAt: string;
}

export interface CreateMedicalRecordPayload {
  appointmentId?: number;
  visitDate?: string;
  diagnosis: string;
  symptoms?: string;
  clinicalNotes?: string;
  treatmentPlan?: string;
  weightAtVisit?: number;
  prescriptions?: Array<{
    medicationName: string;
    dosage: string;
    frequency: string;
    durationDays: number;
    instructions?: string;
  }>;
}

export const medicalApi = {
  async getPetMedicalRecords(petId: number) {
    const res = await apiClient.get<{ success: boolean; data: MedicalRecord[] }>(`/pets/${petId}/medical-records`);
    return res.data;
  },

  async createMedicalRecord(petId: number, payload: CreateMedicalRecordPayload) {
    const res = await apiClient.post<{ success: boolean; message: string; data: MedicalRecord }>(
      `/pets/${petId}/medical-records`,
      payload
    );
    return res.data;
  },

  async getPetPrescriptions(petId: number) {
    const res = await apiClient.get<{ success: boolean; data: Prescription[] }>(`/pets/${petId}/prescriptions`);
    return res.data;
  },
};
