import Image from "next/image";
import Link from "next/link";

const posts = [
  {
    title: "Why Does My Pug Reverse Sneeze After Eating? (And 3 Easy Fixes)",
    excerpt: "Many owners overlook the mechanical strain of standard bowls on brachycephalic breeds.",
    image: "/assets/Flat-Faced-Breeds.png",
    category: "Pet Health",
    href: "/insights/pug-reverse-sneeze",
  },
  {
    title: "The French Bulldog Spine: A Guide to Optimal Posture",
    excerpt: "The unique spinal curve of Frenchies requires targeted postural support from day one.",
    image: "/assets/French-Bulldog.png",
    category: "Insights",
    href: "/insights/french-bulldog-posture",
  },
  {
    title: "Morning Stiffness In Your Pet: How To Help",
    excerpt: "Large breeds like Great Danes face unique digestive risks. Learn why height is critical.",
    image: "/assets/Corgi.png",
    category: "Pet Life",
    href: "/insights/bowl-height-large-breeds",
  },
];

export default function Insights() {
  return (
    <section className="py-24 px-4 md:px-8 bg-white overflow-hidden">
      <div className="container mx-auto max-w-6xl">
        <div className="flex flex-col items-center mb-16">
          <h2 className="text-center text-[13px] font-bold uppercase tracking-[0.4em] text-primary">
            Insights
          </h2>
          <div className="w-12 h-[2px] bg-secondary mt-3" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
          {posts.map(({ title, excerpt, image, category, href }, i) => (
            <Link key={i} href={href} className="group flex flex-col items-center text-center">
              <div className="relative w-full overflow-hidden bg-zinc-100 mb-8 aspect-[1.15/1]">
                <Image
                  src={image}
                  alt={title}
                  fill
                  className="object-cover transition-transform duration-1000 group-hover:scale-110"
                  sizes="(max-width: 768px) 100vw, 33vw"
                  loading="lazy"
                />
              </div>
              
              <span className="text-[10px] font-black uppercase tracking-[0.15em] text-primary/30 mb-4 group-hover:text-secondary transition-colors">
                {category}
              </span>
              
              <h3 className="text-[14px] font-black uppercase tracking-[0.05em] text-primary px-4 mb-4 leading-relaxed group-hover:text-secondary transition-colors line-clamp-2">
                {title}
              </h3>
              
              <div className="w-8 h-[1px] bg-secondary/30 mb-4 group-hover:w-16 transition-all duration-500" />
              
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-primary/60 hover:text-secondary transition-colors border-b border-primary/10 group-hover:border-secondary pb-1">
                Read More
              </span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
