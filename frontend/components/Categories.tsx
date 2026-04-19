import Image from "next/image";
import Link from "next/link";

const categories = [
  {
    title: "Shop By Breeds",
    description: "Pick anatomy-matching gear specifically for your furry friend.",
    image: "/assets/Shop-by-Breed.jpg",
    links: [
      { label: "Shop By Breed", href: "/shop-by-breed" },
      { label: "Find Your Breed", href: "/find-your-breed" },
    ],
  },
  {
    title: "Shop By Solutions",
    description: "Find the right solutions for your pet's postural and health needs.",
    image: "/assets/shop-by-solutions.jpg",
    links: [
      { label: "Raised Bowls", href: "/raised-bowls" },
      { label: "Orthopedic Beds", href: "/shop" },
      { label: "Slow Feeders", href: "/shop" },
    ],
  },
];

export default function Categories() {
  return (
    <section className="py-20 px-4 md:px-8 bg-white border-b border-zinc-50">
      <div className="container mx-auto max-w-6xl">
        <div className="flex flex-col items-center mb-12">
          <h2 className="text-center text-[13px] font-bold uppercase tracking-[0.4em] text-primary">
            Shop What You Need
          </h2>
          <div className="w-12 h-[2px] bg-secondary mt-3" />
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {categories.map((cat, idx) => (
            <div key={idx} className="relative group overflow-hidden shadow-sm" style={{ height: "320px" }}>
              <Image
                src={cat.image}
                alt={cat.title}
                fill
                className="object-cover grayscale-[0.2] transition-transform duration-1000 group-hover:scale-110 group-hover:grayscale-0"
                sizes="(max-width: 768px) 100vw, 50vw"
              />
              {/* Refined gradient overlay */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent opacity-80 group-hover:opacity-90 transition-opacity duration-500" />

              {/* Content */}
              <div className="absolute inset-x-0 bottom-0 flex flex-col items-center p-8 text-white text-center">
                <h3 className="text-[20px] font-bold uppercase tracking-[0.1em] mb-2">{cat.title}</h3>
                <p className="text-[11px] mb-6 opacity-80 max-w-xs font-medium leading-relaxed">{cat.description}</p>
                <div className="flex flex-wrap justify-center gap-3">
                  {cat.links.map(({ label, href }, li) => (
                    <Link
                      key={li}
                      href={href}
                      className="bg-secondary hover:bg-white hover:text-primary text-white px-5 py-2.5 text-[9px] font-black uppercase tracking-[0.2em] transition-all"
                    >
                      {label}
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
