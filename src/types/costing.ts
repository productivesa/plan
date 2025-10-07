export interface TrainingCost {
  description: string;
  numberOfDays: number;
  numberOfParticipants: number;
  numberOfSessions: number;
  trainingLocationId: string;
  costMode?: 'perdiem' | 'accommodation';
  trainings?: { locationId: string; days: number; participants: number }[];
  locationDetails?: any;
  additionalParticipantCosts: AdditionalParticipantCost[];
  additionalSessionCosts: AdditionalSessionCost[];
  transportRequired: boolean;
  landTransportParticipants?: number;
  airTransportParticipants?: number;
  transportCosts?: {
    landParticipants: number;
    airParticipants: number;
    totalCost: number;
  };
  otherCosts: number;
  justification?: string;
  totalBudget?: number;
}

export interface Location {
  id: number;
  name: string;
  region: string;
  is_hardship_area: boolean;
}

export interface LandTransport {
  id: number;
  origin: number;
  origin_name: string;
  destination: number;
  destination_name: string;
  trip_type: 'SINGLE' | 'ROUND';
  price: number;
}

export interface AirTransport {
  id: number;
  origin: number;
  origin_name: string;
  destination: number;
  destination_name: string;
  single_trip_price: number;
  round_trip_price: number;
}

export interface PerDiem {
  id: number;
  location: number;
  location_name: string;
  amount: number;
  hardship_allowance_amount: number;
}

export interface Accommodation {
  id: number;
  location: number;
  location_name: string;
  service_type: 'LUNCH' | 'HALL_REFRESHMENT' | 'DINNER' | 'BED' | 'FULL_BOARD';
  service_type_display: string;
  price: number;
}

export interface ParticipantCost {
  id: number;
  cost_type: 'FLASH_DISK' | 'STATIONARY' | 'ALL';
  cost_type_display: string;
  price: number;
}

export interface SessionCost {
  id: number;
  cost_type: 'FLIP_CHART' | 'MARKER' | 'TONER_PAPER' | 'ALL';
  cost_type_display: string;
  price: number;
}

export interface PrintingCost {
  id: number;
  document_type: 'MANUAL' | 'BOOKLET' | 'LEAFLET' | 'BROCHURE';
  document_type_display: string;
  price_per_page: number;
}

export interface SupervisorCost {
  id: number;
  cost_type: 'MOBILE_CARD_300' | 'MOBILE_CARD_500' | 'STATIONARY' | 'ALL';
  cost_type_display: string;
  amount: number;
}
export interface MeetingWorkshopCost {
  description: string;
  numberOfDays: number;
  numberOfParticipants: number;
  numberOfSessions: number;
  location: TrainingLocation;
  additionalParticipantCosts: AdditionalParticipantCost[];
  additionalSessionCosts: AdditionalSessionCost[];
  transportRequired: boolean;
  landTransportParticipants?: number;
  airTransportParticipants?: number;
  otherCosts: number;
  justification?: string;
  totalBudget?: number;
}

interface SupervisionCost {
  description: string;
  numberOfDays: number;
  numberOfSupervisors: number;
  numberOfSupervisorsWithAdditionalCost: number;
  additionalSupervisorCosts: SupervisorCost[];
  transportRequired: boolean;
  landTransportSupervisors?: number;
  airTransportSupervisors?: number;
  otherCosts: number;
  justification?: string;
  totalBudget?: number;
}

export interface PrintingCost {
  description: string;
  documentType: DocumentType;
  numberOfPages: number;
  numberOfCopies: number;
  otherCosts: number;
  justification?: string;
  totalBudget?: number;
}

export interface ProcurementCost {
  description: string;
  items: ProcurementItem[];
  otherCosts: number;
  justification?: string;
  totalBudget?: number;
}

interface ProcurementItem {
  itemId: string;
  quantity: number;
}




type DocumentType = 'Manual' | 'Booklet' | 'Leaflet' | 'Brochure';

