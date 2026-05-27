import { useState } from "react";
import { Calculator, ChevronDown, ChevronUp } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useCompanyBrand } from "@/hooks/useCompanyBrand";

const CALCULATORS = [
  {
    id: "roofing",
    label: "Roofing",
    color: "bg-orange-50 border-orange-200",
    accent: "text-orange-600",
    fields: [
      { key: "length", label: "Roof Length (ft)" },
      { key: "width", label: "Roof Width (ft)" },
      { key: "pitch", label: "Roof Pitch (e.g. 6 for 6:12)" },
      { key: "waste", label: "Waste % (default 10)" },
    ],
    calc: (v) => {
      const l = parseFloat(v.length) || 0;
      const w = parseFloat(v.width) || 0;
      const pitch = parseFloat(v.pitch) || 4;
      const waste = parseFloat(v.waste) || 10;
      const pitchFactor = Math.sqrt(1 + (pitch / 12) ** 2);
      const actualArea = l * w * pitchFactor;
      const withWaste = actualArea * (1 + waste / 100);
      const squares = withWaste / 100;
      return [
        { label: "Flat Area", value: `${(l * w).toFixed(0)} sq ft` },
        { label: "Actual Roof Area (with pitch)", value: `${actualArea.toFixed(0)} sq ft` },
        { label: "Area with Waste", value: `${withWaste.toFixed(0)} sq ft` },
        { label: "Roofing Squares Needed", value: `${squares.toFixed(2)} squares`, highlight: true },
        { label: "Bundles (3/sq)", value: `${(squares * 3).toFixed(0)} bundles` },
      ];
    },
  },
  {
    id: "flooring",
    label: "Flooring",
    color: "bg-yellow-50 border-yellow-200",
    accent: "text-yellow-700",
    fields: [
      { key: "length", label: "Room Length (ft)" },
      { key: "width", label: "Room Width (ft)" },
      { key: "waste", label: "Waste % (default 8)" },
    ],
    calc: (v) => {
      const area = (parseFloat(v.length) || 0) * (parseFloat(v.width) || 0);
      const waste = parseFloat(v.waste) || 8;
      const withWaste = area * (1 + waste / 100);
      return [
        { label: "Net Area", value: `${area.toFixed(1)} sq ft` },
        { label: "With Waste", value: `${withWaste.toFixed(1)} sq ft`, highlight: true },
        { label: "Boxes (25 sq ft)", value: `${Math.ceil(withWaste / 25)} boxes` },
        { label: "Boxes (20 sq ft)", value: `${Math.ceil(withWaste / 20)} boxes` },
      ];
    },
  },
  {
    id: "concrete",
    label: "Concrete",
    color: "bg-gray-50 border-gray-300",
    accent: "text-gray-700",
    fields: [
      { key: "length", label: "Length (ft)" },
      { key: "width", label: "Width (ft)" },
      { key: "depth", label: "Depth / Thickness (inches)" },
    ],
    calc: (v) => {
      const l = parseFloat(v.length) || 0;
      const w = parseFloat(v.width) || 0;
      const d = (parseFloat(v.depth) || 4) / 12;
      const cubicFt = l * w * d;
      const yards = cubicFt / 27;
      return [
        { label: "Cubic Feet", value: `${cubicFt.toFixed(1)} cu ft` },
        { label: "Cubic Yards", value: `${yards.toFixed(2)} cu yds`, highlight: true },
        { label: "80lb Bags (0.6 cu ft each)", value: `${Math.ceil(cubicFt / 0.6)} bags` },
        { label: "Concrete Trucks (10 yd)", value: `${(yards / 10).toFixed(2)} trucks` },
      ];
    },
  },
  {
    id: "framing",
    label: "Wall Framing",
    color: "bg-green-50 border-green-200",
    accent: "text-green-700",
    fields: [
      { key: "linear_ft", label: "Linear Feet of Wall" },
      { key: "height", label: "Wall Height (ft)" },
      { key: "spacing", label: "Stud Spacing (default 16 inches)" },
      { key: "doors", label: "# of Door Openings" },
      { key: "windows", label: "# of Window Openings" },
    ],
    calc: (v) => {
      const lf = parseFloat(v.linear_ft) || 0;
      const h = parseFloat(v.height) || 8;
      const spacing = parseFloat(v.spacing) || 16;
      const doors = parseInt(v.doors) || 0;
      const windows = parseInt(v.windows) || 0;
      const studs = Math.ceil((lf / (spacing / 12)) + 1);
      const plates = lf * 3; // top, bottom, cap plate
      const extraStuds = doors * 4 + windows * 4; // cripples + kings
      return [
        { label: "Studs (field)", value: `${studs} studs` },
        { label: "Extra studs (openings)", value: `${extraStuds} studs` },
        { label: "Total Studs", value: `${studs + extraStuds} studs`, highlight: true },
        { label: "Plate Material (3 plates)", value: `${plates.toFixed(0)} lf` },
        { label: "Wall Sq Ft", value: `${(lf * h).toFixed(0)} sq ft` },
      ];
    },
  },
  {
    id: "paint",
    label: "Paint",
    color: "bg-blue-50 border-blue-200",
    accent: "text-blue-700",
    fields: [
      { key: "length", label: "Room Length (ft)" },
      { key: "width", label: "Room Width (ft)" },
      { key: "height", label: "Ceiling Height (ft)" },
      { key: "doors", label: "# of Doors (subtract)" },
      { key: "windows", label: "# of Windows (subtract)" },
      { key: "coats", label: "# of Coats (default 2)" },
    ],
    calc: (v) => {
      const l = parseFloat(v.length) || 0;
      const w = parseFloat(v.width) || 0;
      const h = parseFloat(v.height) || 8;
      const doors = parseInt(v.doors) || 0;
      const windows = parseInt(v.windows) || 0;
      const coats = parseInt(v.coats) || 2;
      const wallArea = 2 * (l + w) * h;
      const openings = doors * 21 + windows * 15; // ~21 sf door, 15 sf window
      const netArea = Math.max(0, wallArea - openings) * coats;
      const gallons = netArea / 350; // ~350 sf/gal
      return [
        { label: "Gross Wall Area", value: `${wallArea.toFixed(0)} sq ft` },
        { label: "Net Paintable Area", value: `${(wallArea - openings).toFixed(0)} sq ft` },
        { label: "Gallons Needed", value: `${gallons.toFixed(1)} gal`, highlight: true },
        { label: "1-Gallon Cans", value: `${Math.ceil(gallons)} cans` },
        { label: "5-Gallon Buckets", value: `${Math.ceil(gallons / 5)} buckets` },
      ];
    },
  },
  {
    id: "deck",
    label: "Deck / Lumber",
    color: "bg-amber-50 border-amber-200",
    accent: "text-amber-700",
    fields: [
      { key: "length", label: "Deck Length (ft)" },
      { key: "width", label: "Deck Width (ft)" },
      { key: "board_width", label: "Board Width (inches, e.g. 5.5)" },
      { key: "spacing", label: "Gap between boards (inches, e.g. 0.25)" },
      { key: "waste", label: "Waste % (default 10)" },
    ],
    calc: (v) => {
      const l = parseFloat(v.length) || 0;
      const w = parseFloat(v.width) || 0;
      const bw = parseFloat(v.board_width) || 5.5;
      const gap = parseFloat(v.spacing) || 0.25;
      const waste = parseFloat(v.waste) || 10;
      const area = l * w;
      const boardsPerFt = 12 / (bw + gap);
      const linFt = w * boardsPerFt * l;
      const withWaste = linFt * (1 + waste / 100);
      return [
        { label: "Deck Area", value: `${area.toFixed(0)} sq ft` },
        { label: "Linear Feet of Decking", value: `${linFt.toFixed(0)} lf` },
        { label: "With Waste", value: `${withWaste.toFixed(0)} lf`, highlight: true },
        { label: "12ft Boards", value: `${Math.ceil(withWaste / 12)} boards` },
        { label: "16ft Boards", value: `${Math.ceil(withWaste / 16)} boards` },
      ];
    },
  },
  {
    id: "siding",
    label: "Siding",
    color: "bg-purple-50 border-purple-200",
    accent: "text-purple-700",
    fields: [
      { key: "perimeter", label: "Wall Perimeter (ft)" },
      { key: "height", label: "Wall Height (ft)" },
      { key: "gables", label: "Gable Area (sq ft, optional)" },
      { key: "doors", label: "# of Doors (subtract)" },
      { key: "windows", label: "# of Windows (subtract)" },
      { key: "waste", label: "Waste % (default 10)" },
    ],
    calc: (v) => {
      const perim = parseFloat(v.perimeter) || 0;
      const h = parseFloat(v.height) || 8;
      const gables = parseFloat(v.gables) || 0;
      const doors = parseInt(v.doors) || 0;
      const windows = parseInt(v.windows) || 0;
      const waste = parseFloat(v.waste) || 10;
      const gross = perim * h + gables;
      const openings = doors * 21 + windows * 15;
      const net = Math.max(0, gross - openings);
      const withWaste = net * (1 + waste / 100);
      const squares = withWaste / 100;
      return [
        { label: "Gross Wall Area", value: `${gross.toFixed(0)} sq ft` },
        { label: "Net Siding Area", value: `${net.toFixed(0)} sq ft` },
        { label: "With Waste", value: `${withWaste.toFixed(0)} sq ft`, highlight: true },
        { label: "Squares", value: `${squares.toFixed(2)} squares` },
      ];
    },
  },
  {
    id: "drywall",
    label: "Drywall",
    color: "bg-rose-50 border-rose-200",
    accent: "text-rose-700",
    fields: [
      { key: "length", label: "Room Length (ft)" },
      { key: "width", label: "Room Width (ft)" },
      { key: "height", label: "Ceiling Height (ft)" },
      { key: "include_ceiling", label: "Include Ceiling? (1=yes, 0=no)" },
      { key: "doors", label: "# of Doors" },
      { key: "windows", label: "# of Windows" },
    ],
    calc: (v) => {
      const l = parseFloat(v.length) || 0;
      const w = parseFloat(v.width) || 0;
      const h = parseFloat(v.height) || 8;
      const ceiling = parseInt(v.include_ceiling) !== 0;
      const doors = parseInt(v.doors) || 0;
      const windows = parseInt(v.windows) || 0;
      let area = 2 * (l + w) * h;
      if (ceiling) area += l * w;
      const openings = doors * 21 + windows * 15;
      const net = Math.max(0, area - openings);
      const sheets4x8 = Math.ceil(net / 32 * 1.1); // 10% waste
      return [
        { label: "Gross Area", value: `${area.toFixed(0)} sq ft` },
        { label: "Net Area", value: `${net.toFixed(0)} sq ft` },
        { label: "4×8 Sheets (10% waste)", value: `${sheets4x8} sheets`, highlight: true },
        { label: "4×12 Sheets", value: `${Math.ceil(net / 48 * 1.1)} sheets` },
      ];
    },
  },
];

