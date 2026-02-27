
import React, { useState, useMemo } from 'react';
import { X, Download, Copy, Check, SortAsc, SortDesc, FileText } from 'lucide-react';
import { SortOrder } from '../types';

interface ExportModalProps {
  selectedZips: string[];
  onClose: () => void;
}

const ExportModal: React.FC<ExportModalProps> = ({ selectedZips, onClose }) => {
  const [sortOrder, setSortOrder] = useState<SortOrder>(SortOrder.ASC);
  const [copied, setCopied] = useState(false);

  const formattedList = useMemo(() => {
    const sorted = [...selectedZips].sort((a, b) => {
      return sortOrder === SortOrder.ASC 
        ? a.localeCompare(b) 
        : b.localeCompare(a);
    });
    return sorted.join(', ');
  }, [selectedZips, sortOrder]);

  const handleCopy = () => {
    navigator.clipboard.writeText(formattedList);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const element = document.createElement("a");
    const file = new Blob([formattedList], {type: 'text/plain'});
    element.href = URL.createObjectURL(file);
    element.download = `service_area_${new Date().getTime()}.csv`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm" onClick={onClose}></div>
      
      {/* Modal Card */}
      <div className="relative w-full max-w-xl bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col animate-in fade-in zoom-in duration-200">
        <div className="p-6 border-b flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="bg-green-100 p-2 rounded-lg text-green-600">
              <Download size={24} />
            </div>
            <div>
              <h2 className="text-xl font-bold">Export Service Area</h2>
              <p className="text-sm text-gray-500">{selectedZips.length} total zip codes</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-400">
            <X size={24} />
          </button>
        </div>

        <div className="p-6 space-y-6 flex-1 overflow-y-auto max-h-[70vh]">
          {/* Options */}
          <div className="grid grid-cols-2 gap-4">
            <button 
              onClick={() => setSortOrder(SortOrder.ASC)}
              className={`flex flex-col items-center justify-center p-4 rounded-2xl border-2 transition-all ${sortOrder === SortOrder.ASC ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-gray-100 hover:border-gray-200'}`}
            >
              <SortAsc size={24} className="mb-2" />
              <span className="text-sm font-bold">Ascending</span>
            </button>
            <button 
              onClick={() => setSortOrder(SortOrder.DESC)}
              className={`flex flex-col items-center justify-center p-4 rounded-2xl border-2 transition-all ${sortOrder === SortOrder.DESC ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-gray-100 hover:border-gray-200'}`}
            >
              <SortDesc size={24} className="mb-2" />
              <span className="text-sm font-bold">Descending</span>
            </button>
          </div>

          {/* Preview Area */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-gray-500 uppercase flex items-center">
              <FileText size={12} className="mr-1" /> Data Preview
            </label>
            <div className="relative">
              <textarea
                readOnly
                className="w-full h-40 p-4 bg-gray-50 border border-gray-200 rounded-2xl text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                value={formattedList}
              />
              <button 
                onClick={handleCopy}
                className="absolute top-3 right-3 p-2 bg-white border border-gray-200 rounded-xl shadow-sm hover:shadow-md transition-all flex items-center space-x-1.5 active:scale-95"
              >
                {copied ? (
                  <>
                    <Check size={14} className="text-green-500" />
                    <span className="text-xs font-bold text-green-500">Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy size={14} className="text-gray-600" />
                    <span className="text-xs font-bold text-gray-600">Copy</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        <div className="p-6 bg-gray-50 border-t flex flex-col sm:flex-row gap-3">
          <button 
            onClick={onClose}
            className="flex-1 px-6 py-3.5 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 font-bold rounded-xl transition-all active:scale-95"
          >
            Cancel
          </button>
          <button 
            onClick={handleDownload}
            className="flex-[2] px-6 py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-lg flex items-center justify-center space-x-2 transition-all active:scale-95"
          >
            <Download size={20} />
            <span>Download CSV (.csv)</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default ExportModal;
