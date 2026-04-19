/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import LayeredDragDropExercise from './components/LayeredDragDropExercise';
import { ExerciseBuilder } from './components/ExerciseBuilder';
import { ExerciseConfig, DraggableItem, DropZone } from './types';
import type { LayeredDragItem, LayeredDropZone } from './types/lessonBlocks';

export default function App() {
  const [mode, setMode] = useState<'builder' | 'player'>('builder');
  const [placements, setPlacements] = useState<Record<string, string>>({});
  
  const [config, setConfig] = useState<ExerciseConfig>({
    id: 'demo-exercise',
    title: 'Demo Exercise',
    dropZones: [],
    items: [],
  });

  // Map internal types to player expected types
  const mappedZones: LayeredDropZone[] = config.dropZones.map(z => ({
    id: z.id,
    label: z.label || z.id,
    xPct: z.x,
    yPct: z.y,
    widthPct: z.width,
    heightPct: z.height,
    rotateX: z.rotateX,
    rotateY: z.rotateY,
    rotateZ: z.rotateZ,
    quadPoints: z.quadPoints,
    itemScale: z.itemScale,
    itemOffsetX: z.itemOffsetX,
    itemOffsetY: z.itemOffsetY,
    zIndex: z.zIndex ?? 10,
    acceptsGroups: z.acceptedItemIds,
  }));

  const mappedItems: LayeredDragItem[] = config.items.map(i => ({
    id: i.id,
    label: i.label || i.id,
    imageUrl: i.imageUrl,
    targetZoneId: config.dropZones.find(z => z.acceptedItemIds.includes(i.id))?.id || '',
    group: i.group || i.id,
    xPct: i.startX,
    yPct: i.startY,
    widthPct: i.width,
    zIndex: i.zIndex ?? 20,
  }));

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8 font-sans">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex justify-between items-center bg-white p-4 rounded-xl shadow-sm border border-gray-200">
          <div>
            <h1 className="text-2xl font-bold">Unified Scene Architect</h1>
            <p className="text-gray-600">
              Build your layered drag & drop scene using AI or play it!
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setMode('builder')}
              className={`px-4 py-2 rounded-lg font-medium ${mode === 'builder' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
            >
              Builder
            </button>
            <button
              onClick={() => setMode('player')}
              className={`px-4 py-2 rounded-lg font-medium ${mode === 'player' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
            >
              Play / Preview
            </button>
          </div>
        </div>

        {mode === 'builder' ? (
          <ExerciseBuilder config={config} onChange={setConfig} />
        ) : (
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
             {config.dropZones.length === 0 ? (
               <div className="text-center py-12 text-gray-500">
                  <p>No zones configured. Please use the Builder to create a scene.</p>
               </div>
             ) : (
               <LayeredDragDropExercise
                 items={mappedItems}
                 zones={mappedZones}
                 backgroundImageUrl={config.backgroundImageUrl || "https://images.unsplash.com/photo-1533090161767-e6ffed986c88?auto=format&fit=crop&w=1920&q=80"}
                 value={placements}
                 onChange={setPlacements}
               />
             )}
          </div>
        )}
      </div>
    </div>
  );
}


