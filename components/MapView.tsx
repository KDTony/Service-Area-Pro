
import React, { useEffect, useRef, useState } from 'react';
import { ZipCodeData, SavedPolygon } from '../types';
import { GripHorizontal } from 'lucide-react';

declare const L: any;

interface MapViewProps {
  center: [number, number];
  zoom: number;
  showBaseMap: boolean;
  availableZips: ZipCodeData[];
  selectedZips: Set<string>;
  onZipClick: (zip: string) => void;
  onMapChange?: (bounds: { north: number; south: number; east: number; west: number; zoom: number }) => void;
  shouldFitBounds?: boolean;
  isDrawing: boolean;
  polygonPoints: [number, number][];
  savedPolygons?: SavedPolygon[];
  onMapClick: (lat: number, lng: number) => void;
  onPointUpdate?: (index: number, lat: number, lng: number) => void;
  onPolygonContextMenu?: (id: string, x: number, y: number) => void;
  onVertexClick?: (index: number) => void;
  selectedVertexIndex?: number | null;
  isDividing?: boolean;
  divisionLinePoints?: [number, number][];
  dividingPolygonId?: string | null;
  selectedPolygonIds?: Set<string>;
  onTogglePolygonSelection?: (id: string) => void;
  onPolygonClick?: (id: string) => void;
  leadPin?: [number, number] | null;
}

