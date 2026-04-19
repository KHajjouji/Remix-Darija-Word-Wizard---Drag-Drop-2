import React, { useState, useRef } from 'react';
import { ExerciseConfig, DropZone, DraggableItem } from '../types';
import { Plus, Trash2, Code, X, Move, Sparkles, Image as ImageIcon, HelpCircle } from 'lucide-react';
import { generateSceneFromText } from '../services/aiSceneGenerator';
import { generateImage } from '../services/aiImageGenerator';

interface Props {
  config: ExerciseConfig;
  onChange: (config: ExerciseConfig) => void;
}

export const ExerciseBuilder: React.FC<Props> = ({ config, onChange }) => {
  const canvasRef = useRef<HTMLDivElement>(null);
  const [showJson, setShowJson] = useState(false);
  const [activeTab, setActiveTab] = useState<'general' | 'zones' | 'items' | 'ai'>('ai');
  const [aiPrompt, setAiPrompt] = useState('Living room scene:\n\nThe carpet is next to the window.\nThe blanket is on the floor.\nThe sofa is in front of the television.\nThe table is behind the sofa.\nThe bookshelf is to the right of the television.\nThe Online Darija books are on top of the table.');
  const [isGenerating, setIsGenerating] = useState(false);
  const [genTime, setGenTime] = useState(0);
  const [drawMode, setDrawMode] = useState(false);

  // Timer effect for generation
  React.useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isGenerating) {
      setGenTime(0);
      interval = setInterval(() => {
        setGenTime(prev => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isGenerating]);

  const handleCanvasPointerDown = (e: React.PointerEvent) => {
    if (!drawMode || !canvasRef.current) return;
    
    const rect = canvasRef.current.getBoundingClientRect();
    const startX = ((e.clientX - rect.left) / rect.width) * 100;
    const startY = ((e.clientY - rect.top) / rect.height) * 100;

    const newZone: DropZone = {
      id: `zone-${Date.now()}`,
      x: startX,
      y: startY,
      width: 0,
      height: 0,
      quadPoints: [0, 0, 100, 0, 100, 100, 0, 100],
      acceptedItemIds: []
    };

    const updatedZones = [...config.dropZones, newZone];
    onChange({ ...config, dropZones: updatedZones });

    const onPointerMove = (moveEvent: PointerEvent) => {
      const currentX = ((moveEvent.clientX - rect.left) / rect.width) * 100;
      const currentY = ((moveEvent.clientY - rect.top) / rect.height) * 100;

      const finalX = Math.min(startX, currentX);
      const finalY = Math.min(startY, currentY);
      const finalW = Math.abs(currentX - startX);
      const finalH = Math.abs(currentY - startY);

      onChange({
        ...config,
        dropZones: updatedZones.map(z => 
          z.id === newZone.id ? { ...z, x: finalX, y: finalY, width: finalW, height: finalH } : z
        )
      });
    };

    const onPointerUp = () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      setDrawMode(false);
    };

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>, id: string, type: 'zone' | 'item') => {
    e.preventDefault();
    e.stopPropagation();
    const target = e.currentTarget;
    target.setPointerCapture(e.pointerId);

    const startX = e.clientX;
    const startY = e.clientY;

    let initialX = 0;
    let initialY = 0;
    if (type === 'zone') {
      const z = config.dropZones.find(z => z.id === id);
      if (z) { initialX = z.x; initialY = z.y; }
    } else {
      const i = config.items.find(i => i.id === id);
      if (i) { initialX = i.startX; initialY = i.startY; }
    }

    const onPointerMove = (moveEvent: PointerEvent) => {
      if (!canvasRef.current) return;
      const rect = canvasRef.current.getBoundingClientRect();
      const deltaX = ((moveEvent.clientX - startX) / rect.width) * 100;
      const deltaY = ((moveEvent.clientY - startY) / rect.height) * 100;

      if (type === 'zone') {
        onChange({
          ...config,
          dropZones: config.dropZones.map(z => 
            z.id === id 
              ? { ...z, x: Math.max(0, Math.min(100 - z.width, initialX + deltaX)), y: Math.max(0, Math.min(100 - z.height, initialY + deltaY)) } 
              : z
          )
        });
      } else {
        onChange({
          ...config,
          items: config.items.map(i => 
            i.id === id 
              ? { ...i, startX: Math.max(0, Math.min(100 - i.width, initialX + deltaX)), startY: Math.max(0, Math.min(100, initialY + deltaY)) } 
              : i
          )
        });
      }
    };

    const onPointerUp = (upEvent: PointerEvent) => {
      target.releasePointerCapture(upEvent.pointerId);
      target.removeEventListener('pointermove', onPointerMove);
      target.removeEventListener('pointerup', onPointerUp);
    };

    target.addEventListener('pointermove', onPointerMove);
    target.addEventListener('pointerup', onPointerUp);
  };

  const handleResizePointerDown = (e: React.PointerEvent<HTMLDivElement>, id: string, corner: 'tl' | 'tr' | 'bl' | 'br') => {
    e.preventDefault();
    e.stopPropagation();
    const target = e.currentTarget;
    target.setPointerCapture(e.pointerId);

    const startX = e.clientX;
    const startY = e.clientY;
    
    const zone = config.dropZones.find(z => z.id === id);
    if (!zone) return;

    const initialX = zone.x;
    const initialY = zone.y;
    const initialW = zone.width;
    const initialH = zone.height;

    const onPointerMove = (moveEvent: PointerEvent) => {
      if (!canvasRef.current) return;
      const rect = canvasRef.current.getBoundingClientRect();
      const deltaX = ((moveEvent.clientX - startX) / rect.width) * 100;
      const deltaY = ((moveEvent.clientY - startY) / rect.height) * 100;

      let newX = initialX;
      let newY = initialY;
      let newW = initialW;
      let newH = initialH;

      if (corner === 'br') {
        newW = Math.max(2, initialW + deltaX);
        newH = Math.max(2, initialH + deltaY);
      } else if (corner === 'tl') {
        newX = Math.min(initialX + initialW - 2, initialX + deltaX);
        newY = Math.min(initialY + initialH - 2, initialY + deltaY);
        newW = initialW - (newX - initialX);
        newH = initialH - (newY - initialY);
      } else if (corner === 'tr') {
        newY = Math.min(initialY + initialH - 2, initialY + deltaY);
        newW = Math.max(2, initialW + deltaX);
        newH = initialH - (newY - initialY);
      } else if (corner === 'bl') {
        newX = Math.min(initialX + initialW - 2, initialX + deltaX);
        newW = initialW - (newX - initialX);
        newH = Math.max(2, initialH + deltaY);
      }

      onChange({
        ...config,
        dropZones: config.dropZones.map(z => 
          z.id === id 
            ? { ...z, x: newX, y: newY, width: newW, height: newH } 
            : z
        )
      });
    };

    const onPointerUp = (upEvent: PointerEvent) => {
      target.releasePointerCapture(upEvent.pointerId);
      target.removeEventListener('pointermove', onPointerMove);
      target.removeEventListener('pointerup', onPointerUp);
    };

    target.addEventListener('pointermove', onPointerMove);
    target.addEventListener('pointerup', onPointerUp);
  };

  const handleQuadPointerDown = (e: React.PointerEvent<HTMLDivElement>, zoneId: string, pointIndex: number) => {
    e.preventDefault();
    e.stopPropagation();
    const target = e.currentTarget;
    target.setPointerCapture(e.pointerId);

    const startX = e.clientX;
    const startY = e.clientY;

    const zone = config.dropZones.find(z => z.id === zoneId);
    if (!zone) return;

    // Default quad points: TL(0,0), TR(100,0), BR(100,100), BL(0,100)
    const initialQuads: [number, number, number, number, number, number, number, number] = zone.quadPoints || [0, 0, 100, 0, 100, 100, 0, 100];
    const initialValX = initialQuads[pointIndex * 2];
    const initialValY = initialQuads[pointIndex * 2 + 1];

    const onPointerMove = (moveEvent: PointerEvent) => {
      if (!canvasRef.current) return;
      const rect = canvasRef.current.getBoundingClientRect();
      
      // Calculate delta relative to the ZONE's width/height
      const zoneW = (zone.width / 100) * rect.width;
      const zoneH = (zone.height / 100) * rect.height;
      
      const deltaX = ((moveEvent.clientX - startX) / zoneW) * 100;
      const deltaY = ((moveEvent.clientY - startY) / zoneH) * 100;

      const newQuads = [...initialQuads] as [number, number, number, number, number, number, number, number];
      newQuads[pointIndex * 2] = initialValX + deltaX;
      newQuads[pointIndex * 2 + 1] = initialValY + deltaY;

      onChange({
        ...config,
        dropZones: config.dropZones.map(z => 
          z.id === zoneId ? { ...z, quadPoints: newQuads } : z
        )
      });
    };

    const onPointerUp = (upEvent: PointerEvent) => {
      target.releasePointerCapture(upEvent.pointerId);
      target.removeEventListener('pointermove', onPointerMove);
      target.removeEventListener('pointerup', onPointerUp);
    };

    target.addEventListener('pointermove', onPointerMove);
    target.addEventListener('pointerup', onPointerUp);
  };

  const addDropZone = () => {
    const newZone: DropZone = {
      id: `zone-${Date.now()}`,
      x: 10, y: 10, width: 20, height: 20,
      quadPoints: [0, 0, 100, 0, 100, 100, 0, 100],
      zIndex: (config.dropZones.length + 1) * 10,
      acceptedItemIds: []
    };
    onChange({ ...config, dropZones: [...config.dropZones, newZone] });
  };

  const addItem = () => {
    const newItem: DraggableItem = {
      id: `item-${Date.now()}`,
      label: 'New Item',
      imageUrl: 'https://cdn-icons-png.flaticon.com/512/1864/1864514.png',
      startX: 10, startY: 10, width: 10,
      zIndex: (config.items.length + 1) * 20,
    };
    onChange({ ...config, items: [...config.items, newItem] });
  };

  return (
    <div className="flex flex-col lg:flex-row gap-6 h-[calc(100vh-120px)]">
      {/* Visual Canvas Area */}
      <div className="flex-1 flex flex-col gap-4">
        <div className="flex justify-between items-center bg-white p-4 rounded-xl shadow-sm border border-gray-200">
          <h2 className="text-lg font-bold text-gray-800">Visual Editor</h2>
          <div className="flex gap-2">
            <button 
              onClick={() => setDrawMode(!drawMode)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm transition-colors ${drawMode ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
              title="Click and drag on background to create a new zone"
            >
              <Plus size={16} /> {drawMode ? 'Drawing...' : 'Draw Zone'}
            </button>
            <button 
              onClick={() => setShowJson(true)}
              className="flex items-center gap-2 px-3 py-1.5 bg-gray-800 text-white rounded-md hover:bg-gray-700 text-sm"
            >
              <Code size={16} /> Export JSON
            </button>
          </div>
        </div>

        <div 
          ref={canvasRef}
          onPointerDown={handleCanvasPointerDown}
          className={`relative w-full aspect-[4/3] md:aspect-video bg-gray-100 rounded-xl overflow-hidden shadow-inner border-2 transition-colors ${drawMode ? 'border-blue-500 cursor-crosshair' : 'border-gray-300'}`}
        >
          {config.backgroundImageUrl ? (
            <img src={config.backgroundImageUrl} alt="Background" className="absolute inset-0 w-full h-full object-cover opacity-50" />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center text-gray-400">No Background Image</div>
          )}

          {/* Render Drop Zones */}
          {(config.dropZones || []).map(zone => (
            <div
              key={zone.id}
              onPointerDown={(e) => handlePointerDown(e, zone.id, 'zone')}
              className="absolute border-2 border-dashed border-blue-500 bg-blue-500/20 cursor-move group flex items-center justify-center transform-gpu"
              style={{ 
                left: `${zone.x}%`, 
                top: `${zone.y}%`, 
                width: `${zone.width}%`, 
                height: `${zone.height}%`,
                transform: `perspective(1000px) rotateX(${zone.rotateX || 0}deg) rotateY(${zone.rotateY || 0}deg) rotateZ(${zone.rotateZ || 0}deg)`,
                transformOrigin: 'center center'
              }}
            >
              <div className="absolute -top-6 left-0 bg-blue-500 text-white text-xs px-2 py-0.5 rounded shadow-sm whitespace-nowrap" style={{ transform: `rotateX(${-(zone.rotateX || 0)}deg) rotateY(${-(zone.rotateY || 0)}deg) rotateZ(${-(zone.rotateZ || 0)}deg)` }}>
                Zone: {zone.id}
              </div>
              <Move size={16} className="text-blue-600 opacity-20 group-hover:opacity-100 transition-opacity" />
              
              {/* Resize Handles */}
              <div 
                onPointerDown={(e) => handleResizePointerDown(e, zone.id, 'tl')}
                className="absolute -top-1.5 -left-1.5 w-3 h-3 bg-white border-2 border-blue-600 rounded-full cursor-nwse-resize z-10" 
              />
              <div 
                onPointerDown={(e) => handleResizePointerDown(e, zone.id, 'tr')}
                className="absolute -top-1.5 -right-1.5 w-3 h-3 bg-white border-2 border-blue-600 rounded-full cursor-nesw-resize z-10" 
              />
              <div 
                onPointerDown={(e) => handleResizePointerDown(e, zone.id, 'bl')}
                className="absolute -bottom-1.5 -left-1.5 w-3 h-3 bg-white border-2 border-blue-600 rounded-full cursor-nesw-resize z-10" 
              />
              <div 
                onPointerDown={(e) => handleResizePointerDown(e, zone.id, 'br')}
                className="absolute -bottom-1.5 -right-1.5 w-3 h-3 bg-white border-2 border-blue-600 rounded-full cursor-nwse-resize z-10" 
              />

              {/* Perspective Pins (Quadrilateral Distortion) */}
              {[0, 1, 2, 3].map(i => {
                const quads = zone.quadPoints || [0, 0, 100, 0, 100, 100, 0, 100];
                return (
                  <div 
                    key={i}
                    onPointerDown={(e) => handleQuadPointerDown(e, zone.id, i)}
                    className="absolute w-2.5 h-2.5 bg-yellow-400 border border-white rotate-45 cursor-crosshair z-20 shadow-sm"
                    style={{ left: `${quads[i*2]}%`, top: `${quads[i*2+1]}%`, transform: 'translate(-50%, -50%) rotate(45deg)' }}
                  />
                );
              })}
              
              {/* Polygon connection visual */}
              {zone.quadPoints && (
                <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 w-full h-full pointer-events-none overflow-visible">
                  <polygon 
                    points={`${zone.quadPoints[0]},${zone.quadPoints[1]} ${zone.quadPoints[2]},${zone.quadPoints[3]} ${zone.quadPoints[4]},${zone.quadPoints[5]} ${zone.quadPoints[6]},${zone.quadPoints[7]}`}
                    className="fill-blue-500/10 stroke-blue-500 stroke-1"
                    style={{ vectorEffect: 'non-scaling-stroke' }}
                  />
                </svg>
              )}
            </div>
          ))}

          {/* Render Items */}
          {(config.items || []).map(item => (
            <div
              key={item.id}
              onPointerDown={(e) => handlePointerDown(e, item.id, 'item')}
              className="absolute border-2 border-green-500 bg-green-500/20 cursor-move group flex items-center justify-center"
              style={{ left: `${item.startX}%`, top: `${item.startY}%`, width: `${item.width}%` }}
            >
              <div className="absolute -top-6 left-0 bg-green-500 text-white text-xs px-2 py-0.5 rounded shadow-sm whitespace-nowrap z-10">
                Item: {item.id}
              </div>
              <img src={item.imageUrl} alt="item" className="w-full h-auto object-contain pointer-events-none" />
            </div>
          ))}
        </div>
        <p className="text-sm text-gray-500 text-center">Drag elements on the canvas to position them. Resize them using the sidebar controls.</p>
      </div>

      {/* Properties Sidebar */}
      <div className="w-full lg:w-96 bg-white rounded-xl shadow-sm border border-gray-200 flex flex-col overflow-hidden">
        <div className="flex border-b border-gray-200">
          {(['general', 'zones', 'items', 'ai'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 py-3 text-sm font-medium capitalize ${activeTab === tab ? 'bg-blue-50 text-blue-600 border-b-2 border-blue-600' : 'text-gray-600 hover:bg-gray-50'}`}
            >
              {tab === 'ai' ? <span className="flex items-center justify-center gap-1"><Sparkles size={14}/> AI</span> : tab}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {activeTab === 'ai' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Generate Scene Config</label>
                <p className="text-xs text-gray-500 mb-2">Describe the full scene. AI will convert this into coordinated drop zones and exact object generation prompts.</p>
                <textarea
                  value={aiPrompt}
                  onChange={(e) => setAiPrompt(e.target.value)}
                  className="w-full h-48 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  placeholder="Describe the scene spatial relations..."
                />
              </div>
              <button
                disabled={isGenerating || !aiPrompt.trim()}
                onClick={async () => {
                  try {
                    setIsGenerating(true);
                    const generated = await generateSceneFromText(aiPrompt);
                    
                    // Convert the draft items/zones to internal models
                    const newConfig: ExerciseConfig = {
                      ...config,
                      backgroundPrompt: generated.backgroundPrompt, // Keep for future generation
                      dropZones: generated.dropZones.map((z, zIdx) => ({
                        id: z.id,
                        label: z.label,
                        x: z.xPct,
                        y: z.yPct,
                        width: z.widthPct,
                        height: z.heightPct,
                        quadPoints: (z.quadPoints && z.quadPoints.length === 8) 
                          ? (z.quadPoints as [number, number, number, number, number, number, number, number]) 
                          : [0, 0, 100, 0, 100, 100, 0, 100],
                        zIndex: (zIdx + 1) * 10,
                        acceptedItemIds: [z.acceptedItemId],
                      })),
                      items: generated.items.map((i, iIdx) => ({
                        id: i.id,
                        label: i.label,
                        imageUrl: `https://placehold.co/200x200?text=${encodeURIComponent(i.label)}`, // Placeholder
                        aiPrompt: i.prompt, // Save it for actual image gen later
                        group: null,
                        startX: 10, // Default bottom placement for dragging
                        startY: 85, 
                        width: 15,
                        zIndex: (iIdx + 1) * 20,
                      }))
                    };
                    
                    onChange(newConfig);
                    setActiveTab('zones'); // Switch to see results
                  } catch (e) {
                    alert('Error generating scene logic: ' + (e as Error).message);
                  } finally {
                    setIsGenerating(false);
                  }
                }}
                className={`w-full py-2 rounded-lg text-white font-medium flex items-center justify-center gap-2 ${isGenerating ? 'bg-gray-400' : 'bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700'}`}
              >
                {isGenerating ? `Analyzing Scene (${genTime}s)...` : 'Step 1: Build Scene Architecture'}
              </button>

              {config.backgroundPrompt && (
                <div className="pt-6 border-t border-gray-200 space-y-4">
                  <h3 className="font-medium text-sm">Step 2: Synthesize Visuals</h3>
                  <p className="text-xs text-gray-500">Generate the actual images for the empty background and all {config.items.length} mapped objects to fit perfectly.</p>
                  
                  <button
                    disabled={isGenerating}
                    onClick={async () => {
                      try {
                        setIsGenerating(true);
                        let updatedConfig = { ...config };
                        
                        // 1. Generate Background
                        if (config.backgroundPrompt && !config.backgroundImageUrl?.startsWith('data:')) {
                           console.log("Generating background...");
                           const bgDataUrl = await generateImage(config.backgroundPrompt);
                           updatedConfig.backgroundImageUrl = bgDataUrl;
                           onChange(updatedConfig); // update UI immediately
                        }

                        // 2. Generate each missing object
                        for (let i = 0; i < updatedConfig.items.length; i++) {
                           const item = updatedConfig.items[i];
                           if (item.aiPrompt && (!item.imageUrl || item.imageUrl.includes('placehold.co'))) {
                             console.log(`Generating image for ${item.label}...`);
                             const imgDataUrl = await generateImage(item.aiPrompt, true);
                             
                             // Update just this one item
                             updatedConfig = {
                               ...updatedConfig,
                               items: updatedConfig.items.map(it => 
                                 it.id === item.id ? { ...it, imageUrl: imgDataUrl } : it
                               )
                             };
                             onChange(updatedConfig);
                           }
                        }

                        alert("All visual assets generated successfully!");
                      } catch (e) {
                         alert('Error generating visuals: ' + (e as Error).message);
                      } finally {
                        setIsGenerating(false);
                      }
                    }}
                    className={`w-full py-2 rounded-lg text-white font-medium flex items-center justify-center gap-2 ${isGenerating ? 'bg-gray-400' : 'bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700'}`}
                  >
                    <ImageIcon size={18} />
                    {isGenerating ? 'Generating Assets...' : 'Synthesize Visuals'}
                  </button>
                </div>
              )}
            </div>
          )}

          {activeTab === 'general' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Exercise Title</label>
                <input 
                  type="text" 
                  value={config.title}
                  onChange={e => onChange({ ...config, title: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Background Image URL</label>
                <input 
                  type="text" 
                  value={config.backgroundImageUrl || ''}
                  onChange={e => onChange({ ...config, backgroundImageUrl: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Instruction Audio URL</label>
                <input 
                  type="text" 
                  value={config.instructionAudioUrl || ''}
                  onChange={e => onChange({ ...config, instructionAudioUrl: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                />
              </div>
            </div>
          )}

          {activeTab === 'zones' && (
            <div className="space-y-6">
              {(config.dropZones || []).map((zone, idx) => (
                <div key={zone.id} className="p-4 bg-gray-50 rounded-lg border border-gray-200 space-y-3 relative">
                  <button 
                    onClick={() => onChange({ ...config, dropZones: (config.dropZones || []).filter(z => z.id !== zone.id) })}
                    className="absolute top-2 right-2 text-red-500 hover:text-red-700 p-1"
                  >
                    <Trash2 size={16} />
                  </button>
                  <h3 className="font-medium text-sm text-gray-800">Drop Zone {idx + 1}</h3>
                  
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">ID</label>
                      <input type="text" value={zone.id} onChange={e => {
                        const newZones = [...config.dropZones];
                        newZones[idx].id = e.target.value;
                        onChange({ ...config, dropZones: newZones });
                      }} className="w-full px-2 py-1 border border-gray-300 rounded text-sm" />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Accepted Items (comma sep)</label>
                      <input type="text" value={zone.acceptedItemIds.join(', ')} onChange={e => {
                        const newZones = [...config.dropZones];
                        newZones[idx].acceptedItemIds = e.target.value.split(',').map(s => s.trim()).filter(Boolean);
                        onChange({ ...config, dropZones: newZones });
                      }} className="w-full px-2 py-1 border border-gray-300 rounded text-sm" />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Width (%)</label>
                      <input type="number" value={Math.round(zone.width)} onChange={e => {
                        const newZones = [...config.dropZones];
                        newZones[idx].width = Number(e.target.value);
                        onChange({ ...config, dropZones: newZones });
                      }} className="w-full px-2 py-1 border border-gray-300 rounded text-sm" />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Height (%)</label>
                      <input type="number" value={Math.round(zone.height)} onChange={e => {
                        const newZones = [...config.dropZones];
                        newZones[idx].height = Number(e.target.value);
                        onChange({ ...config, dropZones: newZones });
                      }} className="w-full px-2 py-1 border border-gray-300 rounded text-sm" />
                    </div>
                    <div className="col-span-2">
                       <label className="block text-xs text-gray-500 mb-1 font-bold text-indigo-600">Manual Background Image / Silhouette URL</label>
                       <input type="text" value={zone.silhouetteUrl || ''} onChange={e => {
                         const newZones = [...config.dropZones];
                         newZones[idx].silhouetteUrl = e.target.value;
                         onChange({ ...config, dropZones: newZones });
                       }} className="w-full px-2 py-1 border border-indigo-200 bg-indigo-50/30 rounded text-xs" placeholder="Paste URL here for manual setup..." />
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-4 gap-2">
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Layer (Z)</label>
                      <input type="number" value={zone.zIndex || 0} onChange={e => {
                        const newZones = [...config.dropZones];
                        newZones[idx].zIndex = Number(e.target.value);
                        onChange({ ...config, dropZones: newZones });
                      }} className="w-full px-2 py-1 border border-gray-300 rounded text-sm bg-yellow-50/50" placeholder="0" />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">3D Tilt (X)</label>
                      <input type="number" value={zone.rotateX || 0} onChange={e => {
                        const newZones = [...config.dropZones];
                        newZones[idx].rotateX = Number(e.target.value);
                        onChange({ ...config, dropZones: newZones });
                      }} className="w-full px-2 py-1 border border-gray-300 rounded text-sm" placeholder="0" />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">3D Turn (Y)</label>
                      <input type="number" value={zone.rotateY || 0} onChange={e => {
                        const newZones = [...config.dropZones];
                        newZones[idx].rotateY = Number(e.target.value);
                        onChange({ ...config, dropZones: newZones });
                      }} className="w-full px-2 py-1 border border-gray-300 rounded text-sm" placeholder="0" />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">2D Spin (Z)</label>
                      <input type="number" value={zone.rotateZ || 0} onChange={e => {
                        const newZones = [...config.dropZones];
                        newZones[idx].rotateZ = Number(e.target.value);
                        onChange({ ...config, dropZones: newZones });
                      }} className="w-full px-2 py-1 border border-gray-300 rounded text-sm" placeholder="0" />
                    </div>
                  </div>

                  <div className="pt-2 border-t border-gray-200">
                    <label className="block text-xs font-semibold text-blue-700 mb-2 uppercase tracking-wider">Item Fine-Tuning (Inside Zone)</label>
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <label className="block text-[10px] text-gray-500 mb-0.5">Item Zoom</label>
                        <input type="range" min="0.1" max="3" step="0.05" value={zone.itemScale || 1} onChange={e => {
                          const newZones = [...config.dropZones];
                          newZones[idx].itemScale = Number(e.target.value);
                          onChange({ ...config, dropZones: newZones });
                        }} className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer" />
                        <div className="text-[10px] text-center mt-1 text-gray-400">{(zone.itemScale || 1).toFixed(2)}x</div>
                      </div>
                      <div>
                        <label className="block text-[10px] text-gray-500 mb-0.5">Nudge X</label>
                        <input type="range" min="-100" max="100" step="1" value={zone.itemOffsetX || 0} onChange={e => {
                          const newZones = [...config.dropZones];
                          newZones[idx].itemOffsetX = Number(e.target.value);
                          onChange({ ...config, dropZones: newZones });
                        }} className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer" />
                        <div className="text-[10px] text-center mt-1 text-gray-400">{zone.itemOffsetX || 0}%</div>
                      </div>
                      <div>
                        <label className="block text-[10px] text-gray-500 mb-0.5">Nudge Y</label>
                        <input type="range" min="-100" max="100" step="1" value={zone.itemOffsetY || 0} onChange={e => {
                          const newZones = [...config.dropZones];
                          newZones[idx].itemOffsetY = Number(e.target.value);
                          onChange({ ...config, dropZones: newZones });
                        }} className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer" />
                        <div className="text-[10px] text-center mt-1 text-gray-400">{zone.itemOffsetY || 0}%</div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
              <button onClick={addDropZone} className="w-full py-2 border-2 border-dashed border-gray-300 rounded-lg text-gray-600 hover:border-blue-500 hover:text-blue-500 flex items-center justify-center gap-2 transition-colors">
                <Plus size={18} /> Add Drop Zone
              </button>
            </div>
          )}

          {activeTab === 'items' && (
            <div className="space-y-6">
              {(config.items || []).map((item, idx) => (
                <div key={item.id} className="p-4 bg-gray-50 rounded-lg border border-gray-200 space-y-3 relative">
                  <button 
                    onClick={() => onChange({ ...config, items: (config.items || []).filter(i => i.id !== item.id) })}
                    className="absolute top-2 right-2 text-red-500 hover:text-red-700 p-1"
                  >
                    <Trash2 size={16} />
                  </button>
                  <h3 className="font-medium text-sm text-gray-800">Item {idx + 1}</h3>
                  
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">ID</label>
                      <input type="text" value={item.id} onChange={e => {
                        const newItems = [...config.items];
                        newItems[idx].id = e.target.value;
                        onChange({ ...config, items: newItems });
                      }} className="w-full px-2 py-1 border border-gray-300 rounded text-sm" />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Display Label</label>
                      <input type="text" value={item.label || ''} onChange={e => {
                        const newItems = [...config.items];
                        newItems[idx].label = e.target.value;
                        onChange({ ...config, items: newItems });
                      }} className="w-full px-2 py-1 border border-gray-300 rounded text-sm" />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Layer (Z)</label>
                      <input type="number" value={item.zIndex || 0} onChange={e => {
                        const newItems = [...config.items];
                        newItems[idx].zIndex = Number(e.target.value);
                        onChange({ ...config, items: newItems });
                      }} className="w-full px-2 py-1 border border-gray-300 rounded text-sm bg-yellow-50/50" />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Width (%)</label>
                      <input type="number" value={Math.round(item.width)} onChange={e => {
                        const newItems = [...config.items];
                        newItems[idx].width = Number(e.target.value);
                        onChange({ ...config, items: newItems });
                      }} className="w-full px-2 py-1 border border-gray-300 rounded text-sm" />
                    </div>
                    <div className="col-span-2">
                      <label className="block text-xs text-gray-500 mb-1">Image URL</label>
                      <input type="text" value={item.imageUrl} onChange={e => {
                        const newItems = [...config.items];
                        newItems[idx].imageUrl = e.target.value;
                        onChange({ ...config, items: newItems });
                      }} className="w-full px-2 py-1 border border-gray-300 rounded text-sm" />
                    </div>
                  </div>
                </div>
              ))}
              <button onClick={addItem} className="w-full py-2 border-2 border-dashed border-gray-300 rounded-lg text-gray-600 hover:border-green-500 hover:text-green-500 flex items-center justify-center gap-2 transition-colors">
                <Plus size={18} /> Add Item
              </button>
            </div>
          )}
        </div>
      </div>

      {/* JSON Export Modal */}
      {showJson && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[80vh] flex flex-col">
            <div className="flex justify-between items-center p-4 border-b border-gray-200">
              <h3 className="text-lg font-bold">Exercise JSON Configuration</h3>
              <button onClick={() => setShowJson(false)} className="p-1 hover:bg-gray-100 rounded-md"><X size={20} /></button>
            </div>
            <div className="flex-1 overflow-auto p-4 bg-gray-50">
              <pre className="text-xs font-mono text-gray-800 whitespace-pre-wrap select-all">
                {JSON.stringify(config, null, 2)}
              </pre>
            </div>
            <div className="p-4 border-t border-gray-200 bg-white flex justify-between items-center text-sm text-gray-500">
              <span>Copy this JSON and save it to your database or mock data file.</span>
              <a 
                href="/JSON_FORMAT_GUIDE.md" 
                target="_blank" 
                rel="noreferrer"
                className="text-blue-600 hover:underline flex items-center gap-1 font-medium"
              >
                <HelpCircle size={14} /> View Format Guide
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
