import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ExternalLink, Search, Wrench, Map, ClipboardList, Calculator } from "lucide-react";

const BOSTON_NEIGHBORHOODS = [
  "Allston", "Brighton", "Back Bay", "Bay Village", "Beacon Hill", "West End",
  "Charlestown", "Dorchester", "East Boston", "Fenway", "Kenmore", "Hyde Park",
  "Jamaica Plain", "Mattapan", "Mission Hill", "North End", "Roslindale",
  "Roxbury", "South Boston & Seaport", "South End", "West Roxbury"
];

const BOSTON_PERMIT_URL = "https://onlinepermitsandlicenses.cityofboston.gov/isdpermits/Views/LoginEnrollConfirmation.aspx";

const MUNICIPALITIES = [
  { name: "Arlington", permit: "https://arlingtonma.viewpointcloud.com/login" },
  { name: "Belmont", permit: "https://belmontma.viewpointcloud.com/login" },
  { name: "Boston", permit: BOSTON_PERMIT_URL, neighborhoods: BOSTON_NEIGHBORHOODS },
  { name: "Braintree", permit: "https://braintreema.viewpointcloud.com/login" },
  { name: "Brookline", permit: "https://aca-prod.accela.com/BROOKLINE/Login.aspx" },
  { name: "Burlington", permit: "https://burlingtonma.viewpointcloud.com/login" },
  { name: "Cambridge", permit: "https://cambridgema.viewpointcloud.com/login" },
  { name: "Canton", permit: "https://cantonma.viewpointcloud.com/login" },
  { name: "Chelsea", permit: "https://www.citizenserve.com/Portal/Portal.aspx?u=CHELSEA" },
  { name: "Dedham", permit: "https://dedhamma.viewpointcloud.com/login" },
  { name: "Dover", permit: "https://doverma.viewpointcloud.com/login" },
  { name: "Everett", permit: "https://everettma.viewpointcloud.com/login" },
  { name: "Hingham", permit: "https://hinghamma.viewpointcloud.com/login" },
  { name: "Holbrook", permit: "https://holbrookma.viewpointcloud.com/login" },
  { name: "Hull", permit: "https://hullma.viewpointcloud.com/login" },
  { name: "Lexington", permit: "https://lexingtonma.viewpointcloud.com/login" },
  { name: "Lynn", permit: "https://lynnisdportal.com/login" },
  { name: "Malden", permit: "https://cityofmalden.viewpointcloud.com/login" },
  { name: "Medford", permit: "https://medfordma.viewpointcloud.com/login" },
  { name: "Melrose", permit: "https://melrosema.viewpointcloud.com/login" },
  { name: "Milton", permit: "https://miltonma.viewpointcloud.com/login" },
  { name: "Nahant", permit: "https://nahantma.viewpointcloud.com/login" },
  { name: "Needham", permit: "https://needhamma.viewpointcloud.com/login" },
  { name: "Newton", permit: "https://newtonma.viewpointcloud.com/login" },
  { name: "Norfolk", permit: "https://norfolkma.viewpointcloud.com/login" },
  { name: "Norwood", permit: "https://norwoodma.viewpointcloud.com/login" },
  { name: "Quincy", permit: "https://quincyma.viewpointcloud.com/login" },
  { name: "Randolph", permit: "https://randolphma.viewpointcloud.com/login" },
  { name: "Revere", permit: "https://www.citizenserve.com/Portal/Portal.aspx?u=REVERE" },
  { name: "Saugus", permit: "https://saugusma.viewpointcloud.com/login" },
  { name: "Somerville", permit: "https://www.citizenserve.com/Portal/Portal.aspx?u=SOMERVILLE" },
  { name: "Stoneham", permit: "https://stonehamma.viewpointcloud.com/login" },
  { name: "Stoughton", permit: "https://stoughtonma.viewpointcloud.com/login" },
  { name: "Swampscott", permit: "https://swampscottma.viewpointcloud.com/login" },
  { name: "Wakefield", permit: "https://wakefieldma.viewpointcloud.com/login" },
  { name: "Waltham", permit: "https://walthamma.viewpointcloud.com/login" },
  { name: "Watertown", permit: "https://watertownma.viewpointcloud.com/login" },
  { name: "Wellesley", permit: "https://wellesleyma.viewpointcloud.com/login" },
  { name: "Westwood", permit: "https://westwoodma.viewpointcloud.com/login" },
  { name: "Weymouth", permit: "https://weymouthma.viewpointcloud.com/login" },
  { name: "Winchester", permit: "https://winchesterma.viewpointcloud.com/login" },
  { name: "Winthrop", permit: "https://winthropma.viewpointcloud.com/login" },
  { name: "Woburn", permit: "https://woburnma.viewpointcloud.com/login" },
];

