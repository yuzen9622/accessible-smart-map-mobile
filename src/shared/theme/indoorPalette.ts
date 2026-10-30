/** 同步 web indoorTheme 材質；色彩只表示顯示分類，不代表可通行或已實測。 */
export interface IndoorPalette {
  primary: string;
  iconBackground: string;
  iconInk: string;
  primaryCss: string;
  routeCasingCss: string;
  labelSelectedBackground: string;
  labelSelectedInk: string;
  labelSelectedBorder: string;
  labelBorder: string;
  selection: string;
  labelInk: string;
  labelBackground: string;
  material: {
    wall: string;
    slab: string;
    room: string;
    toilet: string;
    corridor: string;
    unknownArea: string;
    outline: string;
    spaceBoundary: string;
    elevator: string;
    stairs: string;
    core: string;
    nonStopping: string;
    facilityOutline: string;
    nonStoppingOutline: string;
    context: string;
  };
}
export type IndoorMaterialRole = keyof IndoorPalette['material'];

const light: IndoorPalette = {
  primary: '#2563eb', iconBackground: '#2563eb', iconInk: '#ffffff', primaryCss: '#2563eb', routeCasingCss: '#ffffff', labelSelectedBackground: '#2563eb', labelSelectedInk: '#ffffff', labelSelectedBorder: '#1d4ed8', labelBorder: '#d1d5db', selection: '#bfdbfe', labelInk: '#334155', labelBackground: '#ffffff',
  material: {
    wall: '#fafafa', slab: '#d6d6d6', room: '#f2f2f2', toilet: '#e8e8e8', corridor: '#dfdfdf',
    unknownArea: '#e5e5e5', outline: '#bababa', spaceBoundary: '#9aa7b4', elevator: '#bfdbfe',
    stairs: '#dbeafe', core: '#e2e8f0', nonStopping: '#e5e7eb', facilityOutline: '#93a9c9',
    nonStoppingOutline: '#94a3b8', context: '#d6d6d6',
  },
};
const dark: IndoorPalette = {
  primary: '#60a5fa', iconBackground: '#1d4ed8', iconInk: '#ffffff', primaryCss: '#60a5fa', routeCasingCss: '#111827', labelSelectedBackground: '#60a5fa', labelSelectedInk: '#0f172a', labelSelectedBorder: '#93c5fd', labelBorder: '#64748b', selection: '#305993', labelInk: '#e2e8f0', labelBackground: '#0f172a',
  material: {
    wall: '#8391a5', slab: '#1e2630', room: '#415068', toilet: '#4a5870', corridor: '#2b3644',
    unknownArea: '#354050', outline: '#7c8ca5', spaceBoundary: '#637083', elevator: '#233f62',
    stairs: '#273b52', core: '#354050', nonStopping: '#343d49', facilityOutline: '#6489b4',
    nonStoppingOutline: '#68778b', context: '#1e2630',
  },
};
export function getIndoorPalette(theme: 'light' | 'dark' = 'light'): IndoorPalette {
  return theme === 'dark' ? dark : light;
}
