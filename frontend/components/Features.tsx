import { Truck, RotateCcw, Star } from "lucide-react";

const items = [
  {
    icon: Truck,
    title: "Fast Shipping",
    description: "Quickly and securely delivered to your door.",
  },
  {
    icon: RotateCcw,
    title: "30-Day Money Back",
    description: "Not the right fit? No problem. 30-day money back guarantee.",
  },
  {
    icon: Star,
    title: "Premium Quality",
    description: "Carefully crafted gear developed with veterinarians and anatomy specialists.",
  },
];

export default function Features() {
  return (
    <section className="py-24 bg-white border-b border-zinc-50">
      <div className="container mx-auto px-4 md:px-8 max-w-6xl">
        <div className="flex flex-col items-center mb-16">
          <h2 className="text-center text-[13px] font-bold uppercase tracking-[0.4em] text-primary">
            Why Choose PetPosture
          </h2>
          <div className="w-12 h-[2px] bg-secondary mt-3" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-12 md:gap-1">
          {items.map(({ icon: Icon, title, description }, i) => (
            <div 
              key={i} 
              className={`flex flex-col items-center text-center px-10 gap-5 ${
                i !== items.length - 1 ? "md:border-r border-zinc-100" : ""
              }`}
            >
              <div className="flex items-center justify-center">
                <Icon size={28} strokeWidth={1.5} className="text-primary/70" aria-hidden="true" />
              </div>
              <div>
                <h3 className="text-[11px] font-black uppercase tracking-[0.2em] text-primary mb-3">{title}</h3>
                <p className="text-[11px] text-primary/50 max-w-[200px] leading-relaxed font-medium">{description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