export const DOCUMENT_TYPES: { value: DocumentType; label: string; costPerPage: number }[] = [
  { value: 'Manual', label: 'Manual/Guidelines', costPerPage: 50 },
  { value: 'Booklet', label: 'Booklet', costPerPage: 40 },
  { value: 'Leaflet', label: 'Leaflet/Flier', costPerPage: 30 },
  { value: 'Brochure', label: 'Brochure', costPerPage: 35 }
];

type SupervisorCost = 'MobileCard300' | 'MobileCard500' | 'Stationary' | 'All';

export const SUPERVISOR_COSTS: { value: SupervisorCost; label: string; amount: number }[] = [
  { value: 'MobileCard300', label: 'Mobile Card (300 birr)', amount: 300 },
  { value: 'MobileCard500', label: 'Mobile Card (500 birr)', amount: 500 },
  { value: 'Stationary', label: 'Stationary (Writing Pad and Pen)', amount: 200 },
  { value: 'All', label: 'All', amount: 0 }
];

type TrainingLocation = 'Addis_Ababa' | 'Adama' | 'Bahirdar' | 'Mekele' | 'Hawassa' | 'Gambella' | 'Afar' | 'Somali';

type AdditionalParticipantCost = 'Flash_Disk' | 'Stationary' | 'All';
type AdditionalSessionCost = 'Flip_Chart' | 'Marker' | 'Toner_Paper' | 'All';

interface CostingAssumption {
  id: string;
  activity_type: ActivityType;
  location: TrainingLocation;
  cost_type: string;
  amount: number;
  description?: string;
  created_at?: string;
  updated_at?: string;
}

export const TRAINING_LOCATIONS: { value: TrainingLocation; label: string }[] = [
  { value: 'Addis_Ababa', label: 'Addis Ababa' },
  { value: 'Adama', label: 'Adama' },
  { value: 'Bahirdar', label: 'Bahirdar' },
  { value: 'Mekele', label: 'Mekele' },
  { value: 'Hawassa', label: 'Hawassa' },
  { value: 'Gambella', label: 'Gambella' },
  { value: 'Afar', label: 'Afar' },
  { value: 'Somali', label: 'Somali' }
];

export const PARTICIPANT_COSTS: { value: AdditionalParticipantCost; label: string }[] = [
  { value: 'Flash_Disk', label: 'Flash Disk' },
  { value: 'Stationary', label: 'Stationary (Writing Pad and Pen)' },
  { value: 'All', label: 'All' }
];

export const SESSION_COSTS: { value: AdditionalSessionCost; label: string }[] = [
  { value: 'Flip_Chart', label: 'Flip Chart' },
  { value: 'Marker', label: 'Marker' },
  { value: 'Toner_Paper', label: 'Toner and Ream of Paper' },
  { value: 'All', label: 'All' }
];

export const COST_ASSUMPTIONS = {
  perDiem: {
    Addis_Ababa: 1200,
    Adama: 1000,
    Bahirdar: 1100,
    Mekele: 1100,
    Hawassa: 1000,
    Gambella: 1200,
    Afar: 1200,
    Somali: 1200
  },
  accommodation: {
    Addis_Ababa: 1500,
    Adama: 1200,
    Bahirdar: 1300,
    Mekele: 1300,
    Hawassa: 1200,
    Gambella: 1400,
    Afar: 1400,
    Somali: 1400
  },
  transport: {
    land: 1000,
    air: 5000
  },
  participantCosts: {
    Flash_Disk: 500,
    Stationary: 200
  },
  sessionCosts: {
    Flip_Chart: 300,
    Marker: 150,
    Toner_Paper: 1000
  },
  venue: {
    Addis_Ababa: 5000,
    Adama: 4000,
    Bahirdar: 4500,
    Mekele: 4500,
    Hawassa: 4000,
    Gambella: 4500,
    Afar: 4500,
    Somali: 4500
  }
};