const QUICK_CALC_ITEMS = [
  { label: "Linear Feet → Boards (12ft)", formula: (v) => (v / 12).toFixed(1) + " boards" },
  { label: "Sq Ft → Squares (100 sq ft)", formula: (v) => (v / 100).toFixed(2) + " squares" },
  { label: "Cubic Yards → Cubic Feet", formula: (v) => (v * 27).toFixed(1) + " cu ft" },
  { label: "Cubic Feet → Cubic Yards", formula: (v) => (v / 27).toFixed(2) + " cu yds" },
];

export default function EstimatorToolbox() {
  const [search, setSearch] = useState("");
  const [calcVal, setCalcVal] = useState("");

  const filtered = MUNICIPALITIES.filter((m) =>
    m.name.toLowerCase().includes(search.toLowerCase()) ||
    (m.neighborhoods || []).some(n => n.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto bg-gray-50 min-h-screen">
      <div className="mb-5">
        <div className="flex items-center gap-2">
          <Wrench className="w-5 h-5 sm:w-6 sm:h-6 text-primary" />
          <h1 className="text-xl sm:text-2xl font-bold text-secondary">Contractor Toolbox</h1>
        </div>
        <p className="text-sm text-gray-500">Permit portals, zoning maps, and inspection services by municipality</p>
      </div>

      <div className="grid md:grid-cols-3 gap-4 sm:gap-6">
        {/* Municipality Directory */}
        <div className="md:col-span-2 bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="flex items-center gap-3 px-5 py-4 bg-secondary/5 border-b border-gray-100">
            <ClipboardList className="w-5 h-5 text-primary" />
            <h2 className="font-semibold text-secondary">Municipal Permit Portals</h2>
          </div>
          <div className="p-5">
          <div className="relative mb-4">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search municipality..."
              className="pl-9"
            />
          </div>
          <div className="space-y-2 max-h-[480px] overflow-y-auto pr-1">
            {filtered.map((m) => (
              <div key={m.name} className="border border-gray-100 rounded-xl p-4 bg-gray-50 hover:bg-white transition-colors">
                <div className="font-semibold text-secondary mb-1">{m.name}, MA</div>
                {m.neighborhoods && (
                  <div className="text-xs text-gray-400 mb-2">{m.neighborhoods.join(" · ")}</div>
                )}
                <div className="flex flex-wrap gap-2">
                  <a href={m.permit} target="_blank" rel="noreferrer"
                    className="text-xs bg-primary/10 text-primary px-3 py-1.5 rounded-lg hover:bg-primary hover:text-white transition-colors flex items-center gap-1">
                    <ClipboardList className="w-3 h-3" /> Permit Portal <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>
            ))}
            {filtered.length === 0 && <p className="text-center text-sm text-gray-400 py-6">No municipality found.</p>}
          </div>
          </div>
        </div>

        {/* Quick Converters */}
        <div>
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden mb-4">
            <div className="flex items-center gap-2 px-5 py-4 bg-secondary/5 border-b border-gray-100">
              <Calculator className="w-5 h-5 text-primary" />
              <h2 className="font-semibold text-secondary">Quick Conversions</h2>
            </div>
          <div className="p-5">
            <div className="mb-3">
              <label className="text-xs text-gray-500 block mb-1">Input Value</label>
              <Input
                type="number"
                value={calcVal}
                onChange={(e) => setCalcVal(e.target.value)}
                placeholder="Enter value..."
                className="text-center"
              />
            </div>
            <div className="space-y-2">
              {QUICK_CALC_ITEMS.map((item) => (
                <div key={item.label} className="flex items-center justify-between text-xs bg-gray-50 border border-gray-100 rounded-lg px-3 py-2.5">
                  <span className="text-gray-600">{item.label}</span>
                  <span className="font-bold text-primary">
                    {calcVal ? item.formula(Number(calcVal)) : "—"}
                  </span>
                </div>
              ))}
            </div>
          </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <div className="px-5 py-4 bg-secondary/5 border-b border-gray-100">
              <h2 className="font-semibold text-secondary">Useful Links</h2>
            </div>
            <div className="p-5">
            <div className="space-y-2">
              {(() => {
                const links = [
                  { label: "MA BBRS — Contractor License Lookup", url: "https://elicensing.state.ma.us/citrix/elicensing/" },
                  { label: "MA Building Code (CMR 780)", url: "https://www.mass.gov/regulations/780-cmr-massachusetts-state-building-code/" },
                  { label: "OSHA Safety Guidelines", url: "https://www.osha.gov/construction" },
                  { label: "Home Depot Pro", url: "https://www.homedepot.com/c/Pro" },
                  { label: "ABC Supply", url: "https://www.abcsupply.com/" },
                  { label: "Beacon Roofing Supply", url: "https://www.becn.com/" },
                ];
                return links.map((l) => (
                  <a key={l.url} href={l.url} target="_blank" rel="noreferrer"
                    className="flex text-xs text-primary hover:underline items-center gap-1 py-1.5 border-b border-gray-50 last:border-0">
                    <ExternalLink className="w-3 h-3 shrink-0" /> {l.label}
                  </a>
                ));
              })()}
            </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}