import React, { useMemo } from 'react';
import { SavedPolygon } from '../types';

interface PolygonPreviewProps {
  polygons: SavedPolygon[];
  highlightId: string;
  height?: number;
}

const PolygonPreview: React.FC<PolygonPreviewProps> = ({ polygons, highlightId, height = 160 }) => {
  const { paths, viewBox } = useMemo(() => {
    if (polygons.length === 0) return { paths: [], viewBox: '0 0 100 100' };

    // 1. Calculate Bounding Box for all polygons
    const allPoints = polygons.flatMap(p => p.points);
    if (allPoints.length === 0) return { paths: [], viewBox: '0 0 100 100' };

    const lats = allPoints.map(p => p[0]);
    const lngs = allPoints.map(p => p[1]);
    
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);

    // Add some padding (10%)
    const latSpan = maxLat - minLat;
    const lngSpan = maxLng - minLng;
    const paddingLat = latSpan * 0.1;
    const paddingLng = lngSpan * 0.1;

    const boundMinLat = minLat - paddingLat;
    const boundMaxLat = maxLat + paddingLat;
    const boundMinLng = minLng - paddingLng;
    const boundMaxLng = maxLng + paddingLng;

    const width = boundMaxLng - boundMinLng;
    const height = boundMaxLat - boundMinLat;

    // SVG Coordinate System:
    // x = lng - boundMinLng
    // y = boundMaxLat - lat (because SVG y goes down, Lat goes up)
    
    const paths = polygons.map(poly => {
      const d = poly.points.map((p, i) => {
        const x = p[1] - boundMinLng;
        const y = boundMaxLat - p[0];
        return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
      }).join(' ') + ' Z';
      
      return {
        id: poly.id,
        d,
        color: poly.color,
        isHighlight: poly.id === highlightId
      };
    });

    // ViewBox: minX minY width height
    return {
      paths,
      viewBox: `0 0 ${width} ${height}`
    };
  }, [polygons, highlightId]);

  if (polygons.length === 0) return null;

  return (
    <div className="w-full bg-gray-50 rounded-xl border border-gray-200 overflow-hidden flex items-center justify-center mb-4 relative" style={{ height }}>
      <div className="absolute inset-0 opacity-5 bg-[radial-gradient(#cbd5e1_1px,transparent_1px)] [background-size:8px_8px]"></div>
      <svg viewBox={viewBox} className="w-full h-full p-4 z-10" preserveAspectRatio="xMidYMid meet">
        {paths.map(p => (
          <path
            key={p.id}
            d={p.d}
            fill={p.isHighlight ? p.color : '#94a3b8'}
            fillOpacity={p.isHighlight ? 0.8 : 0.2}
            stroke={p.isHighlight ? '#1e293b' : '#64748b'}
            strokeWidth={p.isHighlight ? 2 : 1}
            vectorEffect="non-scaling-stroke"
            className="transition-all duration-300"
          />
        ))}
      </svg>
      {/* Label for Highlighted Area */}
      <div className="absolute bottom-2 right-2 bg-white/90 backdrop-blur px-2 py-1 rounded text-[10px] font-bold text-gray-500 shadow-sm border border-gray-100">
        Preview
      </div>
    </div>
  );
};

export default PolygonPreview;
