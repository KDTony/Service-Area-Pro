import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Search, Map as MapIcon, Download, Trash2, List, Info, Loader2, X, ChevronRight, MapPin, MousePointerClick, PenTool, Save, UploadCloud, DownloadCloud, Layers, Combine, Briefcase, Star, FileDown, FileUp, HardDrive } from 'lucide-react';
import * as turf from '@turf/turf';
import { ZipCodeData, SavedPolygon } from '../types';

interface SidebarProps {
  initialZip: string;
  setInitialZip: (val: string) => void;
  radius: number;
  setRadius: (val: number) => void;
  onSearch: (e: React.FormEvent<HTMLFormElement>) => Promise<void>;
  loading: boolean;
  selectedZipList: ZipCodeData[];
  onClear: () => void;
  onExport: () => void;
  toggleZipSelection: (zip: string) => void;
  onSaveLocal: () => void;
  onLoadLocal: () => void;
  onExportFile: () => void;
  onImportFile: () => void;
  savedPolygons: SavedPolygon[];
  leadPin: [number, number] | null;
}

const Sidebar: React.FC<SidebarProps> = ({
  initialZip, setInitialZip, radius, setRadius, onSearch, loading,
  selectedZipList, onClear, onExport, toggleZipSelection, onSaveLocal, onExportFile, onImportFile,
  onLoadLocal, savedPolygons, leadPin
}) => {

  const [isSaveMenuOpen, setIsSaveMenuOpen] = useState(false);
  const saveMenuRef = useRef<HTMLDivElement>(null);

  const extractedZip = useMemo(() => {
    if (!initialZip) return null;
    const match = initialZip.match(/\b\d{5}\b/);
    return match ? match[0] : null;
  }, [initialZip]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (saveMenuRef.current && !saveMenuRef.current.contains(event.target as Node)) {
        setIsSaveMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  return (
    <div className="flex flex-col h-full bg-white text-gray-800">
      {/* Brand Header */}
      <div className="p-6 border-b flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="bg-blue-600 p-2 rounded-lg text-white">
            <MapIcon size={24} />
          </div>
          <div>
            <h1 className="font-bold text-xl tracking-tight">Service Area Pro</h1>
            <p className="text-xs text-gray-500 font-medium">Map & Data Utility</p>
          </div>
        </div>
        <div className="relative" ref={saveMenuRef}>
          <button
            onClick={() => setIsSaveMenuOpen(!isSaveMenuOpen)}
            title="Save/Load Options"
            className={`p-2 rounded-full transition-colors ${isSaveMenuOpen ? 'bg-blue-100 text-blue-600' : 'text-gray-400 hover:text-blue-600 hover:bg-blue-50'}`}
          >
            <HardDrive size={20} />
          </button>

          {isSaveMenuOpen && (
            <div className="absolute top-full right-0 mt-2 w-56 bg-white rounded-lg shadow-xl border border-gray-100 py-1 z-10 animate-in fade-in zoom-in-95 duration-100 origin-top-right">
              <button onClick={() => { onSaveLocal(); setIsSaveMenuOpen(false); }} className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center">
                <UploadCloud size={14} className="mr-2" /> Save to Browser
              </button>
              <button onClick={() => { onLoadLocal(); setIsSaveMenuOpen(false); }} className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center">
                <DownloadCloud size={14} className="mr-2" /> Load from Browser
              </button>
              <div className="h-px bg-gray-100 my-1"></div>
              <button onClick={() => { onExportFile(); setIsSaveMenuOpen(false); }} className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center">
                <FileDown size={14} className="mr-2" /> Export to File
              </button>
              <button onClick={() => { onImportFile(); setIsSaveMenuOpen(false); }} className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center">
                <FileUp size={14} className="mr-2" /> Import from File
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar">
        {/* Search Section */}
        <div className="p-6 border-b bg-gray-50/50">
          <form onSubmit={onSearch} className="space-y-4">
            <div className="space-y-1">
              <label className="text-xs font-bold text-gray-500 uppercase flex items-center">
                <MapPin size={12} className="mr-1" /> Lead Search
              </label>
              <input
                type="text"
                placeholder="e.g. 90210"
                className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all shadow-sm"
                value={initialZip}
                onChange={(e) => setInitialZip(e.target.value)}
              />
            </div>
            
            <button
              type="submit"
              disabled={loading || !initialZip}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white font-bold py-3 rounded-xl transition-all shadow-lg flex items-center justify-center space-x-2 active:scale-95"
            >
              {loading ? <Loader2 className="animate-spin" size={20} /> : <Search size={20} />}
              <span>{loading ? 'Locate...' : 'Go to Location'}</span>
            </button>
          </form>

          {/* Matching Areas Info */}
          {extractedZip && (
            <div className="mt-4 space-y-3">
              {savedPolygons
                .filter(p => {                  // Match by zip code if initialZip looks like one
                  if (extractedZip && p.zips.includes(extractedZip)) {
                    return true;
                  }
                  // Match by leadPin containment
                  if (leadPin) {
                    const coords = p.points.map(pt => [pt[1], pt[0]]);
                    if (coords[0][0] !== coords[coords.length-1][0] || coords[0][1] !== coords[coords.length-1][1]) {
                      coords.push(coords[0]);
                    }
                    const poly = turf.polygon([coords]);
                    return turf.booleanPointInPolygon(turf.point([leadPin[1], leadPin[0]]), poly);
                  }
                  return false;
                })
                .map(poly => (
                  <div key={poly.id} className="bg-white border border-gray-200 rounded-xl p-3 shadow-sm animate-in fade-in slide-in-from-top-2">
                    <div className="flex items-center space-x-2 mb-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: poly.color }}></div>
                      <span className="text-xs font-bold text-gray-900">{poly.name}</span>
                    </div>
                    
                    {poly.trades && poly.trades.length > 0 ? (
                      <div className="space-y-3">
                        {poly.trades.map(trade => (
                          <div key={trade.id} className="space-y-1.5">
                            <div className="flex items-center text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                              <Briefcase size={10} className="mr-1" /> {trade.name}
                            </div>
                            <div className="space-y-1">
                              {[...trade.reps]
                                .sort((a, b) => b.priority - a.priority)
                                .map(rep => (
                                  <div key={rep.id} className="flex items-center justify-between bg-gray-50 px-2 py-1 rounded text-[11px]">
                                    <span className="text-gray-700 font-medium">{rep.name}</span>
                                   <div className="text-[10px] font-bold text-gray-500 ml-2">
                                     {rep.priority > 0 ? `x${rep.priority}` : 'Alt'}
                                   </div>
                                  </div>
                                ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-[10px] text-gray-400 italic">No trades assigned to this area.</p>
                    )}
                  </div>
                ))}
            </div>
          )}

          <div className="mt-4 flex flex-col space-y-3 p-3 bg-blue-50 rounded-lg text-blue-800 text-xs">
          </div>
        </div>

        {/* Selected List Section */}
        <div className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-gray-900 flex items-center">
              <List size={18} className="mr-2 text-blue-500" /> 
              Selected Zip Codes ({selectedZipList.length})
            </h3>
            {selectedZipList.length > 0 && (
              <button 
                onClick={onClear}
                className="text-xs font-bold text-red-500 hover:text-red-600 flex items-center"
              >
                <Trash2 size={14} className="mr-1" /> Clear
              </button>
            )}
          </div>

          {selectedZipList.length === 0 ? (
            <div className="py-12 px-4 text-center space-y-2 border-2 border-dashed border-gray-100 rounded-2xl">
              <div className="bg-gray-50 w-12 h-12 rounded-full flex items-center justify-center mx-auto text-gray-300">
                <MapPin size={24} />
              </div>
              <p className="text-sm text-gray-500">Pan the map and zoom in to find zip codes. Click dots to select.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {selectedZipList.map((zip) => (
                <div 
                  key={zip.zip} 
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-xl border border-transparent hover:border-gray-200 transition-all group"
                >
                  <div className="flex flex-col">
                    <span className="font-bold text-sm text-gray-900">{zip.zip}</span>
                    <span className="text-[11px] text-gray-500 truncate max-w-[120px]">{zip.city}, {zip.state}</span>
                  </div>
                  <button 
                    onClick={() => toggleZipSelection(zip.zip)}
                    className="p-1.5 bg-white border rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-all shadow-sm opacity-0 group-hover:opacity-100"
                  >
                    <X size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}

          
        </div>
      </div>

      {/* Footer Controls */}
      <div className="p-6 bg-white border-t space-y-3">
        <button
          onClick={onExport}
          disabled={selectedZipList.length === 0}
          className="w-full flex items-center justify-center space-x-2 bg-gray-900 hover:bg-black disabled:bg-gray-300 text-white font-bold py-3.5 rounded-xl transition-all shadow-lg active:scale-95"
        >
          <Download size={20} />
          <span>Export Service Area</span>
        </button>
      </div>
    </div>
  );
};

export default Sidebar;