const MapView: React.FC<MapViewProps> = ({ 
  center, 
  zoom, 
  showBaseMap,
  availableZips, 
  selectedZips, 
  onZipClick, 
  onMapChange,
  shouldFitBounds = true,
  isDrawing,
  polygonPoints,
  savedPolygons = [],
  onMapClick,
  onPointUpdate,
  onPolygonContextMenu,
  onVertexClick,
  selectedVertexIndex,
  isDividing = false,
  divisionLinePoints = [],
  dividingPolygonId = null,
  selectedPolygonIds = new Set(),
  onTogglePolygonSelection,
  onPolygonClick,
  leadPin = null
}) => {
  const mapRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const markersRef = useRef<{ [key: string]: any }>({}); 
  const leadPinRef = useRef<any>(null);
  const drawnLayerRef = useRef<any>(null); // For the polygon being drawn
  const divisionLayerRef = useRef<any>(null); // For the division line
  const savedPolygonsLayerRef = useRef<any>(null); // For saved polygons
  const tileLayerRef = useRef<any>(null);
  const initialLoadRef = useRef(true);
  const selectedZipsRef = useRef(selectedZips);
  
  // Use a ref to store the latest callback to avoid re-binding Leaflet events
  const onMapChangeRef = useRef(onMapChange);
  const onMapClickRef = useRef(onMapClick);
  const isDrawingRef = useRef(isDrawing);

  // View State
  const [currentZoom, setCurrentZoom] = useState(zoom);

  // Update refs when props change
  useEffect(() => {
    onMapChangeRef.current = onMapChange;
    onMapClickRef.current = onMapClick;
    isDrawingRef.current = isDrawing || isDividing;
  }, [onMapChange, onMapClick, isDrawing, isDividing]);

  // Keep selectedZipsRef in sync for event listeners
  useEffect(() => {
    selectedZipsRef.current = selectedZips;
  }, [selectedZips]);

  // Initialize Map
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      zoomControl: false,
      attributionControl: false,
      renderer: L.canvas(),
      minZoom: 4
    }).setView(center, zoom);

    // Create custom panes to control layer order
    map.createPane('polygonPane');
    map.getPane('polygonPane').style.zIndex = 450; // Polygons go here, behind dots but above tiles

    map.createPane('zipDotPane');
    map.getPane('zipDotPane').style.zIndex = 500; // Zip dots go on top to be clickable

    // Add Zoom Control
    L.control.zoom({ position: 'bottomright' }).addTo(map);
    L.control.attribution({ position: 'bottomright' }).addTo(map);

    // Create Tile Layer
    const tileLayer = L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
      subdomains: 'abcd',
      maxZoom: 20
    });
    
    tileLayerRef.current = tileLayer;
    
    if (showBaseMap) {
      tileLayer.addTo(map);
    }

    // Handle Movement and Zoom
    const handleMapEvent = () => {
      const z = map.getZoom();
      setCurrentZoom(z);

      const bounds = map.getBounds();
      
      if (onMapChangeRef.current) {
        onMapChangeRef.current({
          north: bounds.getNorth(),
          south: bounds.getSouth(),
          east: bounds.getEast(),
          west: bounds.getWest(),
          zoom: z
        });
      }
    };

    // Handle Map Clicks (for Drawing)
    const handleMapClick = (e: any) => {
      if (isDrawingRef.current && onMapClickRef.current) {
        onMapClickRef.current(e.latlng.lat, e.latlng.lng);
      }
    };

    map.on('moveend', handleMapEvent);
    map.on('zoomend', handleMapEvent);
    map.on('click', handleMapClick);

    // Trigger immediately to report initial bounds
    handleMapEvent();

    mapRef.current = map;
    savedPolygonsLayerRef.current = L.featureGroup().addTo(map);

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  // Handle Saved Polygons (Solid style, colored, right-clickable)
  useEffect(() => {
    if (!mapRef.current || !savedPolygonsLayerRef.current) return;

    savedPolygonsLayerRef.current.clearLayers();

    savedPolygons.forEach(poly => {
        if (!poly.visible) return; // Skip invisible polygons

        const isBeingDivided = dividingPolygonId === poly.id;
        const isSelected = selectedPolygonIds.has(poly.id);

        const layer = L.polygon(poly.points, {
            color: isBeingDivided ? '#3b82f6' : (isSelected ? '#2563eb' : poly.color), 
            weight: (isBeingDivided || isSelected) ? 4 : 2,
            opacity: 1, // Solid line
            fillColor: poly.color,
            fillOpacity: isBeingDivided ? 0.4 : (isSelected ? 0.5 : 0.2), 
            dashArray: isBeingDivided ? '5, 5' : null,
            pane: 'polygonPane'
        });

        // Click handler for selection
        layer.on('click', (e: any) => {
            L.DomEvent.stopPropagation(e);
            if (isDrawingRef.current) return;
            
            // If shift key or something? No, let's just toggle selection if onTogglePolygonSelection is there
            // But user wants an info panel. 
            // Let's say: if onPolygonClick is provided, call it.
            if (onPolygonClick) {
                onPolygonClick(poly.id);
            } else if (onTogglePolygonSelection) {
                onTogglePolygonSelection(poly.id);
            }
        });

        // Right-click handler for context menu
        layer.on('contextmenu', (e: any) => {
            L.DomEvent.stopPropagation(e);
            L.DomEvent.preventDefault(e); // Prevent browser context menu
            if (onPolygonContextMenu) {
                onPolygonContextMenu(poly.id, e.originalEvent.clientX, e.originalEvent.clientY);
            }
        });

        layer.bindTooltip(poly.name, {
            permanent: true,
            direction: 'center',
            className: 'polygon-label'
        });

        layer.addTo(savedPolygonsLayerRef.current);
    });
  }, [savedPolygons, onPolygonContextMenu]);

  // Handle Drawing Layer (Dashed style, Red, Draggable Vertices)
  useEffect(() => {
    if (!mapRef.current) return;

    // Clear existing drawn layer
    if (drawnLayerRef.current) {
      drawnLayerRef.current.remove();
      drawnLayerRef.current = null;
    }

    if (polygonPoints.length > 0) {
      // Create a feature group for the drawing elements (lines + vertex markers)
      const group = L.featureGroup();

      // Create the shape (Line or Polygon) - Keep dashed for editing state
      const polyLayer = polygonPoints.length > 2 
        ? L.polygon(polygonPoints, { color: '#ef4444', weight: 3, dashArray: '5, 10', fillColor: '#ef4444', fillOpacity: 0.1 })
        : L.polyline(polygonPoints, { color: '#ef4444', weight: 3, dashArray: '5, 10' });
      
      polyLayer.addTo(group);

      // Add draggable markers for vertices
      polygonPoints.forEach((point, index) => {
        const isSelected = selectedVertexIndex === index;

        const icon = L.divIcon({
          className: `vertex-marker ${isSelected ? 'selected' : ''}`,
          iconSize: isSelected ? [16, 16] : [12, 12],
          iconAnchor: isSelected ? [8, 8] : [6, 6]
        });

        const marker = L.marker(point, { 
          icon, 
          draggable: isDrawing, // Allow dragging if in drawing mode
          bubblingMouseEvents: false,
          zIndexOffset: isSelected ? 1000 : 0
        });

        // Snapping Helper Function
        const snapToTarget = (latLng: any) => {
            if (!mapRef.current) return { pos: latLng, snapped: false };
            const map = mapRef.current;
            const mousePt = map.latLngToContainerPoint(latLng);
            const THRESHOLD = 15; // px
            
            let closest = THRESHOLD;
            let snapPos = null;
            
            // 1. Check saved polygons
            if (savedPolygons) {
              savedPolygons.forEach(poly => {
                  if (!poly.visible) return;
                  poly.points.forEach(p => {
                      const ptLatLng = L.latLng(p[0], p[1]);
                      const ptPx = map.latLngToContainerPoint(ptLatLng);
                      const dist = mousePt.distanceTo(ptPx);
                      if (dist < closest) {
                          closest = dist;
                          snapPos = ptLatLng;
                      }
                  });
              });
            }
            
            // 2. Check current polygon (excluding self)
            polygonPoints.forEach((p, i) => {
                if (i === index) return;
                const ptLatLng = L.latLng(p[0], p[1]);
                const ptPx = map.latLngToContainerPoint(ptLatLng);
                const dist = mousePt.distanceTo(ptPx);
                if (dist < closest) {
                    closest = dist;
                    snapPos = ptLatLng;
                }
            });

            return snapPos ? { pos: snapPos, snapped: true } : { pos: latLng, snapped: false };
        };

        // Real-time visual update during drag
        marker.on('drag', (e: any) => {
          const { pos, snapped } = snapToTarget(e.target.getLatLng());
          
          if (snapped) {
            e.target.setLatLng(pos);
            L.DomUtil.addClass(e.target.getElement(), 'snapped-marker');
          } else {
            L.DomUtil.removeClass(e.target.getElement(), 'snapped-marker');
          }

          const currentLatLngs = [...polygonPoints]; 
          currentLatLngs[index] = [pos.lat, pos.lng];
          polyLayer.setLatLngs(currentLatLngs);
        });

        // Commit change on drag end
        marker.on('dragend', (e: any) => {
           const { pos } = snapToTarget(e.target.getLatLng());
           if (onPointUpdate) {
             onPointUpdate(index, pos.lat, pos.lng);
           }
           L.DomUtil.removeClass(e.target.getElement(), 'snapped-marker');
        });

        // Handle vertex click for deletion
        marker.on('click', (e: any) => {
            L.DomEvent.stopPropagation(e);
            if (onVertexClick) {
                onVertexClick(index);
            }
        });

        marker.addTo(group);
      });

      group.addTo(mapRef.current);
      drawnLayerRef.current = group;
    }

  }, [polygonPoints, isDrawing, onPointUpdate, selectedVertexIndex, onVertexClick, savedPolygons]);
  
  // Handle Division Line Layer
  useEffect(() => {
    if (!mapRef.current) return;

    if (divisionLayerRef.current) {
      divisionLayerRef.current.remove();
      divisionLayerRef.current = null;
    }

    if (isDividing && divisionLinePoints.length > 0) {
      const group = L.featureGroup();
      
      const line = L.polyline(divisionLinePoints, {
        color: '#3b82f6', // Blue-500
        weight: 4,
        dashArray: '10, 10',
        opacity: 0.8
      });
      
      line.addTo(group);
      
      // Add points for the line
      divisionLinePoints.forEach((point) => {
        L.circleMarker(point, {
          radius: 4,
          fillColor: '#3b82f6',
          color: '#ffffff',
          weight: 2,
          opacity: 1,
          fillOpacity: 1
        }).addTo(group);
      });

      group.addTo(mapRef.current);
      divisionLayerRef.current = group;
    }
  }, [divisionLinePoints, isDividing]);

  // Handle Cursor Style based on mode
  useEffect(() => {
    if (!containerRef.current) return;
    containerRef.current.style.cursor = (isDrawing || isDividing) ? 'crosshair' : 'grab';
  }, [isDrawing, isDividing]);

  // Handle Map Visibility Toggle via Prop
  useEffect(() => {
    if (!mapRef.current || !tileLayerRef.current) return;
    if (showBaseMap) {
      tileLayerRef.current.addTo(mapRef.current);
    } else {
      tileLayerRef.current.remove();
    }
  }, [showBaseMap]);

  // Update Center/Zoom manually
  useEffect(() => {
    if (mapRef.current && shouldFitBounds) {
      mapRef.current.setView(center, zoom);
      setCurrentZoom(zoom);
    }
  }, [center, zoom, shouldFitBounds]);

  // Handle Lead Pin
  useEffect(() => {
    if (!mapRef.current) return;

    if (leadPinRef.current) {
      leadPinRef.current.remove();
      leadPinRef.current = null;
    }

    if (leadPin) {
      const icon = L.divIcon({
        className: 'lead-pin-marker',
        html: `<div class="w-6 h-6 bg-blue-600 rounded-full border-2 border-white shadow-lg flex items-center justify-center text-white">
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
               </div>`,
        iconSize: [24, 24],
        iconAnchor: [12, 24]
      });

      leadPinRef.current = L.marker(leadPin, { icon, zIndexOffset: 2000 }).addTo(mapRef.current);
    }
  }, [leadPin]);

  // Render Dots (CircleMarkers)
  useEffect(() => {
    if (!mapRef.current) return;

    const availableZipsSet = new Set(availableZips.map(z => z.zip));
    
    // Cleanup old markers
    Object.keys(markersRef.current).forEach(zip => {
      if (!availableZipsSet.has(zip)) {
        markersRef.current[zip].remove();
        delete markersRef.current[zip];
      }
    });

    const DOT_STYLES = {
      selected: {
        radius: 12,        
        fillColor: '#2563eb', // Blue-600
        color: '#ffffff',     
        weight: 4,            
        opacity: 1,
        fillOpacity: 1
      },
      unselected: {
        radius: 5,
        fillColor: '#64748b', // Slate-500
        color: '#ffffff',
        weight: 1,
        opacity: 0.8,
        fillOpacity: 0.6
      },
      hover: {
        radius: 12,          
        fillColor: '#3b82f6',
        fillOpacity: 0.9,
        weight: 2
      }
    };

    availableZips.forEach(zipData => {
      // Logic: Only show unselected dots if zoom >= 10. 
      // Always show selected dots.
      const isSelected = selectedZips.has(zipData.zip);
      const isVisible = isSelected || currentZoom >= 10;

      if (!isVisible) {
        if (markersRef.current[zipData.zip]) {
          markersRef.current[zipData.zip].remove();
          delete markersRef.current[zipData.zip];
        }
        return;
      }

      const style = isSelected ? DOT_STYLES.selected : DOT_STYLES.unselected;

      if (markersRef.current[zipData.zip]) {
        // Update existing marker style
        markersRef.current[zipData.zip].setStyle(style);
        markersRef.current[zipData.zip].setRadius(style.radius);
        
        if (isSelected) {
          markersRef.current[zipData.zip].bringToFront();
        }
      } else {
        // Create new marker
        const marker = L.circleMarker([zipData.lat, zipData.lng], {
          ...style,
          className: 'zip-dot',
          pane: 'zipDotPane'
        })
        .addTo(mapRef.current!)
        .on('click', (e: any) => {
          L.DomEvent.stopPropagation(e);
          if (isDrawingRef.current) return; 

          onZipClick(zipData.zip);
        })
        .on('mouseover', function (this: any) {
          if (isDrawingRef.current) return;

          const currentSelected = selectedZipsRef.current.has(zipData.zip);
          if (!currentSelected) {
            this.setStyle(DOT_STYLES.hover);
            this.setRadius(DOT_STYLES.hover.radius);
            this.bringToFront();
          }
          
          this.bindTooltip(`
            <div class="font-sans text-center">
              <div class="text-sm font-bold text-gray-900">${zipData.zip}</div>
              <div class="text-xs text-gray-600">${zipData.city}</div>
            </div>
          `, {
            direction: 'top',
            offset: [0, -10],
            permanent: false,
            className: 'map-tooltip',
            opacity: 1
          }).openTooltip();
        })
        .on('mouseout', function (this: any) {
          if (isDrawingRef.current) return;

          const currentSelected = selectedZipsRef.current.has(zipData.zip);
          const currentBaseStyle = currentSelected ? DOT_STYLES.selected : DOT_STYLES.unselected;
          
          this.setStyle(currentBaseStyle);
          this.setRadius(currentBaseStyle.radius);
          this.closeTooltip();
        });

        markersRef.current[zipData.zip] = marker;
      }
    });

    if (availableZips.length > 0 && shouldFitBounds && initialLoadRef.current) {
        const bounds = L.latLngBounds(availableZips.map(z => [z.lat, z.lng]));
        if (bounds.isValid()) {
             setTimeout(() => {
              if (mapRef.current && shouldFitBounds) {
                mapRef.current.fitBounds(bounds, { 
                  padding: [50, 50],
                  maxZoom: 12, 
                  animate: true
                });
                initialLoadRef.current = false;
              }
            }, 100);
        }
    } else if (availableZips.length > 0 && !shouldFitBounds) {
        initialLoadRef.current = false; 
    }

  }, [availableZips, selectedZips, onZipClick, currentZoom, shouldFitBounds]); 

  // Reset initial load ref if fitBounds is requested
  useEffect(() => {
    if (shouldFitBounds) {
        initialLoadRef.current = true;
    }
  }, [shouldFitBounds]);

  return (
    <>
      <style>{`
        .map-tooltip {
          background: rgba(255, 255, 255, 0.95) !important;
          border: 1px solid #cbd5e1 !important;
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1) !important;
          border-radius: 6px !important;
          padding: 4px 8px !important;
        }
        .map-tooltip .leaflet-tooltip-tip {
          background: rgba(255, 255, 255, 0.95);
          border: 1px solid #cbd5e1;
        }
        .polygon-label {
          background: transparent;
          border: none;
          box-shadow: none;
          color: #334155;
          font-weight: 800;
          font-size: 11px;
          text-shadow: 0 0 4px white, 0 0 2px white;
        }
        .polygon-label .leaflet-tooltip-tip {
           display: none;
        }
        path.zip-dot {
          transition: fill 0.2s ease, r 0.2s ease, stroke-width 0.2s ease;
          cursor: pointer;
        }
        .leaflet-container {
          background: #e2e8f0;
        }
        .vertex-marker {
          background-color: #ef4444;
          border: 2px solid white;
          border-radius: 50%;
          box-shadow: 0 1px 3px rgba(0,0,0,0.3);
          cursor: grab;
          transition: transform 0.1s ease;
        }
        .vertex-marker.selected {
          background-color: #fbbf24; /* Amber-400 */
          border-color: #451a03;
          transform: scale(1.2);
          z-index: 1000 !important;
        }
        .vertex-marker.snapped-marker {
          background-color: #22c55e !important; /* Green-500 */
          transform: scale(1.3);
          box-shadow: 0 0 0 4px rgba(34, 197, 94, 0.4);
        }
        .vertex-marker:active {
          cursor: grabbing;
        }
      `}</style>
      
      <div ref={containerRef} className="w-full h-full relative z-0" />
      
      {/* Internal Layer Controls Removed - moved to App.tsx */}
      {/* Zoom Hint only */}
      {!isDrawing && currentZoom < 10 && (
         <div className="absolute top-20 right-4 z-[400] bg-white/90 backdrop-blur rounded-lg shadow-lg border border-gray-200 p-2">
            <div className="px-2 py-1 text-[10px] text-gray-500 text-center italic flex items-center justify-center space-x-1">
                <GripHorizontal size={12} />
                <span>Zoom in to see zip dots</span>
            </div>
         </div>
      )}
    </>
  );
};

export default MapView;
