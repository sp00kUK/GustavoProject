import { useStore } from '../state/store';
import { Section, SelectField, NumberField, SliderField, Toggle } from './controls';
import type { OperationSettings, ProjectionMode } from '../types';

import { EXAMPLE_PATTERNS } from '../pattern/procedural';

export function OperationsSection() {
  const settings = useStore((s) => s.settings);
  const operations = settings.operations || [];
  const addOperation = useStore((s) => s.addOperation);
  const removeOperation = useStore((s) => s.removeOperation);
  const updateOperation = useStore((s) => s.updateOperation);

  const handleAddOperation = () => {
    addOperation({
      id: `op_${Date.now()}`,
      name: `Displacement ${operations.length + 1}`,
      type: 'displace',
      targetPart: 'body',
      mappingKind: 'grid',
      visible: true,
      projectionMode: 'cylindrical',
      projectionMatrix: [1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1],
      patternId: 'brick',
      maskId: null,
      depth: 1.0,
      smoothing: 0,
      tileFit: 'stretch',
      snapSeamlessWrap: true,
      columns: 1,
      rows: 1,
      offsetX: 0,
      offsetY: 0,
      scaleX: 1,
      scaleY: 1,
      rotation: 0,
      mirrorX: false,
      mirrorY: false
    });
  };

  return (
    <Section title="Operations Stack" defaultOpen={false}>
      {operations.length === 0 ? (
        <div style={{ marginBottom: '8px', fontSize: '0.85em', color: '#666' }}>
          No operations. Adding an operation overrides legacy pattern settings.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {operations.map((op, i) => (
            <OperationCard 
              key={op.id} 
              operation={op}
              index={i}
              onUpdate={(patch) => updateOperation(op.id, patch)}
              onRemove={() => removeOperation(op.id)}
            />
          ))}
        </div>
      )}
      <button onClick={handleAddOperation} style={{ width: '100%', marginTop: '8px' }}>
        + Add Displacement
      </button>
    </Section>
  );
}

function OperationCard({
  operation: op,
  
  onUpdate,
  onRemove,
}: {
  operation: OperationSettings;
  index: number;
  onUpdate: (patch: Partial<OperationSettings>) => void;
  onRemove: () => void;
}) {
  const patternOptions = EXAMPLE_PATTERNS.map((p) => ({
    value: p.id,
    label: p.label,
  }));

  const projectionOptions: { value: ProjectionMode; label: string }[] = [
    { value: 'cylindrical', label: 'Cylindrical' },
    { value: 'spherical', label: 'Spherical' },
    { value: 'planar', label: 'Planar' },
    { value: 'cubic', label: 'Cubic' },
  ];

  return (
    <div style={{ border: '1px solid #ddd', padding: '8px', borderRadius: '4px', backgroundColor: '#f9f9f9' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
        <strong>{op.name}</strong>
        <div style={{ display: 'flex', gap: '4px' }}>
          <Toggle 
            label="" 
            checked={op.visible} 
            onChange={(visible) => onUpdate({ visible })} 
          />
          <button onClick={onRemove} style={{ padding: '2px 6px' }}>X</button>
        </div>
      </div>
      
      {op.visible && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <SelectField
            label="Pattern"
            value={op.patternId || ''}
            options={patternOptions}
            onChange={(patternId) => onUpdate({ patternId })}
          />
          <SelectField<ProjectionMode>
            label="Projection"
            value={op.projectionMode}
            options={projectionOptions}
            onChange={(projectionMode) => onUpdate({ projectionMode })}
          />
          <SliderField
            label="Depth"
            value={op.depth}
            onChange={(depth) => onUpdate({ depth })}
            min={-5}
            max={5}
            step={0.1}
            unit="mm"
          />
          
          <div style={{ display: 'flex', gap: '4px' }}>
            <div style={{ flex: 1 }}>
              <NumberField
                label="Columns"
                value={op.columns}
                onChange={(columns) => onUpdate({ columns })}
                min={1}
                max={100}
                step={1}
              />
            </div>
            <div style={{ flex: 1 }}>
              <NumberField
                label="Rows"
                value={op.rows}
                onChange={(rows) => onUpdate({ rows })}
                min={1}
                max={100}
                step={1}
              />
            </div>
          </div>
          
          <div style={{ display: 'flex', gap: '4px' }}>
            <div style={{ flex: 1 }}>
              <NumberField
                label="Offset X"
                value={op.offsetX}
                onChange={(offsetX) => onUpdate({ offsetX })}
                min={-100}
                max={100}
                step={0.01}
              />
            </div>
            <div style={{ flex: 1 }}>
              <NumberField
                label="Offset Y"
                value={op.offsetY}
                onChange={(offsetY) => onUpdate({ offsetY })}
                min={-100}
                max={100}
                step={0.01}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
