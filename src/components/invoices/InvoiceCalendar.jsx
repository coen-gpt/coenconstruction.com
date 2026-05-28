import { useState, useMemo } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { format, addMonths, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth } from "date-fns";

export default function InvoiceCalendar({ records = [], onSelectDay }) {
  const [currentMonth, setCurrentMonth] = useState(new Date());

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });

  // Group invoices by scheduled_payment_date or due_date
  const invoicesByDate = useMemo(() => {
    const map = {};
    records.forEach(r => {
      const dateStr = r.scheduled_payment_date || r.due_date;
      if (dateStr) {
        if (!map[dateStr]) map[dateStr] = [];
        map[dateStr].push(r);
      }
    });
    return map;
  }, [records]);

  const getDayInvoices = (day) => {
    const dateStr = format(day, 'yyyy-MM-dd');
    return invoicesByDate[dateStr] || [];
  };

  const getDayTotal = (day) => {
    const invoices = getDayInvoices(day);
    return invoices.reduce((sum, inv) => sum + (inv.amount || 0), 0);
  };

  const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const weeks = [];
  let week = [];

  daysInMonth.forEach(day => {
    if (week.length === 7) {
      weeks.push(week);
      week = [];
    }
    week.push(day);
  });
  if (week.length > 0) weeks.push(week);

  const getDayStatus = (day) => {
    const invoices = getDayInvoices(day);
    if (invoices.length === 0) return null;
    
    const statuses = invoices.map(i => i.status);
    if (statuses.includes('pending_review')) return 'pending';
    if (statuses.includes('approved')) return 'approved';
    if (statuses.includes('paid')) return 'paid';
    return 'other';
  };

  const statusColors = {
    pending: 'bg-yellow-50 border-yellow-200',
    approved: 'bg-green-50 border-green-200',
    paid: 'bg-blue-50 border-blue-200',
    other: 'bg-gray-50 border-gray-200'
  };

  const statusDotColors = {
    pending: 'bg-yellow-500',
    approved: 'bg-green-500',
    paid: 'bg-blue-500',
    other: 'bg-gray-400'
  };

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="font-bold text-lg text-gray-900">{format(currentMonth, 'MMMM yyyy')}</h2>
        <div className="flex gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => setCurrentMonth(addMonths(currentMonth, -1))}
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Week day headers */}
      <div className="grid grid-cols-7 gap-1 mb-2">
        {weekDays.map(day => (
          <div key={day} className="text-center text-xs font-semibold text-gray-500 py-2">
            {day}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-1">
        {weeks.map((week, weekIdx) =>
          week.map((day, dayIdx) => {
            const dayInvoices = getDayInvoices(day);
            const status = getDayStatus(day);
            const total = getDayTotal(day);
            const isCurrentMonth = isSameMonth(day, currentMonth);

            return (
              <div
                key={`${weekIdx}-${dayIdx}`}
                onClick={() => dayInvoices.length > 0 && onSelectDay(day)}
                className={`min-h-20 p-1.5 border rounded text-xs cursor-pointer transition-colors ${
                  isCurrentMonth
                    ? status
                      ? statusColors[status]
                      : 'bg-white border-gray-200 hover:bg-gray-50'
                    : 'bg-gray-100 border-gray-100'
                }`}
              >
                <div className={`font-semibold ${isCurrentMonth ? 'text-gray-900' : 'text-gray-400'}`}>
                  {format(day, 'd')}
                </div>

                {dayInvoices.length > 0 && (
                  <div className="mt-1 space-y-0.5">
                    <div className="flex items-center gap-1">
                      <div className={`w-1.5 h-1.5 rounded-full ${statusDotColors[status]}`} />
                      <span className="font-medium text-gray-700">{dayInvoices.length}</span>
                    </div>
                    {total > 0 && (
                      <div className="text-gray-600">
                        ${(total / 1000).toFixed(1)}k
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Legend */}
      <div className="mt-4 flex flex-wrap gap-3 text-xs">
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-yellow-500" />
          <span className="text-gray-600">Pending</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-green-500" />
          <span className="text-gray-600">Approved</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-blue-500" />
          <span className="text-gray-600">Paid</span>
        </div>
      </div>
    </div>
  );
}