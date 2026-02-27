
import { GoogleGenAI, Type } from "@google/genai";
import { ZipCodeData } from "./types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// Schema for detailed boundary requests (Sidebar search)
const DETAILED_SCHEMA = {
  type: Type.ARRAY,
  items: {
    type: Type.OBJECT,
    properties: {
      zip: { type: Type.STRING },
      lat: { type: Type.NUMBER },
      lng: { type: Type.NUMBER },
      city: { type: Type.STRING },
      state: { type: Type.STRING },
      boundary: {
        type: Type.ARRAY,
        items: {
          type: Type.ARRAY,
          items: { type: Type.NUMBER },
          description: "[latitude, longitude]"
        },
        description: "Polygon coordinates for the zip code boundary"
      }
    },
    required: ["zip", "lat", "lng", "city", "state", "boundary"],
  },
};

// Simplified schema for Dot view (Map panning) - No boundaries, just points
const POINT_SCHEMA = {
  type: Type.ARRAY,
  items: {
    type: Type.OBJECT,
    properties: {
      zip: { type: Type.STRING },
      lat: { type: Type.NUMBER },
      lng: { type: Type.NUMBER },
      city: { type: Type.STRING },
      state: { type: Type.STRING }
    },
    required: ["zip", "lat", "lng", "city", "state"],
  },
};

export const fetchNearbyZipCodes = async (zip: string, radius: number): Promise<ZipCodeData[]> => {
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `Find all valid US zip codes within a ${radius} mile radius of zip code ${zip}. 
    For each zip code, return a JSON object with:
    1. "zip", "city", "state".
    2. "lat", "lng" (center point).
    3. "boundary": A simplified polygon array of [latitude, longitude] arrays.
    
    Return the data as a JSON array.`,
    config: {
      responseMimeType: "application/json",
      responseSchema: DETAILED_SCHEMA,
    },
  });

  return parseResponse(response);
};

export const fetchZipCodesInBounds = async (north: number, south: number, east: number, west: number): Promise<ZipCodeData[]> => {
  // We limit the prompt to avoid overwhelming the model, asking for the most significant ones if too many.
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `List all valid US zip codes located strictly within the geographic bounding box defined by:
    North Lat: ${north}, South Lat: ${south}, East Lng: ${east}, West Lng: ${west}.
    
    Return a JSON array where each object contains:
    1. "zip"
    2. "city", "state"
    3. "lat", "lng" (approximate center of the zip code).
    
    Do not include boundaries.`,
    config: {
      responseMimeType: "application/json",
      responseSchema: POINT_SCHEMA,
    },
  });

  return parseResponse(response);
}

export const fetchZipCodesInPolygon = async (coordinates: [number, number][]): Promise<ZipCodeData[]> => {
  // Format coordinates for the prompt
  const coordString = coordinates.map(c => `[${c[0]}, ${c[1]}]`).join(", ");

  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `List all valid US zip codes whose geographic center falls strictly within the polygon defined by these [lat, lng] vertices: ${coordString}.
    
    Return a JSON array where each object contains:
    1. "zip"
    2. "city", "state"
    3. "lat", "lng" (approximate center of the zip code).
    
    Do not include boundaries.`,
    config: {
      responseMimeType: "application/json",
      responseSchema: POINT_SCHEMA,
    },
  });

  return parseResponse(response);
}

export const fetchZipCodesByCoordinates = async (lat: number, lng: number, radius: number): Promise<ZipCodeData[]> => {
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `Find all valid US zip codes within a ${radius} mile radius of latitude ${lat}, longitude ${lng}. 
    Return the data as a JSON array with zip, city, state, lat, lng, and boundary.`,
    config: {
      responseMimeType: "application/json",
      responseSchema: DETAILED_SCHEMA,
    },
  });

  return parseResponse(response);
}

const parseResponse = (response: any): ZipCodeData[] => {
  try {
    const text = response.text || "";
    if (!text) return [];
    const data = JSON.parse(text.trim());
    return Array.isArray(data) ? data : [];
  } catch (error) {
    console.error("Failed to parse Gemini response", error);
    return [];
  }
}

export const analyzeServiceArea = async (zips: string[]): Promise<string> => {
  if (zips.length === 0) return "No zip codes selected.";
  
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `Provide a very brief summary of the geographic and demographic profile of this service area consisting of these US zip codes: ${zips.join(", ")}. Keep it under 100 words.`,
  });

  return response.text;
};
