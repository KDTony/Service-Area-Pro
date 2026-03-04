import React, { useState, useEffect } from 'react';
import { X, Plus, Trash2, Save, Edit2, User, Briefcase, FileText, Star } from 'lucide-react';
import { SavedPolygon, Trade, SalesRep, Brand, Office } from '../types';

interface PolygonInfoPanelProps {
  polygon: SavedPolygon;
  onClose: () => void;
  onSave: (id: string, updates: Partial<SavedPolygon>) => void;
  brands: Brand[];
  offices: Office[];
}

const PolygonInfoPanel: React.FC<PolygonInfoPanelProps> = ({ polygon, onClose, onSave, brands, offices }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [trades, setTrades] = useState<Trade[]>(polygon.trades || []);
  const [notes, setNotes] = useState(polygon.notes || '');
  const [selectedBrandId, setSelectedBrandId] = useState<string | null>(polygon.brandId);
  const [selectedOfficeId, setSelectedOfficeId] = useState<string | null>(polygon.officeId);

  // Update internal state when the polygon prop changes
  useEffect(() => {
    setTrades(polygon.trades || []);
    setNotes(polygon.notes || '');
    setIsEditing(false);
  }, [polygon.id, polygon.trades, polygon.notes]);
  useEffect(() => {
    setSelectedBrandId(polygon.brandId);
    setSelectedOfficeId(polygon.officeId);
  }, [polygon.brandId, polygon.officeId]);
  const handleAddTrade = () => {
    const newTrade: Trade = {
      id: Date.now().toString(),
      name: '',
      reps: []
    };
    setTrades([...trades, newTrade]);
  };

  const handleRemoveTrade = (tradeId: string) => {
    setTrades(trades.filter(t => t.id !== tradeId));
  };

  const handleUpdateTradeName = (tradeId: string, name: string) => {
    setTrades(trades.map(t => t.id === tradeId ? { ...t, name } : t));
  };

  const handleAddRep = (tradeId: string) => {
    const newRep: SalesRep = {
      id: Date.now().toString(),
      name: '',
      priority: 3
    };
    setTrades(trades.map(t => t.id === tradeId ? { ...t, reps: [...t.reps, newRep] } : t));
  };

  const handleRemoveRep = (tradeId: string, repId: string) => {
    setTrades(trades.map(t => t.id === tradeId ? { ...t, reps: t.reps.filter(r => r.id !== repId) } : t));
  };

  const handleUpdateRep = (tradeId: string, repId: string, updates: Partial<SalesRep>) => {
    setTrades(trades.map(t => t.id === tradeId ? {
      ...t,
      reps: t.reps.map(r => r.id === repId ? { ...r, ...updates } : r)
    } : t));
  };

  const handleSave = () => {
    onSave(polygon.id, { trades, notes, brandId: selectedBrandId, officeId: selectedOfficeId });
    setIsEditing(false);
  };

  return (
    <div className="absolute top-4 left-4 z-[500] w-80 bg-white rounded-2xl shadow-2xl border border-gray-200 flex flex-col max-h-[calc(100vh-2rem)] animate-in slide-in-from-left-4 fade-in duration-300">
      {/* Header */}
      <div className="p-4 border-b flex items-center justify-between bg-gray-50 rounded-t-2xl">
        <div className="flex items-center space-x-3">
          <div className="w-4 h-4 rounded-full" style={{ backgroundColor: polygon.color }}></div>
          <h3 className="font-bold text-gray-900 truncate max-w-[160px]">{polygon.name}</h3>
        </div>
        <button onClick={onClose} className="p-1 hover:bg-gray-200 rounded-full text-gray-400 transition-colors">
          <X size={20} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6 custom-scrollbar">
        {/* Stats */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-blue-50 p-3 rounded-xl border border-blue-100">
            <span className="text-[10px] font-bold text-blue-400 uppercase tracking-wider block mb-1">Zip Codes</span>
            <span className="text-xl font-bold text-blue-700">{polygon.zips.length}</span>
          </div>
          <div className="bg-indigo-50 p-3 rounded-xl border border-indigo-100">
            <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider block mb-1">Trades</span>
            <span className="text-xl font-bold text-indigo-700">{trades.length}</span>
          </div>
        </div>

        {/* Assignment Section */}
        {isEditing && (
          <div className="space-y-4">
            <div>
              <label className="text-xs font-bold text-gray-400 uppercase">Assign to Brand</label>
              <select
                value={selectedBrandId || ''}
                onChange={(e) => {
                  setSelectedBrandId(e.target.value || null);
                  setSelectedOfficeId(null); // Reset office when brand changes
                }}
                className="w-full mt-1 p-2 border rounded-lg text-sm"
              >
                <option value="">Unassigned</option>
                {brands.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-bold text-gray-400 uppercase">Assign to Office</label>
              <select
                value={selectedOfficeId || ''}
                onChange={(e) => setSelectedOfficeId(e.target.value || null)}
                disabled={!selectedBrandId}
                className="w-full mt-1 p-2 border rounded-lg text-sm disabled:bg-gray-100"
              >
                <option value="">Unassigned</option>
                {offices
                  .filter(o => o.brandId === selectedBrandId)
                  .map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
              </select>
            </div>
          </div>
        )}

        {/* Trades Section */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center">
              <Briefcase size={12} className="mr-1" /> Trades & Reps
            </h4>
            {isEditing && (
              <button onClick={handleAddTrade} className="text-[10px] font-bold text-blue-600 hover:text-blue-700 flex items-center bg-blue-50 px-2 py-1 rounded-lg transition-colors">
                <Plus size={12} className="mr-1" /> Add Trade
              </button>
            )}
          </div>

          {trades.length === 0 && !isEditing ? (
            <p className="text-xs text-gray-400 italic text-center py-4 bg-gray-50 rounded-xl">No trades assigned yet.</p>
          ) : (
            <div className="space-y-4">
              {trades.map((trade) => (
                <div key={trade.id} className="bg-gray-50 rounded-xl p-3 border border-gray-100 space-y-3">
                  <div className="flex items-center justify-between">
                    {isEditing ? (
                      <input
                        type="text"
                        value={trade.name}
                        onChange={(e) => handleUpdateTradeName(trade.id, e.target.value)}
                        placeholder="Trade Name (e.g. Roofing)"
                        className="bg-white border rounded-lg px-2 py-1 text-sm font-bold w-full mr-2 focus:ring-2 focus:ring-blue-500 outline-none"
                      />
                    ) : (
                      <span className="font-bold text-sm text-gray-800">{trade.name || 'Unnamed Trade'}</span>
                    )}
                    {isEditing && (
                      <button onClick={() => handleRemoveTrade(trade.id)} className="text-red-400 hover:text-red-600 p-1">
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>

                  {/* Reps */}
                  <div className="space-y-2">
                    {trade.reps.map((rep) => {
                      const priorityOptions = [1, 2, 3, 4, 5, 0]; // 0 represents "Alt"
                      return (
                        <div key={rep.id} className="bg-white rounded-lg p-2 border border-gray-100 flex flex-col space-y-2">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center flex-1 min-w-0">
                              <User size={12} className="text-gray-400 mr-2 shrink-0" />
                              {isEditing ? (
                                <input
                                  type="text"
                                  value={rep.name}
                                  onChange={(e) => handleUpdateRep(trade.id, rep.id, { name: e.target.value })}
                                  placeholder="Rep Name"
                                  className="text-xs border-b border-gray-100 focus:border-blue-500 outline-none w-full"
                                />
                              ) : (
                                <span className="text-xs font-medium text-gray-700 truncate">{rep.name || 'Unnamed Rep'}</span>
                              )}
                            </div>
                            {isEditing ? (
                              <button onClick={() => handleRemoveRep(trade.id, rep.id)} className="text-gray-300 hover:text-red-500 ml-2">
                                <X size={12} />
                              </button>
                            ) : (
                              <div className="text-xs font-bold text-gray-500 ml-2">
                                {rep.priority > 0 ? `x${rep.priority}` : 'Alt'}
                              </div>
                            )}
                          </div>
                          {isEditing && (
                            <div className="flex items-center justify-between pt-1 border-t border-gray-100">
                              <div className="flex items-center space-x-1">
                                {priorityOptions.map((p) => (
                                  <button
                                    key={p}
                                    onClick={() => handleUpdateRep(trade.id, rep.id, { priority: p })}
                                    className={`
                                      w-6 h-6 rounded-md text-[10px] font-bold transition-colors
                                      ${rep.priority === p ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-600 hover:bg-gray-300'}
                                    `}
                                  >
                                    {p === 0 ? 'Alt' : p}
                                  </button>
                                ))}
                              </div>
                              <span className="text-[10px] font-bold text-gray-400">Priority</span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                    {isEditing && (
                      <button onClick={() => handleAddRep(trade.id)} className="w-full py-1.5 border-2 border-dashed border-gray-200 rounded-lg text-[10px] font-bold text-gray-400 hover:border-blue-300 hover:text-blue-500 transition-all">
                        + Add Sales Rep
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Notes Section */}
        <div className="space-y-2">
          <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center">
            <FileText size={12} className="mr-1" /> Service Area Notes
          </h4>
          {isEditing ? (
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Enter area notes..."
              className="w-full h-24 p-3 text-xs border rounded-xl focus:ring-2 focus:ring-blue-500 outline-none resize-none bg-gray-50"
            />
          ) : (
            <div className="p-3 bg-gray-50 rounded-xl border border-gray-100 min-h-[60px]">
              <p className="text-xs text-gray-600 leading-relaxed whitespace-pre-wrap">
                {notes || 'No notes added yet.'}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="p-4 border-t bg-gray-50 rounded-b-2xl flex space-x-3">
        {isEditing ? (
          <>
            <button
              onClick={() => {
                setIsEditing(false);
                setTrades(polygon.trades || []);
                setNotes(polygon.notes || '');
              }}
              className="flex-1 py-2 text-sm font-bold text-gray-500 hover:bg-gray-200 rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="flex-1 py-2 text-sm font-bold bg-blue-600 text-white hover:bg-blue-700 rounded-xl shadow-lg transition-all flex items-center justify-center space-x-2"
            >
              <Save size={16} />
              <span>Save Changes</span>
            </button>
          </>
        ) : (
          <button
            onClick={() => setIsEditing(true)}
            className="w-full py-2 text-sm font-bold bg-gray-900 text-white hover:bg-black rounded-xl shadow-lg transition-all flex items-center justify-center space-x-2"
          >
            <Edit2 size={16} />
            <span>Edit Details</span>
          </button>
        )}
      </div>
    </div>
  );
};

export default PolygonInfoPanel;
