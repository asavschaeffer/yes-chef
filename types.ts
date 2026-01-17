export enum IngredientLocation {
  FRIDGE = 'Fridge',
  PANTRY = 'Pantry',
  FREEZER = 'Freezer',
  SPICE_RACK = 'Spice Rack'
}

export interface Ingredient {
  id: string;
  name: string;
  quantity: string;
  expiryDate: string; // ISO String YYYY-MM-DD
  location: IngredientLocation;
  category?: string;
}

export interface Recipe {
  id: string;
  title: string;
  category?: string;
  ingredients: string[];
  steps: string[];
  notes: string;
  dateAdded: string;
}

export enum Sender {
  USER = 'user',
  BOT = 'bot'
}

export interface ReasoningTrace {
  icon: string; // Lucide icon name or similar identifier
  label: string;
  color?: string;
}

export interface ChatMessage {
  id: string;
  text: string;
  sender: Sender;
  timestamp: number;
  sources?: {
    title: string;
    uri: string;
  }[];
  image?: string; // Base64 string
  isThinking?: boolean;
  traces?: ReasoningTrace[]; 
}

export type ViewState = 'inventory' | 'chat' | 'live' | 'recipes' | 'scan';