"use client";

import { Star } from "lucide-react";

const reviews = [
  {
    title: "THE PERFECT PUG BOWL!",
    text: "The beechwood bowl was a complete game-changer for my Pug's digestion. He's not hunching anymore!",
    author: "Sarah J.",
    rating: 5,
    tag: "Pugs",
  },
  {
    title: "A LIFESAVER FOR MY FRENCHIE!",
    text: "My Lab no longer stoops painfully at his bowl. His joint health has visibly improved after just 2 weeks.",
    author: "Mike R.",
    rating: 5,
    tag: "Frenchies",
  },
  {
    title: "MORNING STIFFNESS IS GONE!",
    text: "Beautiful design and perfect height. Finally, something actually built for my Corgi's short legs!",
    author: "Elena G.",
    rating: 5,
    tag: "Corgis",
  },
];

export default function Testimonials() {
  return (
    <section className="py-24 px-4 md:px-8 bg-white border-b border-zinc-50">
      <div className="container mx-auto max-w-6xl">
        <div className="flex flex-col items-center mb-16">
          <h2 className="text-center text-[13px] font-bold uppercase tracking-[0.4em] text-primary">
            Happy Pets, Better Posture
          </h2>
          <div className="w-12 h-[2px] bg-secondary mt-3" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {reviews.map(({ title, text, author, rating, tag }, i) => (
            <div key={i} className="flex flex-col p-8 border border-zinc-100 hover:shadow-xl hover:border-secondary/20 transition-all duration-500 group">
              <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-secondary mb-6">{tag}</span>
              
              <h4 className="text-[13px] font-black uppercase tracking-[0.1em] text-primary mb-4 leading-tight group-hover:text-secondary transition-colors">
                {title}
              </h4>
              
              <p className="text-[12px] text-primary/60 leading-relaxed mb-10 flex-1">
                &ldquo;{text}&rdquo;
              </p>

              <div className="flex items-center justify-between border-t border-zinc-50 pt-6">
                <span className="text-[10px] font-black uppercase tracking-widest text-primary/40">—  {author}</span>
                <div className="flex gap-0.5">
                  {Array.from({ length: rating }).map((_, si) => (
                    <Star key={si} size={9} fill="currentColor" className="text-secondary" aria-hidden="true" />
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
