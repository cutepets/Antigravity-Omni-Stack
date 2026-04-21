export interface ActivePetServicesView {
  groomingSessions: Array<Record<string, unknown>>
  hotelStays: Array<Record<string, unknown>>
}

export interface IPetReadModel {
  getPetDetail(petId: string): Promise<Record<string, unknown> | null>
  getActivePetServices(petId: string): Promise<ActivePetServicesView>
}

export const PET_READ_MODEL = Symbol('PET_READ_MODEL')
