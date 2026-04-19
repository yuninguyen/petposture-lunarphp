import Image from "next/image";
import Link from "next/link";
import { Star } from "lucide-react";

const products = [
  {
    id: 1,
    name: "PetPosture: The Mealtime Difference Bowl",
    price: "$59.99",
    oldPrice: "$85.00",
    rating: 5,
    image: "/assets/Dog-Bowls-5.png",
    badge: "SALE",
  },
  {
    id: 2,
    name: "Corgi Ergonomic Feeding Stand",
    price: "$49.99",
    oldPrice: "$69.99",
    rating: 5,
    image: "/assets/Corgi.png",
    badge: "SALE",
  },
  {
    id: 3,
    name: "Frenchie Posture Support Bowl",
    price: "$45.00",
    oldPrice: null,
    rating: 4,
    image: "/assets/Flat-Faced-Breeds.png",
    badge: "BEST SELLER",
  },
  {
    id: 4,
    name: "Raised Bowl for Large Breeds",
    price: "$79.99",
    oldPrice: "$99.99",
    rating: 5,
    image: "/assets/Pug-Dog-Bed.jpg",
    badge: "SALE",
  },
];

export default function ProductGrid() {
  return (
    <section className="py-24 px-4 md:px-8 bg-white border-b border-zinc-50">
      <div className="container mx-auto max-w-6xl">
        <div className="flex flex-col items-center mb-16">
          <h2 className="text-center text-[13px] font-bold uppercase tracking-[0.4em] text-primary">
            Our Best Sellers
          </h2>
          <div className="w-12 h-[2px] bg-secondary mt-3" />
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-8">
          {products.map((p) => (
            <div key={p.id} className="group cursor-pointer flex flex-col items-center text-center">
              {/* Image Container */}
              <div className="relative w-full bg-zinc-50 overflow-hidden mb-6 aspect-[4/5] rounded-sm group-hover:shadow-lg transition-all duration-500">
                <Image
                  src={p.image}
                  alt={p.name}
                  fill
                  className="object-cover transition-transform duration-1000 group-hover:scale-110"
                  sizes="(max-width: 640px) 50vw, 25vw"
                  loading="lazy"
                />
                {p.badge && (
                  <span className="absolute top-4 left-4 bg-secondary text-white text-[9px] font-black py-1 px-3 uppercase tracking-wider shadow-sm">
                    {p.badge}
                  </span>
                )}
                {/* Cart Icon / Action Overlay */}
                <div className="absolute inset-x-0 bottom-0 p-4 translate-y-full group-hover:translate-y-0 transition-transform duration-500">
                  <button className="w-full bg-primary hover:bg-secondary text-white text-[10px] font-black py-4 uppercase tracking-[0.2em] transition-all shadow-xl active:scale-95">
                    Select Options
                  </button>
                </div>
              </div>

              {/* Info */}
              <div className="px-2">
                <div className="flex justify-center gap-0.5 mb-3 opacity-60 group-hover:opacity-100 transition-opacity">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star
                      key={i}
                      size={9}
                      fill={i < p.rating ? "currentColor" : "none"}
                      className={i < p.rating ? "text-secondary" : "text-zinc-300"}
                      aria-hidden="true"
                    />
                  ))}
                </div>
                <h3 className="text-[12px] font-bold uppercase tracking-[0.05em] text-primary mb-3 leading-tight group-hover:text-secondary transition-colors">
                  {p.name}
                </h3>
                <div className="flex items-center justify-center gap-2">
                  <span className="text-[13px] font-black text-secondary">{p.price}</span>
                  {p.oldPrice && (
                    <span className="text-[11px] text-zinc-300 line-through font-medium">{p.oldPrice}</span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-20 text-center">
          <Link
            href="/shop"
            className="text-[10px] font-black uppercase tracking-[0.3em] text-primary border-b-2 border-secondary/20 hover:border-secondary pb-1 transition-all"
          >
            View All Best Sellers
          </Link>
        </div>
      </div>
    </section>
  );
}
