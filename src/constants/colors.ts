export const PALETTE = [
  { label: 'Plasma Pink',   hex: '#ff6b9d' },
  { label: 'Neutron Blue',  hex: '#4fc3f7' },
  { label: 'Quasar Purple', hex: '#b388ff' },
  { label: 'Solar Gold',    hex: '#ffd54f' },
  { label: 'Gamma Green',   hex: '#69f0ae' },
  { label: 'Redshift Red',  hex: '#ff5252' },
  { label: 'Nebula Teal',   hex: '#40c4ff' },
  { label: 'Pulsar White',  hex: '#f5f5f5' },
] as const;

export const PALETTE_COLORS = PALETTE.map(p => p.hex);

export const COLORS = {
  background:   '#0a0a0f',
  surface:      '#13131a',
  surfaceHigh:  '#1c1c26',
  border:       '#2a2a3a',
  textPrimary:  '#f0f0f5',
  textSecondary:'#8888aa',
  textMuted:    '#555566',
  conflict:     '#ff5252',
  conflictDim:  'rgba(255, 82, 82, 0.15)',
  white:        '#ffffff',
  accent:       '#4fc3f7',
} as const;
