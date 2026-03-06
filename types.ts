
export interface ZipCodeData {
  zip: string;
  lat: number;
  lng: number;
  city: string;
  state: string;
  boundary?: [number, number][]; // Array of [lat, lng] points representing the polygon
}

export interface SalesRep {
  id: string;
  name: string;
  priority: number; // 1-5
  notes?: string;
}

export interface Trade {
  id: string;
  name: string;
  reps: SalesRep[];
}

export interface SavedPolygon {
  id: string;
  name: string;
  color: string;
  points: [number, number][];
  zips: string[]; // List of zip codes strictly within this polygon
  visible: boolean;
  brandId: string | null;
  officeId: string | null;
  isSearched?: boolean; // New flag to track if we have performed the search for this area
  trades?: Trade[];
  notes?: string;
}

export interface ServiceAreaMap {
  id: string;
  name: string;
  centerZip: string;
  radius: number;
  selectedZips: string[];
  savedPolygons: SavedPolygon[];
  createdAt: number;
}

export interface SavedMapState {
  version: number;
  timestamp: number;
  mapCenter: [number, number];
  zoom: number;
  initialZip: string;
  radius: number;
  selectedZips: string[];
  availableZips: ZipCodeData[];
  savedPolygons: SavedPolygon[];
  brands?: Brand[];
  offices?: Office[];
}

export enum SortOrder {
  ASC = 'asc',
  DESC = 'desc'
}

export interface Brand {
  id: string;
  name: string;
}

export interface Office {
  id: string;
  brandId: string | null;
  name: string;
  address: {
    street: string;
    city: string;
    state: string;
    zip: string;
  };
  lat: number;
  lng: number;
}
