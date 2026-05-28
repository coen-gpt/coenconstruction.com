import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Calendar, Clock, CheckCircle, ChevronLeft, ChevronRight, Loader2, Phone } from 'lucide-react';

export default function BookWalkthrough() {
  const urlParams = new URLSearchParams(window.location.search);
  const token = urlParams.get('token');

  const [state, setState] = useState('loading'); // loading | ready | confirming | confirmed | error
  const [slots, setSlots] = useState([]);
  const [groupedSlots, setGroupedSlots] = useState({});
  const [company, setCompany] = useState({});
  const [lead, setLead] = useState({});
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [confirmedDetails, setConfirmedDetails] = useState(null);
  const [activeDateIndex, setActiveDateIndex] = useState(0);

  useEffect(() => {
    if (!token) {
      setErrorMsg('No booking link token found. Please use the link from your email.');
      setState('error');
      return;
    }
    loadSlots();
  }, []);

  async function loadSlots() {
    setState('loading');
    const res = await base44.functions.invoke('getBookingSlots', { lead_token: token });
    const data = res.data;
    if (data.error) {
      setErrorMsg(data.error);
      setState('error');
      return;
    }
    setSlots(data.slots || []);
    setCompany(data.company || {});
    setLead(data.lead || {});

    // Group slots by date label
    const grouped = {};
    for (const slot of data.slots || []) {
      if (!grouped[slot.date]) grouped[slot.date] = [];
      grouped[slot.date].push(slot);
    }
    setGroupedSlots(grouped);
    setState('ready');
  }

  async function confirmSlot() {
    if (!selectedSlot) return;
    setState('confirming');
    const res = await base44.functions.invoke('confirmBooking', {
      lead_token: token,
      slot_start: selectedSlot.start,
      slot_end: selectedSlot.end,
    });
    const data = res.data;
    if (data.error) {
      setErrorMsg(data.error);
      setState('error');
      return;
    }
    setConfirmedDetails(data);
    setState('confirmed');
  }

  const brandColor = company.brand_color || '#E35235';
  const dates = Object.keys(groupedSlots);
  const activeDate = dates[activeDateIndex];

  if (state === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
          <p className="text-gray-500 text-sm">Loading available times…</p>
        </div>
      </div>
    );
  }

  if (state === 'error') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="bg-white rounded-xl shadow-md p-8 max-w-md text-center">
          <div className="text-4xl mb-4">⚠️</div>
          <h2 className="text-xl font-bold text-gray-800 mb-2">Unable to Load Booking</h2>
          <p className="text-gray-500">{errorMsg}</p>
          <p className="text-gray-400 text-sm mt-4">Please contact us directly to schedule your walkthrough.</p>
        </div>
      </div>
    );
  }

  if (state === 'confirmed') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="bg-white rounded-2xl shadow-lg max-w-md w-full overflow-hidden">
          <div className="p-8 text-center" style={{ background: brandColor }}>
            <CheckCircle className="w-14 h-14 text-white mx-auto mb-3" />
            <h1 className="text-2xl font-bold text-white">You're Confirmed!</h1>
            <p className="text-white/80 text-sm mt-1">{company.company_name}</p>
          </div>
          <div className="p-8">
            <div className="bg-gray-50 rounded-xl border border-gray-100 p-5 mb-6">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Appointment Details</p>
              <p className="text-base font-semibold text-gray-800">📅 {confirmedDetails?.date_label} ET</p>
              {lead.address && <p className="text-sm text-gray-600 mt-1">📍 {lead.address}</p>}
              <p className="text-sm text-gray-600 mt-1">🏗️ {lead.project_type || 'Project Walkthrough'}</p>
            </div>
            <p className="text-sm text-gray-600 text-center leading-relaxed">
              A calendar invite has been sent to <strong>{lead.email}</strong>.<br/>
              Someone from our team will call to confirm the day before.
            </p>
            {company.phone && (
              <a
                href={`tel:${company.phone}`}
                className="flex items-center justify-center gap-2 mt-6 text-sm font-medium"
                style={{ color: brandColor }}
              >
                <Phone className="w-4 h-4" />
                {company.phone}
              </a>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="px-4 py-6 text-center text-white" style={{ background: brandColor }}>
        <h1 className="text-2xl font-bold">{company.company_name || 'Schedule Your Walkthrough'}</h1>
        <p className="text-white/85 text-sm mt-1">Free on-site walkthrough &amp; estimate</p>
      </div>

      <div className="max-w-lg mx-auto px-4 py-6">
        {/* Lead info banner */}
        {lead.full_name && (
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 mb-5 flex items-start gap-3">
            <Calendar className="w-5 h-5 mt-0.5 flex-shrink-0" style={{ color: brandColor }} />
            <div>
              <p className="text-sm font-semibold text-gray-800">Hi {lead.full_name?.split(' ')[0]}! Pick a time that works for you.</p>
              {lead.project_type && <p className="text-xs text-gray-500 mt-0.5">{lead.project_type} · {lead.address || 'Your property'}</p>}
            </div>
          </div>
        )}

        {dates.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-8 text-center">
            <Clock className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-600 font-medium">No available times right now</p>
            <p className="text-gray-400 text-sm mt-1">Please call us to schedule directly.</p>
            {company.phone && (
              <a href={`tel:${company.phone}`} className="inline-flex items-center gap-2 mt-4 text-sm font-semibold" style={{ color: brandColor }}>
                <Phone className="w-4 h-4" /> {company.phone}
              </a>
            )}
          </div>
        ) : (
          <>
            {/* Date navigator */}
            <div className="flex items-center justify-between mb-3">
              <button
                onClick={() => setActiveDateIndex(i => Math.max(0, i - 1))}
                disabled={activeDateIndex === 0}
                className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-30 transition"
              >
                <ChevronLeft className="w-5 h-5 text-gray-600" />
              </button>
              <h2 className="text-base font-bold text-gray-800">{activeDate}</h2>
              <button
                onClick={() => setActiveDateIndex(i => Math.min(dates.length - 1, i + 1))}
                disabled={activeDateIndex === dates.length - 1}
                className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-30 transition"
              >
                <ChevronRight className="w-5 h-5 text-gray-600" />
              </button>
            </div>

            {/* Date pills */}
            <div className="flex gap-2 overflow-x-auto pb-2 mb-4 scrollbar-hide">
              {dates.map((date, i) => (
                <button
                  key={date}
                  onClick={() => { setActiveDateIndex(i); setSelectedSlot(null); }}
                  className="flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold border transition"
                  style={i === activeDateIndex
                    ? { background: brandColor, color: '#fff', borderColor: brandColor }
                    : { background: '#fff', color: '#555', borderColor: '#e5e5e5' }
                  }
                >
                  {date.split(',')[0]}, {date.split(',')[1]?.trim()}
                </button>
              ))}
            </div>

            {/* Time slots grid */}
            <div className="grid grid-cols-2 gap-2 mb-6">
              {(groupedSlots[activeDate] || []).map(slot => {
                const isSelected = selectedSlot?.start === slot.start;
                return (
                  <button
                    key={slot.start}
                    onClick={() => setSelectedSlot(isSelected ? null : slot)}
                    className="flex items-center justify-center gap-2 py-3 px-4 rounded-xl border text-sm font-medium transition"
                    style={isSelected
                      ? { background: brandColor, color: '#fff', borderColor: brandColor, boxShadow: `0 0 0 3px ${brandColor}33` }
                      : { background: '#fff', color: '#333', borderColor: '#e5e5e5' }
                    }
                  >
                    <Clock className="w-4 h-4" />
                    {slot.time}
                  </button>
                );
              })}
            </div>

            {/* Confirm CTA */}
            <div className="sticky bottom-4">
              <Button
                onClick={confirmSlot}
                disabled={!selectedSlot || state === 'confirming'}
                className="w-full h-12 text-base font-semibold rounded-xl shadow-lg"
                style={{ background: selectedSlot ? brandColor : undefined }}
              >
                {state === 'confirming' ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Confirming…</>
                ) : selectedSlot ? (
                  <>Confirm {selectedSlot.time} on {activeDate}</>
                ) : (
                  'Select a time above'
                )}
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}