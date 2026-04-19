import Image from "next/image";
import Link from "next/link";

const banners = [
  {
    image: "/assets/Flat-Faced-Breeds.png",
    title: "For Flat Faced Breeds",
    href: "/shop-by-breed",
  },
  {
    image: "/assets/Corgi.png",
    title: "For Long Backed Breeds",
    href: "/shop-by-breed",
  },
];

export default function PromoBanners() {
  return (
    <section className="py-12 px-4 md:px-8 bg-white overflow-hidden">
      <div className="container mx-auto max-w-6xl">
        <div className="grid md:grid-cols-2 gap-8">
          {banners.map(({ image, title, href }, i) => (
            <div key={i} className="relative group overflow-hidden" style={{ height: "380px" }}>
              <Image
                src={image}
                alt={title}
                fill
                className="object-cover transition-transform duration-1000 group-hover:scale-105"
                sizes="(max-width: 768px) 100vw, 50vw"
                loading="lazy"
              />
              {/* Subtle dark gradient */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-transparent opacity-40 group-hover:opacity-60 transition-opacity" />
              
              <div className="absolute inset-0 flex flex-col items-center justify-center p-8 text-white text-center">
                <h3 className="text-[22px] md:text-[26px] font-bold uppercase tracking-[0.1em] mb-6 drop-shadow-lg">{title}</h3>
                <Link
                  href={href}
                  className="inline-block bg-secondary hover:bg-white hover:text-primary text-white text-[10px] font-black uppercase tracking-[0.25em] px-8 py-3.5 transition-all shadow-md active:scale-95"
                >
                  Shop Now
                </Link>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
