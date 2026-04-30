import { useState, useEffect } from "react";
import { Star, ChevronLeft, ChevronRight } from "lucide-react";

const reviews = [
  { name: "Mary H.", location: "South Boston, MA", text: "Our experience with Coen Construction was exceptional. Scott reviewed the project requirements and provided a detailed proposal. Completed promptly and professionally. Highly recommend!", rating: 5 },
  { name: "Glenroy G.", location: "Medford, MA", text: "My rear porch needed structural and cosmetic improvements. His crew showed up early. Whenever an issue arose, it was resolved without impacting the budget. They do quality work in a timely manner.", rating: 5 },
  { name: "Rose L.", location: "Somerville, MA", text: "They are all pleasant and made the process easy for us. They are able to do all the work and I would highly recommend Coen Construction!", rating: 5 },
  { name: "Jeffrey R.", location: "Chelsea, MA", text: "It was beautiful. They went far beyond what we expected. What they did was incredible — a huge project. They said they would do it and they did it. They were great.", rating: 5 },
];

export default function ReviewCarousel() {
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrent(i => (i + 1) % reviews.length);
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  const prev = () => setCurrent(i => (i - 1 + reviews.length) % reviews.length);
  const next = () => setCurrent(i => (i + 1) % reviews.length);

  const review = reviews[current];

  return (
    <div className="bg-white border border-gray-100 rounded-xl p-5 shadow-sm">
      <h3 className="font-bold text-secondary text-sm mb-3">Customer Reviews</h3>
      <div className="flex gap-0.5 mb-3">
        {[...Array(review.rating)].map((_, i) => (
          <Star key={i} className="w-4 h-4 fill-yellow-400 text-yellow-400" />
        ))}
      </div>
      <p className="text-gray-600 text-sm leading-relaxed italic mb-4 min-h-[72px]">"{review.text}"</p>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center text-white font-bold text-xs">
            {review.name[0]}
          </div>
          <div>
            <div className="font-semibold text-secondary text-xs">{review.name}</div>
            <div className="text-gray-400 text-xs">{review.location}</div>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={prev} className="w-7 h-7 rounded-full border border-gray-200 flex items-center justify-center hover:border-primary hover:text-primary transition-colors">
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>
          <button onClick={next} className="w-7 h-7 rounded-full border border-gray-200 flex items-center justify-center hover:border-primary hover:text-primary transition-colors">
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
      <div className="flex gap-1 justify-center mt-3">
        {reviews.map((_, i) => (
          <button key={i} onClick={() => setCurrent(i)} className={`w-1.5 h-1.5 rounded-full transition-colors ${i === current ? "bg-primary" : "bg-gray-200"}`} />
        ))}
      </div>
    </div>
  );
}