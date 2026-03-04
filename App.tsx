import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { Search, Map as MapIcon, Download, Trash2, List, Save, CheckCircle2, Menu, X, Loader2, PenTool, XCircle, MoreVertical, Edit2, Palette, Type, Eye, EyeOff, Layers, ChevronLeft, ChevronRight, Combine, Briefcase, Star, PlusCircle, FileDown, FileUp, Building, Building2, Dot, SquareDashedBottom } from 'lucide-react';
import * as turf from '@turf/turf';
import packageJson from './package.json';
import MapView from './components/MapView';
import Sidebar from './components/Sidebar';
import ExportModal from './components/ExportModal';
import PolygonInfoPanel from './components/PolygonInfoPanel';
import { ZipCodeData, SavedPolygon, SavedMapState, Brand, Office } from './types';
import { STATES, stateManifest, COLORS } from './constants';
import { STATE_BOUNDS } from './state_bounds';

interface StrictSavedMapData {
  app_version: string;
  brands: Brand[];
  offices: Office[];
  savedPolygons: SavedPolygon[];
  selectedZips: string[];
}

const App: React.FC = () => {
  // New state for hierarchy
  const [brands, setBrands] = useState<Brand[]>([]);
  const [offices, setOffices] = useState<Office[]>([]);
  const [showAddBrandModal, setShowAddBrandModal] = useState(false);
  const [newBrandName, setNewBrandName] = useState('');
  const [showAddOfficeModal, setShowAddOfficeModal] = useState(false);
  const [addingOfficeToBrandId, setAddingOfficeToBrandId] = useState<string | null>(null);
  const [newOfficeDetails, setNewOfficeDetails] = useState({
    name: '',
    street: '',
    city: '',
    state: '',
    zip: '',
  });
  const apiKey = import.meta.env.VITE_GOOGLE_API_KEY as string;
  const [initialZip, setInitialZip] = useState('');
  const [radius, setRadius] = useState(10);
  const [loading, setLoading] = useState(false);
  const [searchingPolygonId, setSearchingPolygonId] = useState<string | null>(null);
  
  // activeZips stores all loaded centroids for the 12 states
  const [activeZips, setActiveZips] = useState<ZipCodeData[]>([]);
  const [loadedStates, setLoadedStates] = useState<Set<string>>(new Set());
  const [selectedZips, setSelectedZips] = useState<Set<string>>(new Set());
  const [savedPolygons, setSavedPolygons] = useState<SavedPolygon[]>([]);
  const [selectedPolygonIds, setSelectedPolygonIds] = useState<Set<string>>(new Set());
  const [editingPolygon, setEditingPolygon] = useState<SavedPolygon | null>(null);
  const [selectedInfoPolygonId, setSelectedInfoPolygonId] = useState<string | null>(null);

  const [isExportOpen, setIsExportOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  
  // Map State
  const [mapCenter, setMapCenter] = useState<[number, number]>([37.0902, -95.7129]); // Default USA
  const [zoom, setZoom] = useState(4);
  const [shouldFitBounds, setShouldFitBounds] = useState(true);
  // New visibility toggles
  const [showServiceAreas, setShowServiceAreas] = useState(true);
  const [showZipDots, setShowZipDots] = useState(true);
  const [showZipBoundaries, setShowZipBoundaries] = useState(true);

  const [currentBounds, setCurrentBounds] = useState<{ north: number; south: number; east: number; west: number; zoom: number } | null>(null);
  const [showBaseMap, setShowBaseMap] = useState(true);
  const [leadPin, setLeadPin] = useState<[number, number] | null>(null);

  // Polygon Drawing State
  const [isDrawing, setIsDrawing] = useState(false);
  const [polygonPoints, setPolygonPoints] = useState<[number, number][]>([]);
  const [selectedVertexIndex, setSelectedVertexIndex] = useState<number | null>(null);

  // Polygon Division State
  const [isDividing, setIsDividing] = useState(false);
  const [dividingPolygonId, setDividingPolygonId] = useState<string | null>(null);
  const [divisionLinePoints, setDivisionLinePoints] = useState<[number, number][]>([]);
  const [showDivisionConfirm, setShowDivisionConfirm] = useState(false);
  const [polygonsToName, setPolygonsToName] = useState<SavedPolygon[]>([]);

  // Naming/Saving Modal State
  const [showNameModal, setShowNameModal] = useState(false);
  const [newPolygonName, setNewPolygonName] = useState('');
  const [newPolygonColor, setNewPolygonColor] = useState(COLORS[6]); // Default Blue

  // Context Menu State
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; polygonId: string } | null>(null);
  const [editingNameId, setEditingNameId] = useState<string | null>(null);
  const [editingColorId, setEditingColorId] = useState<string | null>(null);
  const [polygonFilter, setPolygonFilter] = useState('');

  // Pre-loading Logic for State Centroids
  const loadStateZips = async (stateCode: string) => {
    const code = stateCode.toUpperCase();
    if (loadedStates.has(code) || !STATES.includes(code)) return;

    try {
      const url = stateManifest[code];
      const response = await fetch(url);
      if (!response.ok) throw new Error(`Failed to load zips for ${code}`);
      const rawData: Record<string, { lat: number, lng: number, city: string, boundary?: [number, number][] }> = await response.json();
      
      // Convert object to array of ZipCodeData
      const data: ZipCodeData[] = Object.entries(rawData).map(([zip, details]) => ({
        zip,
        lat: details.lat,
        lng: details.lng,
        city: details.city,
        state: code,
        boundary: details.boundary
      }));
      
      setActiveZips(prev => {
        const existing = new Set(prev.map(z => z.zip));
        const newUnique = data.filter(z => !existing.has(z.zip));
        return [...prev, ...newUnique];
      });
      setLoadedStates(prev => new Set(prev).add(code));
    } catch (error) {
      console.error(`Error loading state zips for ${code}:`, error);
    }
  };

  // Zoom-based Pre-loading
  useEffect(() => {
    if (zoom >= 10 && currentBounds) {
        const checkVisibleStates = () => {
            const visibleStates = Object.entries(STATE_BOUNDS).filter(([_, bounds]) => {
                const [west, south, east, north] = bounds;
                const stateBounds = { west, south, east, north };
                const mapBounds = currentBounds;
                return (
                    stateBounds.east >= mapBounds.west &&
                    stateBounds.west <= mapBounds.east &&
                    stateBounds.south <= mapBounds.north &&
                    stateBounds.north >= mapBounds.south
                );
            }).map(([state, _]) => state);

            visibleStates.forEach(state => loadStateZips(state));
        };

        const debounce = setTimeout(checkVisibleStates, 500);
        return () => clearTimeout(debounce);
    }
  }, [zoom, currentBounds]);

  // Lead Search (Primary Discovery)
  const handleLeadSearch = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!initialZip) return;

    setLoading(true);
    setShouldFitBounds(true);
    // Exit drawing mode if active
    setIsDrawing(false);
    setPolygonPoints([]);
    setSelectedVertexIndex(null);

    if (!apiKey) {
      alert('Google Geocoding API key is not set. Please create a .env.local file with VITE_GOOGLE_API_KEY.');
      setLoading(false);
      return;
    }

    try {
      const params = new URLSearchParams({
        address: initialZip,
        key: apiKey,
      });
      const response = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?${params.toString()}`);
      const data = await response.json();

      if (data.status === 'OK' && data.results.length > 0) {
        const { lat, lng } = data.results[0].geometry.location;
        
        setMapCenter([lat, lng]);
        setZoom(13);
        setLeadPin([lat, lng]);

        // This is the key to moving the map. We need to tell the map component
        // that it should programmatically fit the new bounds, then immediately
        // turn it off so the user can pan and zoom freely afterwards.
        setShouldFitBounds(true);
        setTimeout(() => setShouldFitBounds(false), 100);
      } else {
        alert("Location not found. Please check the address and try again.");
      }
    } catch (error) {
      console.error("Error geocoding address:", error);
      alert("An error occurred while searching for the location.");
    } finally {
      setLoading(false);
    }
  };

  // Track Map Bounds
  const handleMapChange = useCallback((bounds: { north: number; south: number; east: number; west: number; zoom: number }) => {
    setCurrentBounds(bounds);
    setZoom(bounds.zoom);
    setShouldFitBounds(false);
  }, []);

  // 1. Open Modal to Save Polygon (No search yet)
  const handleInitiateSave = () => {
    if (polygonPoints.length < 3) return;
    if (editingPolygon) {
      setNewPolygonName(editingPolygon.name);
      setNewPolygonColor(editingPolygon.color);
    } else {
      setNewPolygonName(`Area ${savedPolygons.length + 1}`);
      setNewPolygonColor(COLORS[Math.floor(Math.random() * COLORS.length)]);
    }
    setShowNameModal(true);
  };

  // 2. Actually Save the Polygon to State
  const savePolygon = async () => {
    if (!newPolygonName.trim()) return;
    
    // Optimized Point-in-Polygon loop using activeZips
    const polyCoords = polygonPoints.map(p => [p[1], p[0]]);
    if (polyCoords[0][0] !== polyCoords[polyCoords.length-1][0] || polyCoords[0][1] !== polyCoords[polyCoords.length-1][1]) {
      polyCoords.push(polyCoords[0]);
    }
    const poly = turf.polygon([polyCoords]);
    
    // Performance: turf.booleanPointInPolygon is very fast. 
    // Processing 1000+ zips should be well under 100ms.
    const startTime = performance.now();
    const containedZips = activeZips.filter(zipData => {
      const pt = turf.point([zipData.lng, zipData.lat]);
      return turf.booleanPointInPolygon(pt, poly);
    }).map(z => z.zip);
    const endTime = performance.now();
    console.log(`PiP processing took ${endTime - startTime}ms for ${activeZips.length} zips.`);

    const newPoly: SavedPolygon = {
      id: editingPolygon ? editingPolygon.id : `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name: newPolygonName,
      color: newPolygonColor,
      points: [...polygonPoints],
      brandId: null,
      officeId: null,
      zips: containedZips,
      visible: true,
      isSearched: true,
      trades: editingPolygon ? editingPolygon.trades : [],
      notes: editingPolygon ? editingPolygon.notes : ''
    };
    
    setSavedPolygons(prev => [...prev, newPoly]);
    
    const polyId = newPoly.id;
    const wasEditing = !!editingPolygon;
    const oldPolyPoints = editingPolygon?.points;

    // Cleanup
    setEditingPolygon(null);
    setPolygonPoints([]);
    setSelectedVertexIndex(null);
    setIsDrawing(false);
    setShowNameModal(false);
    setNewPolygonName('');

    // Ask for search
    if (wasEditing && window.confirm("Geometry updated. Would you like to search for new zip codes in the modified area?")) {
      if (oldPolyPoints) {
        handleSearchAddedArea(polyId, oldPolyPoints, newPoly.points, containedZips);
      } else {
        handleSearchSavedPolygon(polyId);
      }
    }
  };

  const discardPolygon = () => {
    if (editingPolygon) {
      setSavedPolygons(prev => [...prev, editingPolygon]);
      setEditingPolygon(null);
    }
    setPolygonPoints([]);
    setSelectedVertexIndex(null);
    setIsDrawing(false);
    setShowNameModal(false);
    setNewPolygonName('');
    setPolygonsToName([]);
  };

  // 3. Search logic for an existing saved polygon
  const handleSearchSavedPolygon = async (id: string, e?: React.MouseEvent, points?: [number, number][]) => {
    if (e) e.stopPropagation();
    
    const poly = savedPolygons.find(p => p.id === id);
    const searchPoints = points || poly?.points;
    if (!searchPoints) return;

    setSearchingPolygonId(id);
    setShouldFitBounds(false);

    try {
      const coords = searchPoints.map(p => [p[1], p[0]]);
      if (coords[0][0] !== coords[coords.length-1][0] || coords[0][1] !== coords[coords.length-1][1]) {
        coords.push(coords[0]);
      }
      const poly = turf.polygon([coords]);
      
      const foundZips = activeZips.filter(zipData => {
        const pt = turf.point([zipData.lng, zipData.lat]);
        return turf.booleanPointInPolygon(pt, poly);
      });
      const foundZipCodes = foundZips.map(z => z.zip);

      // Update selected zips (auto-select found ones)
      setSelectedZips(prev => {
        const newSet = new Set(prev);
        foundZipCodes.forEach(z => newSet.add(z));
        return newSet;
      });

      // Update polygon state
      setSavedPolygons(prev => prev.map(p => {
        if (p.id === id) {
          return { ...p, zips: foundZipCodes, isSearched: true };
        }
        return p;
      }));

    } catch (err) {
      console.error("Error searching specific polygon", err);
      alert("Failed to search area. Please try again.");
    } finally {
      setSearchingPolygonId(null);
    }
  };

  const handleSearchAddedArea = async (id: string, oldPoints: [number, number][], newPoints: [number, number][], existingZips: string[]) => {
    setSearchingPolygonId(id);
    setShouldFitBounds(false);

    try {
      // 1. Calculate the added area (new - old)
      const oldCoords = oldPoints.map(p => [p[1], p[0]]);
      if (oldCoords[0][0] !== oldCoords[oldCoords.length-1][0] || oldCoords[0][1] !== oldCoords[oldCoords.length-1][1]) {
        oldCoords.push(oldCoords[0]);
      }
      const oldPoly = turf.polygon([oldCoords]);

      const newCoords = newPoints.map(p => [p[1], p[0]]);
      if (newCoords[0][0] !== newCoords[newCoords.length-1][0] || newCoords[0][1] !== newCoords[newCoords.length-1][1]) {
        newCoords.push(newCoords[0]);
      }
      const newPoly = turf.polygon([newCoords]);

      const addedArea = turf.difference(turf.featureCollection([newPoly, oldPoly]));
      
      if (!addedArea) {
        // No added area, just finish. This can happen if the new polygon is smaller than the old one.
        setSearchingPolygonId(null);
        return;
      }

      // 2. Search zips in the added area
      let searchCoords: [number, number][] = [];
      if (addedArea.geometry.type === 'Polygon') {
        searchCoords = addedArea.geometry.coordinates[0].map((c: any) => [c[1], c[0]]);
      } else if (addedArea.geometry.type === 'MultiPolygon') {
        // Take the first ring of the first polygon
        searchCoords = addedArea.geometry.coordinates[0][0].map((c: any) => [c[1], c[0]]);
      } else {
        // Fallback
        handleSearchSavedPolygon(id, undefined, newPoints);
        return;
      }

      const coords = searchCoords.map(pt => [pt[1], pt[0]]);
      if (coords[0][0] !== coords[coords.length-1][0] || coords[0][1] !== coords[coords.length-1][1]) {
        coords.push(coords[0]);
      }
      const poly = turf.polygon([coords]);

      const foundZips = activeZips.filter(zipData => {
        const pt = turf.point([zipData.lng, zipData.lat]);
        return turf.booleanPointInPolygon(pt, poly);
      });
      const foundZipCodes = foundZips.map(z => z.zip);

      // 3. Combine with existing
      const combinedZipCodes = Array.from(new Set([...existingZips, ...foundZipCodes]));

      // Update selected zips
      setSelectedZips(prev => {
        const newSet = new Set(prev);
        foundZipCodes.forEach(z => newSet.add(z));
        return newSet;
      });

      // Update polygon state
      setSavedPolygons(prev => prev.map(p => {
        if (p.id === id) {
          return { ...p, zips: combinedZipCodes, isSearched: true };
        }
        return p;
      }));

    } catch (err) {
      console.error("Error searching added area", err);
      // Fallback to full search if difference fails
      handleSearchSavedPolygon(id, undefined, newPoints);
    } finally {
      setSearchingPolygonId(null);
    }
  };

  // --- Local Storage Actions ---

  const handleSaveToLocalStorage = () => {
    if (window.confirm("This will overwrite any previously saved map data in your browser. Continue?")) {
      const state: SavedMapState = {
        version: 1,
        timestamp: Date.now(),
        mapCenter,
        zoom,
        initialZip,
        radius,
        selectedZips: Array.from(selectedZips),
        availableZips: activeZips,
        savedPolygons
      };
      try {
        localStorage.setItem('serviceAreaMapData', JSON.stringify(state));
        alert('Map saved to browser storage!');
      } catch (e) {
        console.error('Failed to save map data', e);
        alert('Failed to save map data. Storage might be full.');
      }
    }
  };

  const handleLoadFromLocalStorage = () => {
    if (window.confirm("This will load the saved map and replace your current session. Continue?")) {
      try {
        const dataStr = localStorage.getItem('serviceAreaMapData');
        if (!dataStr) {
          alert('No saved map found in browser storage.');
          return;
        }
        const state = JSON.parse(dataStr) as SavedMapState;
        
        // Restore state
        setMapCenter(state.mapCenter);
        setZoom(state.zoom);
        setInitialZip(state.initialZip);
        setRadius(state.radius);
        setSelectedZips(new Set(state.selectedZips as string[]));
        setActiveZips(state.availableZips || []);
        setSavedPolygons((state.savedPolygons || []).map(p => {
          const defaults = { trades: [], notes: '', isSearched: false };
          return {
            ...defaults,
            ...p,
          // Ensure defaults for older saved states
          visible: p.visible !== false,
          brandId: p.brandId || null,
          officeId: p.officeId || null,
        }}));
        setBrands(state.brands ?? []);
        setOffices(state.offices ?? []);
        
        // Don't auto-fit, respect saved view
        setShouldFitBounds(false); 
        // Force a small delay to ensure view updates if needed
        setTimeout(() => {
           setLoading(false); 
        }, 100);
        
      } catch (e) {
        console.error('Failed to load map data', e);
        alert('Failed to parse saved map data.');
      }
    }
  };

  const handleExportToFile = () => {
    // Use a strict data schema for export, excluding UI state.
    const state: StrictSavedMapData = {
      app_version: packageJson.version,
      brands,
      offices,
      savedPolygons,
      selectedZips: Array.from(selectedZips),
    };

    const jsonString = JSON.stringify(state, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `service-area-pro-data-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleImportFromFile = () => {
    if (!window.confirm("This will load data from a file and merge it with your current session. This can't be undone. Continue?")) {
      return;
    }

    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e: Event) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
          const dataStr = event.target?.result as string;
          if (!dataStr) throw new Error("File is empty.");
          const data = JSON.parse(dataStr);

          // Hydrate data instead of overwriting the whole state
          const state = data as StrictSavedMapData;
          if (!state.app_version || !state.savedPolygons || !state.brands || !state.offices) {
            throw new Error("Invalid data format. The file does not appear to be a valid Service Area Pro data file.");
          }

          setSelectedZips(new Set(state.selectedZips as string[]));
          setSavedPolygons((state.savedPolygons || []).map(p => {
            // Default values first
            const defaults = { trades: [], notes: '', visible: true, isSearched: false, brandId: null, officeId: null };
            return {
              ...defaults,
              ...p, // Spread saved data, which will overwrite defaults
              visible: p.visible !== false, // Ensure 'visible' is a boolean
            };
          }));
          setBrands(state.brands ?? []);
          setOffices(state.offices ?? []);
          setShouldFitBounds(false);
          alert('Map data loaded successfully from file.');
        } catch (err) {
          console.error('Failed to load map data from file', err);
          alert('Failed to parse map data from file. The file may be corrupt.');
        }
      };
      reader.readAsText(file);
    };
    input.click();
  };

  const handleAddBrand = () => {
    if (!newBrandName.trim()) return;
    const newBrand: Brand = {
        id: `${Date.now()}-brand-${Math.random()}`,
        name: newBrandName.trim()
    };
    setBrands(prev => [...prev, newBrand]);
    setShowAddBrandModal(false);
    setNewBrandName('');
  };

  const handleOpenAddOfficeModal = (brandId: string) => {
    setAddingOfficeToBrandId(brandId);
    setShowAddOfficeModal(true);
  };

  const handleAddOffice = async () => {
    if (!newOfficeDetails.name.trim() || !addingOfficeToBrandId) return;

    if (!newOfficeDetails.street || !newOfficeDetails.city || !newOfficeDetails.state || !newOfficeDetails.zip) {
      alert("Please fill out the full address for the office.");
      return;
    }

    if (!apiKey) {
      alert('Google Geocoding API key is not set. Please create a .env.local file with VITE_GOOGLE_API_KEY.');
      return;
    }

    setLoading(true);
    try {
      const address = `${newOfficeDetails.street}, ${newOfficeDetails.city}, ${newOfficeDetails.state} ${newOfficeDetails.zip}`;
      const params = new URLSearchParams({ // eslint-disable-line
        address: address,
        key: apiKey,
      });
      const response = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?${params.toString()}`);
      const data = await response.json();

      if (data.status === 'OK' && data.results.length > 0) {
        const { lat, lng } = data.results[0].geometry.location;

        const newOffice: Office = {
          id: `${Date.now()}-office-${Math.random()}`,
          brandId: addingOfficeToBrandId,
          name: newOfficeDetails.name.trim(),
          address: { ...newOfficeDetails },
          lat: lat,
          lng: lng,
        };
        setOffices(prev => [...prev, newOffice]);
        setShowAddOfficeModal(false);
        setNewOfficeDetails({ name: '', street: '', city: '', state: '', zip: '' });
      } else {
        alert("Could not find coordinates for the provided address. Please check the address and try again.");
      }
    } catch (error) {
      console.error("Error geocoding office address:", error);
      alert("An error occurred while trying to locate the office address.");
    } finally {
      setLoading(false);
    }
  };

  // --- Context Menu & Editing Actions ---

  const handlePolygonContextMenu = useCallback((id: string, x: number, y: number) => {
    // If drawing, ignore existing polygons context menu to avoid confusion
    if (isDrawing) return;
    setContextMenu({ x, y, polygonId: id });
  }, [isDrawing]);

  const handleEditPolygon = () => {
    if (!contextMenu) return;
    const polyToEdit = savedPolygons.find(p => p.id === contextMenu.polygonId);
    if (polyToEdit) {
      setEditingPolygon(polyToEdit);
      // Remove from saved list
      setSavedPolygons(prev => prev.filter(p => p.id !== contextMenu.polygonId));
      // Set as current drawing
      setPolygonPoints(polyToEdit.points);
      setIsDrawing(true);
      // We set isSearched to false implicitly because we are modifying geometry
      
      // Close info panel if open for this polygon
      if (selectedInfoPolygonId === contextMenu.polygonId) {
        setSelectedInfoPolygonId(null);
      }
    }
    setContextMenu(null);
  };

  const handleDeletePolygon = () => {
    if (!contextMenu) return;
    setSavedPolygons(prev => prev.filter(p => p.id !== contextMenu.polygonId));
    
    // Close info panel if open for this polygon
    if (selectedInfoPolygonId === contextMenu.polygonId) {
      setSelectedInfoPolygonId(null);
    }
    
    setContextMenu(null);
  };

  const handleSelectPolygonZips = (polygonId: string) => {
    const poly = savedPolygons.find(p => p.id === polygonId);
    if (poly) {
        setSelectedZips(prev => {
            const newSet = new Set(prev);
            poly.zips.forEach(zip => newSet.add(zip));
            return newSet;
        });
    }
  };

  const handleRenameStart = () => {
    if (!contextMenu) return;
    setEditingNameId(contextMenu.polygonId);
    setContextMenu(null);
  };

  const handleColorStart = () => {
    if (!contextMenu) return;
    setEditingColorId(contextMenu.polygonId);
    setContextMenu(null);
  };

  const handleDivideStart = () => {
    if (!contextMenu) return;
    setDividingPolygonId(contextMenu.polygonId);
    setIsDividing(true);
    setDivisionLinePoints([]);
    setContextMenu(null);
    // Ensure we are not in drawing mode
    setIsDrawing(false);
    setPolygonPoints([]);
  };

  const cancelDivision = () => {
    setIsDividing(false);
    setDividingPolygonId(null);
    setDivisionLinePoints([]);
    setShowDivisionConfirm(false);
  };

  const confirmDivision = () => {
    if (!dividingPolygonId || divisionLinePoints.length < 2) return;
    
    const polyToDivide = savedPolygons.find(p => p.id === dividingPolygonId);
    if (!polyToDivide) return;

    try {
      // 1. Convert to Turf objects
      const polyCoords = polyToDivide.points.map(p => [p[1], p[0]]);
      if (polyCoords[0][0] !== polyCoords[polyCoords.length-1][0] || polyCoords[0][1] !== polyCoords[polyCoords.length-1][1]) {
        polyCoords.push(polyCoords[0]);
      }
      const poly = turf.polygon([polyCoords]);
      const line = turf.lineString(divisionLinePoints.map(p => [p[1], p[0]]));

      // 2. Check if line starts and ends outside
      const startPoint = turf.point([divisionLinePoints[0][1], divisionLinePoints[0][0]]);
      const endPoint = turf.point([divisionLinePoints[divisionLinePoints.length - 1][1], divisionLinePoints[divisionLinePoints.length - 1][0]]);
      
      const startOutside = !turf.booleanPointInPolygon(startPoint, poly);
      const endOutside = !turf.booleanPointInPolygon(endPoint, poly);

      if (!startOutside || !endOutside) {
        alert("The division line must start and end outside the polygon.");
        return;
      }

      // 3. Perform the split
      // We'll use a large "half-plane" polygon to intersect
      const bbox = turf.bbox(poly);
      const expand = 5; // Large enough expansion
      
      // Create a huge polygon that wraps around one side of the line
      const lineCoords = divisionLinePoints.map(p => [p[1], p[0]]);
      
      // We need to find a point far away to one side of the line.
      // A simple way is to take the first and last points and find a perpendicular vector.
      const p1 = lineCoords[0];
      const p2 = lineCoords[lineCoords.length - 1];
      const dx = p2[0] - p1[0];
      const dy = p2[1] - p1[1];
      const length = Math.sqrt(dx*dx + dy*dy);
      const ux = -dy / length;
      const uy = dx / length;
      
      const farDist = 100; // Very far in degrees
      const farPoint1 = [p2[0] + ux * farDist, p2[1] + uy * farDist];
      const farPoint2 = [p1[0] + ux * farDist, p1[1] + uy * farDist];
      
      const halfPlane = turf.polygon([[...lineCoords, farPoint1, farPoint2, lineCoords[0]]]);
      
      const piece1Feature = turf.intersect(turf.featureCollection([poly, halfPlane]));
      if (!piece1Feature) {
        alert("Could not divide polygon. Make sure the line fully crosses the polygon.");
        return;
      }
      const piece2 = turf.difference(turf.featureCollection([poly, piece1Feature]));

      if (!piece2) {
        alert("Could not divide polygon. Make sure the line fully crosses the polygon.");
        return;
      }

      // 4. Create new polygon objects
      const extractPoints = (feature: any): [number, number][] => {
        if (!feature) return [];
        const geom = feature.geometry;
        let coords = geom.coordinates;
        
        // If MultiPolygon, take the first polygon
        if (geom.type === 'MultiPolygon') {
          coords = coords[0];
        }
        
        // Take the exterior ring
        const ring = coords[0];
        return ring.map((c: any) => [c[1], c[0]] as [number, number]);
      };

      const newPoly1Points = extractPoints(piece1Feature);
      const newPoly2Points = extractPoints(piece2);

      // Helper to find which active zips are in a set of points
      const getContainedZips = (pts: [number, number][]) => {
        if (pts.length < 3) return [];
        const coords = pts.map(p => [p[1], p[0]]);
        if (coords[0][0] !== coords[coords.length-1][0] || coords[0][1] !== coords[coords.length-1][1]) {
          coords.push(coords[0]);
        }
        const p = turf.polygon([coords]);
        return activeZips.filter(zipData => {
          const pt = turf.point([zipData.lng, zipData.lat]);
          return turf.booleanPointInPolygon(pt, p);
        }).map(z => z.zip);
      };

      const newPoly1: SavedPolygon = {
        id: `${Date.now()}-1-${Math.random().toString(36).substr(2, 9)}`,
        name: `${polyToDivide.name} (Part A)`,
        color: polyToDivide.color,
        points: newPoly1Points,
        brandId: polyToDivide.brandId,
        officeId: polyToDivide.officeId,
        zips: getContainedZips(newPoly1Points),
        visible: true,
        isSearched: false
      };

      const newPoly2: SavedPolygon = {
        id: `${Date.now()}-2-${Math.random().toString(36).substr(2, 9)}`,
        name: `${polyToDivide.name} (Part B)`,
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
        points: newPoly2Points,
        brandId: polyToDivide.brandId,
        officeId: polyToDivide.officeId,
        zips: getContainedZips(newPoly2Points),
        visible: true,
        isSearched: false
      };

      // 5. Remove old, add new to a queue for naming
      setSavedPolygons(prev => prev.filter(p => p.id !== dividingPolygonId));
      setPolygonsToName([newPoly1, newPoly2]);

      // Close info panel if open for the divided polygon
      if (selectedInfoPolygonId === dividingPolygonId) {
        setSelectedInfoPolygonId(null);
      }
      
      // Cleanup division state
      setIsDividing(false);
      setDividingPolygonId(null);
      setDivisionLinePoints([]);
      setShowDivisionConfirm(false);

    } catch (err) {
      console.error("Division error:", err);
      alert("An error occurred while dividing the polygon. Please try a simpler line.");
    }
  };

  const handleSaveNextQueuedPolygon = () => {
    if (polygonsToName.length === 0) return;
    
    const [current, ...remaining] = polygonsToName as [SavedPolygon, ...SavedPolygon[]];
    
    // Update current with user choices from modal
    const updated = {
      ...current,
      name: newPolygonName || current.name,
      color: newPolygonColor || current.color
    };

    setSavedPolygons(prev => [...prev, updated]);
    setPolygonsToName(remaining);
    
    // If more left, reset modal for next
    if (remaining.length > 0) {
      setNewPolygonName(remaining[0].name);
      setNewPolygonColor(remaining[0].color);
    } else {
      setShowNameModal(false);
    }
  };

  useEffect(() => {
    if (polygonsToName.length > 0) {
      setNewPolygonName(polygonsToName[0].name);
      setNewPolygonColor(polygonsToName[0].color);
      setShowNameModal(true);
    }
  }, [polygonsToName]);

  const updatePolygonColor = (id: string, color: string) => {
    setSavedPolygons(prev => prev.map(p => p.id === id ? { ...p, color } : p));
    setEditingColorId(null);
  };

  const updatePolygonName = (id: string, name: string) => {
    if (name.trim()) {
      setSavedPolygons(prev => prev.map(p => p.id === id ? { ...p, name } : p));
    }
    setEditingNameId(null);
  };

  const togglePolygonVisibility = (id: string) => {
    setSavedPolygons(prev => prev.map(p => p.id === id ? { ...p, visible: !p.visible } : p));
  };

  const togglePolygonSelection = (id: string, e?: React.MouseEvent) => {
    setSelectedPolygonIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
    if (e) {
      e.stopPropagation();
    }
  };

  const handlePolygonClick = (id: string) => {
    if (isDrawing || isDividing) return;
    setSelectedInfoPolygonId(id);
  };

  const updatePolygonDetails = (id: string, updates: Partial<SavedPolygon>) => {
    setSavedPolygons(prev => prev.map(p => p.id === id ? { ...p, ...updates } : p));
  };

  const handleMergePolygons = () => {
    if (selectedPolygonIds.size < 2) return;

    const polygonsToMerge = savedPolygons.filter(p => selectedPolygonIds.has(p.id));
    if (polygonsToMerge.length < 2) return;

    try {
      // 1. Convert to Turf features
      const features = polygonsToMerge.map(p => {
        const coords = p.points.map(pt => [pt[1], pt[0]]);
        // Ensure closed
        if (coords[0][0] !== coords[coords.length - 1][0] || coords[0][1] !== coords[coords.length - 1][1]) {
          coords.push(coords[0]);
        }
        return turf.polygon([coords]);
      });

      // 2. Perform Union
      let mergedFeature = features[0];
      for (let i = 1; i < features.length; i++) {
        const union = turf.union(turf.featureCollection([mergedFeature, features[i]]));
        if (union) {
          mergedFeature = union as any;
        }
      }

      // 3. Extract points from merged feature
      const extractPoints = (feature: any): [number, number][] => {
        if (!feature) return [];
        const geom = feature.geometry;
        let coords = geom.coordinates;
        
        // If MultiPolygon, take the first polygon (or handle multiple? for now first)
        if (geom.type === 'MultiPolygon') {
          coords = coords[0];
        }
        
        // Take the exterior ring
        const ring = coords[0];
        return ring.map((c: any) => [c[1], c[0]] as [number, number]);
      };

      const mergedPoints = extractPoints(mergedFeature);
      
      // 4. Combine zips based on new boundary
      const coords = mergedPoints.map(p => [p[1], p[0]]);
      if (coords[0][0] !== coords[coords.length-1][0] || coords[0][1] !== coords[coords.length-1][1]) {
        coords.push(coords[0]);
      }
      const poly = turf.polygon([coords]);
      const containedZips = activeZips.filter(zipData => {
        const pt = turf.point([zipData.lng, zipData.lat]);
        return turf.booleanPointInPolygon(pt, poly);
      }).map(z => z.zip);

      // 5. Create new polygon
      const newPoly: SavedPolygon = {
        id: `${Date.now()}-merged-${Math.random().toString(36).substr(2, 9)}`,
        name: `Merged Area (${polygonsToMerge.length})`,
        color: polygonsToMerge[0].color,
        points: mergedPoints,
        brandId: polygonsToMerge[0].brandId, // Inherit from first
        officeId: polygonsToMerge[0].officeId, // Inherit from first
        zips: containedZips,
        visible: true,
        isSearched: polygonsToMerge.some(p => p.isSearched)
      };

    // 6. Update state
    // We don't add to savedPolygons here because handleSaveNextQueuedPolygon will do it
    setSavedPolygons(prev => prev.filter(p => !selectedPolygonIds.has(p.id)));
    
    // Close info panel if it was open for one of the merged polygons
    if (selectedInfoPolygonId && selectedPolygonIds.has(selectedInfoPolygonId)) {
      setSelectedInfoPolygonId(null);
    }

    setSelectedPolygonIds(new Set());
    
    // Prompt for name/color
    setPolygonsToName([newPoly]);
      
    } catch (err) {
      console.error("Merge error:", err);
      alert("Failed to merge polygons. They might not be adjacent or have invalid geometry.");
    }
  };

  const handleAddSelectedToZips = () => {
    if (selectedPolygonIds.size === 0) return;

    const zipsToAdd = new Set<string>();
    savedPolygons.forEach(p => {
      if (selectedPolygonIds.has(p.id)) {
        p.zips.forEach(zip => zipsToAdd.add(zip));
      }
    });

    setSelectedZips(prev => new Set([...prev, ...zipsToAdd]));
    setSelectedPolygonIds(new Set()); // Deselect polygons after adding
  };

  // Vertex Editing
  const handleVertexClick = useCallback((index: number) => {
    if (isDrawing) {
      setSelectedVertexIndex(index);
    }
  }, [isDrawing]);

  const deleteSelectedVertex = () => {
    if (selectedVertexIndex !== null && polygonPoints.length > 0) {
      setPolygonPoints(prev => prev.filter((_, i) => i !== selectedVertexIndex));
      setSelectedVertexIndex(null);
    }
  };

  // Close context menu on map click
  useEffect(() => {
    const closeMenu = () => setContextMenu(null);
    window.addEventListener('click', closeMenu);
    return () => window.removeEventListener('click', closeMenu);
  }, []);

  // --- End Context Menu Actions ---

  const toggleZipSelection = useCallback((zip: string) => {
    setSelectedZips(prev => {
      const newSet = new Set(prev);
      if (newSet.has(zip)) {
        newSet.delete(zip);
      } else {
        newSet.add(zip);
      }
      return newSet;
    });
  }, []);

  const clearSelection = () => {
    setSelectedZips(new Set());
  };

  const handleMapClick = useCallback((lat: number, lng: number) => {
    if (isDrawing) {
      setPolygonPoints(prev => [...prev, [lat, lng] as [number, number]]);
      // Deselect vertex if clicking empty map space
      setSelectedVertexIndex(null);
    } else if (isDividing) {
      setDivisionLinePoints(prev => {
        const newPoints = [...prev, [lat, lng] as [number, number]];
        // If we have at least 2 points, check if we should show confirm
        if (newPoints.length >= 2) {
          // We'll let the user click a "Divide?" button instead of auto-confirming
          // but we can show the prompt once they have enough points.
        }
        return newPoints;
      });
    }
  }, [isDrawing, isDividing]);

  const handlePointUpdate = useCallback((index: number, lat: number, lng: number) => {
    setPolygonPoints(prev => {
      const newPoints = [...prev];
      newPoints[index] = [lat, lng];
      return newPoints;
    });
    // If moving a point, select it
    setSelectedVertexIndex(index);
  }, []);

  const toggleDrawingMode = () => {
    if (isDrawing) {
      discardPolygon();
    } else {
      setIsDrawing(true);
    }
    setSelectedVertexIndex(null);
  };

  const selectedZipList = useMemo(() => {
    return activeZips.filter(z => selectedZips.has(z.zip));
  }, [activeZips, selectedZips]);

  const canMergePolygons = useMemo(() => {
    if (selectedPolygonIds.size < 2) {
      return false;
    }

    const selectedPolygons = savedPolygons.filter(p => selectedPolygonIds.has(p.id));
    
    // Create a map of polygon points for quick lookup
    const polygonPointsMap = new Map<string, Set<string>>();
    selectedPolygons.forEach(p => {
      const pointsSet = new Set(p.points.map(pt => `${pt[0]},${pt[1]}`));
      polygonPointsMap.set(p.id, pointsSet);
    });

    // Adjacency list for the graph of selected polygons
    const adj = new Map<string, string[]>();
    selectedPolygons.forEach(p => adj.set(p.id, []));

    // Build the adjacency list by checking for shared vertices
    for (let i = 0; i < selectedPolygons.length; i++) {
      for (let j = i + 1; j < selectedPolygons.length; j++) {
        const poly1 = selectedPolygons[i];
        const poly2 = selectedPolygons[j];
        const points1 = polygonPointsMap.get(poly1.id)!;
        
        for (const p2 of poly2.points) {
          if (points1.has(`${p2[0]},${p2[1]}`)) {
            adj.get(poly1.id)!.push(poly2.id);
            adj.get(poly2.id)!.push(poly1.id);
            break; // Found a shared point, they are adjacent
          }
        }
      }
    }

    // Perform a graph traversal (DFS) to check for connectivity
    const visited = new Set<string>();
    const stack = [selectedPolygons[0].id];
    while (stack.length > 0) {
      const id = stack.pop()!;
      if (!visited.has(id)) {
        visited.add(id);
        adj.get(id)!.forEach(neighbor => stack.push(neighbor));
      }
    }

    // If we visited all selected polygons, they are all connected
    return visited.size === selectedPolygonIds.size;
  }, [selectedPolygonIds, savedPolygons]);

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-gray-100">
      {/* Mobile Header */}
      <div className="md:hidden absolute top-0 left-0 right-0 h-16 bg-white border-b z-50 flex items-center justify-between px-4 shadow-sm">
        <div className="flex items-center space-x-2">
          <MapIcon className="text-blue-600" size={24} />
          <h1 className="font-bold text-lg">Service Area Pro</h1>
        </div>
        <button 
          onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
        >
          {isSidebarOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {/* Sidebar Overlay */}
      <div 
        className={`
          absolute inset-y-0 left-0 z-40 w-80 bg-white border-r shadow-xl transition-transform duration-300 transform
          ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
          h-full flex flex-col pt-16 md:pt-0
        `}
      >
        <Sidebar 
          initialZip={initialZip}
          setInitialZip={setInitialZip}
          radius={radius}
          setRadius={setRadius}
          onSearch={handleLeadSearch}
          loading={loading && shouldFitBounds} 
          selectedZipList={activeZips.filter(z => selectedZips.has(z.zip))}
          onClear={clearSelection}
          onExport={() => setIsExportOpen(true)}
          toggleZipSelection={toggleZipSelection}
          onSaveLocal={handleSaveToLocalStorage}
          onLoadLocal={handleLoadFromLocalStorage}
          onExportFile={handleExportToFile}
          onImportFile={handleImportFromFile}
          savedPolygons={savedPolygons}
          leadPin={leadPin}
        />

        {/* Sidebar Toggle Tab (Desktop) */}
        <button
          onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          className={`
            hidden md:flex absolute top-1/2 -translate-y-1/2 left-full w-6 h-12 bg-white border border-l-0 border-gray-200 rounded-r-lg shadow-md items-center justify-center text-gray-400 hover:text-blue-600 transition-all z-50
          `}
          title={isSidebarOpen ? "Hide Sidebar" : "Show Sidebar"}
        >
          {isSidebarOpen ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
        </button>
      </div>

      {/* Main Content Area (Map - Full Screen) */}
      <div className="absolute inset-0 z-0 pt-16 md:pt-0">
        <MapView 
          center={mapCenter}
          zoom={zoom}
          showBaseMap={showBaseMap}
          availableZips={activeZips}
          selectedZips={selectedZips}
          onZipClick={toggleZipSelection}
          onMapChange={handleMapChange}
          shouldFitBounds={shouldFitBounds}
          isDrawing={isDrawing}
          polygonPoints={polygonPoints}
          savedPolygons={savedPolygons}
          onMapClick={handleMapClick}
          onPointUpdate={handlePointUpdate}
          onPolygonContextMenu={handlePolygonContextMenu}
          onVertexClick={handleVertexClick}
          selectedVertexIndex={selectedVertexIndex}
          showServiceAreas={showServiceAreas}
          showZipDots={showZipDots}
          showZipBoundaries={showZipBoundaries}
          isDividing={isDividing}
          divisionLinePoints={divisionLinePoints}
          dividingPolygonId={dividingPolygonId}
          selectedPolygonIds={selectedPolygonIds}
          onTogglePolygonSelection={toggleZipSelection}
          onPolygonClick={handlePolygonClick}
          selectedInfoPolygonId={selectedInfoPolygonId}
          offices={offices}
          leadPin={leadPin}
        />

        {/* Polygon Info Panel */}
        {selectedInfoPolygonId && savedPolygons.find(p => p.id === selectedInfoPolygonId) && (
          <PolygonInfoPanel 
            polygon={savedPolygons.find(p => p.id === selectedInfoPolygonId)!}
            onClose={() => setSelectedInfoPolygonId(null)}
            onSave={updatePolygonDetails}
            brands={brands}
            offices={offices}
          />
        )}

        {/* Add Brand Modal */}
        {showAddBrandModal && (
          <div className="absolute inset-0 z-[500] bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
             <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm animate-in zoom-in fade-in duration-200" onClick={(e) => e.stopPropagation()}>
                <h3 className="text-lg font-bold text-gray-900 mb-2">Add New Brand</h3>
                <p className="text-sm text-gray-500 mb-4">Enter a name for the new brand.</p>
                
                <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Brand Name</label>
                <input 
                  type="text" 
                  value={newBrandName}
                  onChange={(e) => setNewBrandName(e.target.value)}
                  placeholder="e.g. Awesome Inc."
                  className="w-full px-4 py-2 border rounded-xl mb-4 focus:ring-2 focus:ring-blue-500 outline-none"
                  autoFocus
                />

                <div className="flex space-x-3">
                  <button onClick={() => { setShowAddBrandModal(false); setNewBrandName(''); }} className="flex-1 py-2 text-gray-600 font-bold hover:bg-gray-100 rounded-lg">Cancel</button>
                  <button onClick={handleAddBrand} className="flex-1 py-2 bg-blue-600 text-white font-bold hover:bg-blue-700 rounded-lg shadow-lg">Add Brand</button>
                </div>
             </div>
          </div>
        )}

        {/* Add Office Modal */}
        {showAddOfficeModal && (
          <div className="absolute inset-0 z-[500] bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
             <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md animate-in zoom-in fade-in duration-200" onClick={(e) => e.stopPropagation()}>
                <h3 className="text-lg font-bold text-gray-900 mb-2">Add New Office</h3>
                <p className="text-sm text-gray-500 mb-4">Enter the details for the new office location.</p>
                
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Office Name</label>
                    <input type="text" value={newOfficeDetails.name} onChange={(e) => setNewOfficeDetails(p => ({...p, name: e.target.value}))} placeholder="e.g. Downtown Branch" className="w-full px-3 py-2 border rounded-lg text-sm" autoFocus />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Street Address</label>
                    <input type="text" value={newOfficeDetails.street} onChange={(e) => setNewOfficeDetails(p => ({...p, street: e.target.value}))} placeholder="123 Main St" className="w-full px-3 py-2 border rounded-lg text-sm" />
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="block text-xs font-bold text-gray-400 uppercase mb-1">City</label>
                      <input type="text" value={newOfficeDetails.city} onChange={(e) => setNewOfficeDetails(p => ({...p, city: e.target.value}))} placeholder="Anytown" className="w-full px-3 py-2 border rounded-lg text-sm" />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-400 uppercase mb-1">State</label>
                      <input type="text" value={newOfficeDetails.state} onChange={(e) => setNewOfficeDetails(p => ({...p, state: e.target.value}))} placeholder="CA" className="w-full px-3 py-2 border rounded-lg text-sm" />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Zip Code</label>
                      <input type="text" value={newOfficeDetails.zip} onChange={(e) => setNewOfficeDetails(p => ({...p, zip: e.target.value}))} placeholder="12345" className="w-full px-3 py-2 border rounded-lg text-sm" />
                    </div>
                  </div>
                </div>

                <div className="flex space-x-3 mt-6">
                  <button onClick={() => { setShowAddOfficeModal(false); setNewOfficeDetails({ name: '', street: '', city: '', state: '', zip: '' }); }} className="flex-1 py-2 text-gray-600 font-bold hover:bg-gray-100 rounded-lg">Cancel</button>
                  <button onClick={handleAddOffice} disabled={loading} className="flex-1 py-2 bg-blue-600 text-white font-bold hover:bg-blue-700 rounded-lg shadow-lg disabled:bg-blue-300 flex items-center justify-center">{loading ? <Loader2 className="animate-spin" size={16} /> : 'Add Office'}</button>
                </div>
             </div>
          </div>
        )}

        {/* Global Loading Indicator (for manual/poly searches) */}
        {loading && !shouldFitBounds && !searchingPolygonId && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[400]">
              <div className="bg-white/90 backdrop-blur text-gray-800 px-4 py-2 rounded-full shadow-lg flex items-center space-x-2 border border-gray-200 animate-in fade-in slide-in-from-top-4">
                  <Loader2 className="animate-spin text-blue-600" size={16} />
                  <span className="text-xs font-bold">Searching area...</span>
              </div>
            </div>
        )}

        {/* --- MODALS & MENUS --- */}

        {/* Naming Modal */}
        {showNameModal && (
          <div className="absolute inset-0 z-[500] bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
             <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm animate-in zoom-in fade-in duration-200" onClick={(e) => e.stopPropagation()}>
                <h3 className="text-lg font-bold text-gray-900 mb-2">Save Service Area</h3>
                <p className="text-sm text-gray-500 mb-4">Name your area and choose a color to identify it on the map.</p>
                
                <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Area Name</label>
                <input 
                  type="text" 
                  value={newPolygonName}
                  onChange={(e) => setNewPolygonName(e.target.value)}
                  placeholder="e.g. North Region"
                  className="w-full px-4 py-2 border rounded-xl mb-4 focus:ring-2 focus:ring-blue-500 outline-none"
                  autoFocus
                />

                <label className="block text-xs font-bold text-gray-400 uppercase mb-2">Area Color</label>
                <div className="flex flex-wrap gap-2 mb-6">
                  {COLORS.map(color => (
                    <button
                      key={color}
                      onClick={() => setNewPolygonColor(color)}
                      className={`w-8 h-8 rounded-full border-2 transition-transform ${newPolygonColor === color ? 'border-gray-800 scale-110' : 'border-transparent hover:scale-105'}`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>

                <div className="flex space-x-3">
                  <button onClick={discardPolygon} className="flex-1 py-2 text-gray-600 font-bold hover:bg-gray-100 rounded-lg">Discard</button>
                  <button 
                    onClick={polygonsToName.length > 0 ? handleSaveNextQueuedPolygon : savePolygon} 
                    className="flex-1 py-2 bg-blue-600 text-white font-bold hover:bg-blue-700 rounded-lg shadow-lg"
                  >
                    {polygonsToName.length > 0 ? 'Save & Next' : 'Save Geometry'}
                  </button>
                </div>
             </div>
          </div>
        )}

        {/* Rename Modal */}
        {editingNameId && (
          <div className="absolute inset-0 z-[500] bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
             <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm animate-in zoom-in fade-in duration-200" onClick={(e) => e.stopPropagation()}>
                <h3 className="text-lg font-bold text-gray-900 mb-4">Rename Area</h3>
                <input 
                  type="text" 
                  defaultValue={savedPolygons.find(p => p.id === editingNameId)?.name}
                  onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => {
                    if (e.key === 'Enter') updatePolygonName(editingNameId, e.currentTarget.value);
                  }}
                  className="w-full px-4 py-2 border rounded-xl mb-4 focus:ring-2 focus:ring-blue-500 outline-none"
                  autoFocus
                  onBlur={(e) => updatePolygonName(editingNameId, e.target.value)}
                />
                <button onClick={() => setEditingNameId(null)} className="w-full py-2 text-gray-500 hover:text-gray-800 font-medium">Cancel</button>
             </div>
          </div>
        )}

        {/* Color Change Modal */}
        {editingColorId && (
          <div className="absolute inset-0 z-[500] bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
             <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm animate-in zoom-in fade-in duration-200" onClick={(e) => e.stopPropagation()}>
                <h3 className="text-lg font-bold text-gray-900 mb-4">Change Color</h3>
                <div className="flex flex-wrap gap-2 mb-4 justify-center">
                  {COLORS.map(color => (
                    <button
                      key={color}
                      onClick={() => updatePolygonColor(editingColorId, color)}
                      className={`w-10 h-10 rounded-full border-2 transition-transform hover:scale-110`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
                <button onClick={() => setEditingColorId(null)} className="w-full py-2 text-gray-500 hover:text-gray-800 font-medium">Cancel</button>
             </div>
          </div>
        )}

        {/* Context Menu */}
        {contextMenu && (
          <div 
            className="absolute z-[600] bg-white rounded-lg shadow-xl border border-gray-100 py-1 min-w-[160px] animate-in fade-in zoom-in-95 duration-100 origin-top-left"
            style={{ top: contextMenu.y, left: contextMenu.x }}
            onClick={(e) => e.stopPropagation()}
          >
             <button onClick={() => { if(contextMenu) handleSelectPolygonZips(contextMenu.polygonId); setContextMenu(null); }} className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center">
               <PlusCircle size={14} className="mr-2" /> Select All Zips
             </button>
             <button onClick={handleEditPolygon} className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center">
               <Edit2 size={14} className="mr-2" /> Edit Geometry
             </button>
             <button onClick={handleRenameStart} className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center">
               <Type size={14} className="mr-2" /> Rename
             </button>
             <button onClick={handleColorStart} className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center">
               <Palette size={14} className="mr-2" /> Change Color
             </button>
             <button onClick={handleDivideStart} className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center">
               <Layers size={14} className="mr-2" /> Divide Area
             </button>
             <div className="h-px bg-gray-100 my-1"></div>
             <button onClick={handleDeletePolygon} className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center">
               <Trash2 size={14} className="mr-2" /> Delete Area
             </button>
          </div>
        )}

        {/* Floating Actions Container (Bottom Center) */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-[400] flex flex-col items-center space-y-3 pointer-events-none">
           
           {/* Polygon Controls */}
           <div className="pointer-events-auto flex items-center space-x-2">
              {isDrawing ? (
                 <div className="flex items-center space-x-2 animate-in slide-in-from-bottom-4 fade-in">
                    <button 
                      onClick={toggleDrawingMode}
                      className="bg-red-500 hover:bg-red-600 text-white px-4 py-2.5 rounded-full shadow-lg font-bold text-sm flex items-center space-x-2 transition-all active:scale-95"
                    >
                      <XCircle size={16} />
                      <span>Cancel</span>
                    </button>
                    {/* Delete Point Button (Visible if vertex selected) */}
                    {selectedVertexIndex !== null && (
                      <button 
                        onClick={deleteSelectedVertex}
                        className="bg-red-600 hover:bg-red-700 text-white px-3 py-2.5 rounded-full shadow-lg font-bold text-sm flex items-center space-x-2 transition-all active:scale-95"
                        title="Delete Selected Point"
                      >
                        <Trash2 size={16} />
                        <span className="sr-only">Delete Point</span>
                      </button>
                    )}
                    <button 
                      onClick={handleInitiateSave}
                      disabled={polygonPoints.length < 3}
                      className="bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white px-4 py-2.5 rounded-full shadow-lg font-bold text-sm flex items-center space-x-2 transition-all active:scale-95"
                    >
                      <Save size={16} />
                      <span>Save Area ({polygonPoints.length} pts)</span>
                    </button>
                 </div>
              ) : isDividing ? (
                <div className="flex items-center space-x-2 animate-in slide-in-from-bottom-4 fade-in">
                   <button 
                     onClick={cancelDivision}
                     className="bg-red-500 hover:bg-red-600 text-white px-4 py-2.5 rounded-full shadow-lg font-bold text-sm flex items-center space-x-2 transition-all active:scale-95"
                   >
                     <XCircle size={16} />
                     <span>Cancel Division</span>
                   </button>
                   <button 
                     onClick={confirmDivision}
                     disabled={divisionLinePoints.length < 2}
                     className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white px-6 py-2.5 rounded-full shadow-lg font-bold text-sm flex items-center space-x-2 transition-all active:scale-95"
                   >
                     <Layers size={16} />
                     <span>Divide? ({divisionLinePoints.length} pts)</span>
                   </button>
                </div>
              ) : (
                /* Primary "Search This View" Button (Only if not drawing) */
                 null
              )}
           </div>

           {/* Drawing Mode Toggle (Always visible if not loading) */}
           {!loading && !isDrawing && (
              <button 
                onClick={toggleDrawingMode}
                className="pointer-events-auto bg-gray-900 hover:bg-black text-white px-4 py-2 rounded-full shadow-lg font-medium text-xs flex items-center space-x-2 transition-all active:scale-95 opacity-90 hover:opacity-100"
              >
                <PenTool size={12} />
                <span>Draw Custom Area</span>
              </button>
           )}
           
           {/* Hint text if drawing */}
           {isDrawing && (
             <div className="bg-white/80 backdrop-blur px-3 py-1 rounded-full text-[10px] font-bold text-gray-600 border border-gray-200 shadow-sm animate-in fade-in">
                {selectedVertexIndex !== null 
                  ? "Point selected. Drag to move or use trash icon to delete." 
                  : "Click map to add points. Drag points to adjust."}
             </div>
           )}

           {isDividing && (
             <div className="bg-white/80 backdrop-blur px-3 py-1 rounded-full text-[10px] font-bold text-gray-600 border border-gray-200 shadow-sm animate-in fade-in">
                Draw a line starting outside, crossing through, and ending outside the area to divide it.
             </div>
           )}
        </div>
        
        {/* Unified Map Overlay Controls (Top Right) */}
        <div className="absolute top-4 right-4 z-[400] flex flex-col space-y-2 pointer-events-none w-72">
          
          {/* Main Panel */}
          <div className="bg-white/90 backdrop-blur rounded-lg shadow-lg border border-gray-200 overflow-hidden pointer-events-auto">
            {/* Header / Status */}
            <div className="p-3 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
               <div className="flex items-center space-x-2">
                  <Layers size={14} className="text-gray-500" />
                  <span className="text-xs font-bold text-gray-700 uppercase tracking-wide">Layers</span>
                  <span className="bg-blue-100 text-blue-700 text-[10px] font-bold px-1.5 py-0.5 rounded">
                   {selectedZips.size} Selected
                 </span>
               </div>
            </div>

            <div className="p-2 space-y-2">
               {/* Search/Filter Polygons */}
               <div className="px-2 pb-2">
                 <div className="relative">
                   <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" />
                   <input
                     type="text"
                     placeholder="Filter areas or trades..."
                     value={polygonFilter}
                     onChange={(e) => setPolygonFilter(e.target.value)}
                     className="w-full pl-7 pr-2 py-1.5 bg-gray-50 border border-gray-200 rounded-md text-[10px] focus:ring-1 focus:ring-blue-500 outline-none transition-all"
                   />
                 </div>
               </div>

               {/* Base Map Toggle */}
               <button
                 onClick={() => setShowBaseMap(!showBaseMap)}
                 className={`w-full flex items-center justify-between px-2 py-1.5 rounded-md text-xs font-medium transition-colors ${showBaseMap ? 'bg-blue-50 text-blue-700' : 'hover:bg-gray-100 text-gray-600'}`}
               >
                 <div className="flex items-center space-x-2">
                   <MapIcon size={14} />
                   <span>Base Map</span>
                 </div>
                 {showBaseMap ? <Eye size={14} /> : <EyeOff size={14} />}
               </button>

               <button
                 onClick={() => setShowServiceAreas(!showServiceAreas)}
                 className={`w-full flex items-center justify-between px-2 py-1.5 rounded-md text-xs font-medium transition-colors ${showServiceAreas ? 'bg-blue-50 text-blue-700' : 'hover:bg-gray-100 text-gray-600'}`}
               >
                 <div className="flex items-center space-x-2"><SquareDashedBottom size={14} /><span>Service Areas</span></div>
                 {showServiceAreas ? <Eye size={14} /> : <EyeOff size={14} />}
               </button>

               <button
                 onClick={() => setShowZipDots(!showZipDots)}
                 className={`w-full flex items-center justify-between px-2 py-1.5 rounded-md text-xs font-medium transition-colors ${showZipDots ? 'bg-blue-50 text-blue-700' : 'hover:bg-gray-100 text-gray-600'}`}
               >
                 <div className="flex items-center space-x-2"><Dot size={14} /><span>Zip Dots</span></div>
                 {showZipDots ? <Eye size={14} /> : <EyeOff size={14} />}
               </button>

               <button
                 onClick={() => setShowZipBoundaries(!showZipBoundaries)}
                 className={`w-full flex items-center justify-between px-2 py-1.5 rounded-md text-xs font-medium transition-colors ${showZipBoundaries ? 'bg-blue-50 text-blue-700' : 'hover:bg-gray-100 text-gray-600'}`}
               >
                 <div className="flex items-center space-x-2"><Layers size={14} /><span>Zip Boundaries</span></div>
                 {showZipBoundaries ? <Eye size={14} /> : <EyeOff size={14} />}
               </button>

            </div>

            {/* Add Selected Polygons' Zips Button */}
            {selectedPolygonIds.size > 0 && (
              <button
                onClick={handleAddSelectedToZips}
                className="w-full py-2 text-sm font-bold bg-blue-600 text-white hover:bg-blue-700 rounded-xl shadow-lg transition-all flex items-center justify-center space-x-2 mt-2"
              >
                <PlusCircle size={16} />
                <span>Add Selected To Zips</span>
              </button>
            )}


            {/* Merge Polygons Button (Moved to bottom of Layers sidebar) */}
            {canMergePolygons && (
              <button 
                onClick={handleMergePolygons}
                className="w-full py-2 text-sm font-bold bg-gray-900 text-white hover:bg-black rounded-xl shadow-lg transition-all flex items-center justify-center space-x-2 mt-4"
              >
                <Combine size={16} />
                <span>Merge Selected Areas</span>
              </button>
            )}
          </div>

          {/* Brands Panel */}
          <div className="bg-white/90 backdrop-blur rounded-lg shadow-lg border border-gray-200 overflow-hidden pointer-events-auto mt-2">
            <div className="p-3 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
              <div className="flex items-center space-x-2">
                <Building size={14} className="text-gray-500" />
                <span className="text-xs font-bold text-gray-700 uppercase tracking-wide">Brands</span>
              </div>
              <button onClick={() => setShowAddBrandModal(true)} className="text-[10px] font-bold text-blue-600 hover:text-blue-700">Add</button>
            </div>
            <div className="p-2 space-y-1 max-h-64 overflow-y-auto custom-scrollbar">
              {/* Unassigned Areas */}
              <div className="text-xs">
                <div className="font-bold px-2 py-1 text-gray-500">Unassigned</div>
                <div className="pl-4">
                  {savedPolygons
                    .filter(p => !p.officeId && (polygonFilter ? p.name.toLowerCase().includes(polygonFilter.toLowerCase()) || p.trades?.some(t => t.name.toLowerCase().includes(polygonFilter.toLowerCase())) : true))
                    .map(p => (
                      <div key={p.id} onClick={() => handlePolygonClick(p.id)} className={`flex items-center justify-between text-xs group rounded px-2 py-1.5 transition-colors cursor-pointer ${selectedInfoPolygonId === p.id ? 'bg-blue-100' : (selectedPolygonIds.has(p.id) ? 'bg-blue-50/50' : 'hover:bg-gray-50')}`}>
                        <div className="flex items-center text-gray-700 flex-1 min-w-0 mr-2">
                          <div onClick={(e) => { e.stopPropagation(); togglePolygonSelection(p.id, e); }} className={`w-4 h-4 rounded border flex items-center justify-center mr-2 transition-colors cursor-pointer shrink-0 ${selectedPolygonIds.has(p.id) ? 'bg-blue-600 border-blue-600' : 'bg-white border-gray-300 hover:border-blue-400'}`}>
                            {selectedPolygonIds.has(p.id) && <CheckCircle2 size={10} className="text-white" />}
                          </div>
                          <div className="w-2 h-2 rounded-full mr-2 shrink-0" style={{ backgroundColor: p.color }}></div>
                          <div className="flex flex-col truncate">
                            <span className={`truncate font-medium ${!p.visible && 'text-gray-400 line-through'}`}>{p.name}</span>
                            <div className="flex items-center space-x-1.5">
                              <span className="text-[9px] text-gray-400 font-medium">{p.zips.length} zips</span>
                              {!p.isSearched && !searchingPolygonId && (
                                <span className="text-[9px] text-amber-600 font-bold">Unsearched</span>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center space-x-1">
                          {!p.isSearched && (
                            <button
                              onClick={(e) => handleSearchSavedPolygon(p.id, e)}
                              disabled={!!searchingPolygonId}
                              className={`p-1 rounded transition-colors ${searchingPolygonId === p.id ? 'bg-blue-100 text-blue-600' : 'hover:bg-blue-100 text-gray-400 hover:text-blue-600'}`}
                              title="Search for zips in this area"
                            >
                              {searchingPolygonId === p.id ? <Loader2 size={12} className="animate-spin" /> : <Search size={12} />}
                            </button>
                          )}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              togglePolygonVisibility(p.id);
                            }}
                            className="p-1 hover:bg-gray-200 rounded text-gray-400 hover:text-gray-700"
                            title="Toggle Visibility"
                          >
                            {p.visible ? <Eye size={12} /> : <EyeOff size={12} />}
                          </button>
                          <button
                            className="p-1 hover:bg-gray-200 rounded text-gray-400 hover:text-gray-700"
                            onClick={(e) => {
                              e.stopPropagation();
                              const rect = e.currentTarget.getBoundingClientRect();
                              setContextMenu({ x: rect.left - 150, y: rect.top, polygonId: p.id });
                            }}
                          >
                            <MoreVertical size={12} />
                          </button>
                        </div>
                      </div>
                    ))}
                </div>
              </div>

              {/* Brands List */}
              {brands.map(brand => (
                <div key={brand.id} className="text-xs">
                  <div className="font-bold px-2 py-1 text-gray-800 flex justify-between items-center">
                    <span>{brand.name}</span>
                    <button onClick={() => handleOpenAddOfficeModal(brand.id)} className="text-[10px] font-bold text-blue-600 hover:text-blue-700">Add Office</button>
                  </div>
                  <div className="pl-4">
                    {/* Unassigned Offices for this brand */}
                    {offices.filter(o => o.brandId === brand.id && !savedPolygons.some(p => p.officeId === o.id)).map(office => (
                       <div key={office.id} className="font-medium px-2 py-1 text-gray-500">{office.name} (No areas)</div>
                    ))}
                    {/* Offices with Areas */}
                    {offices.filter(o => o.brandId === brand.id && savedPolygons.some(p => p.officeId === o.id)).map(office => (
                      <div key={office.id}>
                        <div className="font-medium px-2 py-1 text-gray-600 flex items-center">
                          <Building2 size={12} className="mr-1.5 shrink-0" />
                          {office.name}
                        </div>
                        <div className="pl-4">
                          {savedPolygons
                            .filter(p => p.officeId === office.id && (polygonFilter ? p.name.toLowerCase().includes(polygonFilter.toLowerCase()) || p.trades?.some(t => t.name.toLowerCase().includes(polygonFilter.toLowerCase())) : true))
                            .map(p => (
                              <div key={p.id} onClick={() => handlePolygonClick(p.id)} className={`flex items-center justify-between text-xs group rounded px-2 py-1.5 transition-colors cursor-pointer ${selectedInfoPolygonId === p.id ? 'bg-blue-100' : (selectedPolygonIds.has(p.id) ? 'bg-blue-50/50' : 'hover:bg-gray-50')}`}>
                                <div className="flex items-center text-gray-700 flex-1 min-w-0 mr-2">
                                  <div onClick={(e) => { e.stopPropagation(); togglePolygonSelection(p.id, e); }} className={`w-4 h-4 rounded border flex items-center justify-center mr-2 transition-colors cursor-pointer shrink-0 ${selectedPolygonIds.has(p.id) ? 'bg-blue-600 border-blue-600' : 'bg-white border-gray-300 hover:border-blue-400'}`}>
                                    {selectedPolygonIds.has(p.id) && <CheckCircle2 size={10} className="text-white" />}
                                  </div>
                                  <div className="w-2 h-2 rounded-full mr-2 shrink-0" style={{ backgroundColor: p.color }}></div>
                                  <div className="flex flex-col truncate">
                                    <span className={`truncate font-medium ${!p.visible && 'text-gray-400 line-through'}`}>{p.name}</span>
                                    <div className="flex items-center space-x-1.5">
                                      <span className="text-[9px] text-gray-400 font-medium">{p.zips.length} zips</span>
                                      {!p.isSearched && !searchingPolygonId && (
                                        <span className="text-[9px] text-amber-600 font-bold">Unsearched</span>
                                      )}
                                    </div>
                                  </div>
                                </div>
                                <div className="flex items-center space-x-1">
                                  {!p.isSearched && (
                                    <button
                                      onClick={(e) => handleSearchSavedPolygon(p.id, e)}
                                      disabled={!!searchingPolygonId}
                                      className={`p-1 rounded transition-colors ${searchingPolygonId === p.id ? 'bg-blue-100 text-blue-600' : 'hover:bg-blue-100 text-gray-400 hover:text-blue-600'}`}
                                      title="Search for zips in this area"
                                    >
                                      {searchingPolygonId === p.id ? <Loader2 size={12} className="animate-spin" /> : <Search size={12} />}
                                    </button>
                                  )}
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      togglePolygonVisibility(p.id);
                                    }}
                                    className="p-1 hover:bg-gray-200 rounded text-gray-400 hover:text-gray-700"
                                    title="Toggle Visibility"
                                  >
                                    {p.visible ? <Eye size={12} /> : <EyeOff size={12} />}
                                  </button>
                                  <button
                                    className="p-1 hover:bg-gray-200 rounded text-gray-400 hover:text-gray-700"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      const rect = e.currentTarget.getBoundingClientRect();
                                      setContextMenu({ x: rect.left - 150, y: rect.top, polygonId: p.id });
                                    }}
                                  >
                                    <MoreVertical size={12} />
                                  </button>
                                </div>
                              </div>
                            ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}

              {/* Unassigned Offices */}
              {offices.filter(o => !o.brandId).length > 0 && (
                <div className="text-xs pt-2 border-t border-gray-100">
                  <div className="font-bold px-2 py-1 text-gray-500">Unassigned Offices</div>
                  <div className="pl-4">
                    {offices.filter(o => !o.brandId).map(office => (
                      <div key={office.id} className="font-medium px-2 py-1 text-gray-600 flex items-center">
                        <Building2 size={12} className="mr-1.5 shrink-0" />
                        {office.name}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {isExportOpen && (
        <ExportModal 
          selectedZips={Array.from(selectedZips)}
          onClose={() => setIsExportOpen(false)}
        />
      )}
    </div>
  );
};

export default App;