export default function TradeCalculators() {
  const { brandColor } = useCompanyBrand();
  const [expanded, setExpanded] = useState("roofing");
  const [values, setValues] = useState({});

  const setVal = (calcId, key, val) => {
    setValues(prev => ({ ...prev, [calcId]: { ...(prev[calcId] || {}), [key]: val } }));
  };

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: brandColor + "20" }}>
          <Calculator className="w-5 h-5" style={{ color: brandColor }} />
        </div>
        <div>
          <h1 className="text-xl font-bold text-secondary">Trade Calculators</h1>
          <p className="text-sm text-gray-500">Material quantity estimators for roofing, flooring, concrete, framing, and more</p>
        </div>
      </div>

      <div className="space-y-3">
        {CALCULATORS.map(calc => {
          const isOpen = expanded === calc.id;
          const vals = values[calc.id] || {};
          const results = calc.calc(vals);
          const hasInput = Object.values(vals).some(v => v !== "" && v !== undefined);

          return (
            <div key={calc.id} className={`border rounded-xl overflow-hidden ${calc.color}`}>
              <button
                className="w-full flex items-center justify-between px-5 py-4 text-left"
                onClick={() => setExpanded(isOpen ? null : calc.id)}
              >
                <div className="flex items-center gap-3">
                  <Calculator className={`w-4 h-4 ${calc.accent}`} />
                  <span className={`font-semibold ${calc.accent}`}>{calc.label}</span>
                </div>
                {isOpen ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
              </button>

              {isOpen && (
                <div className="px-5 pb-5 border-t border-white/60">
                  <div className="grid sm:grid-cols-2 gap-3 mt-4 mb-4">
                    {calc.fields.map(field => (
                      <div key={field.key}>
                        <label className="text-xs text-gray-500 block mb-1">{field.label}</label>
                        <Input
                          type="number"
                          value={vals[field.key] || ""}
                          onChange={e => setVal(calc.id, field.key, e.target.value)}
                          placeholder="0"
                          className="bg-white"
                        />
                      </div>
                    ))}
                  </div>

                  {hasInput && (
                    <div className="bg-white rounded-xl border border-white/80 p-4 space-y-2">
                      <div className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Results</div>
                      {results.map(r => (
                        <div key={r.label} className={`flex justify-between items-center text-sm py-1.5 ${r.highlight ? "border-t border-gray-100 pt-2 mt-1" : ""}`}>
                          <span className={r.highlight ? "font-semibold text-secondary" : "text-gray-600"}>{r.label}</span>
                          <span className={r.highlight ? `font-bold text-lg ${calc.accent}` : "font-semibold text-secondary"}>{r.value}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {!hasInput && (
                    <p className="text-xs text-gray-400 text-center py-3">Enter values above to see calculations</p>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}