import Image from "next/image";
import Link from "next/link";
import { Check, X } from "lucide-react";

export default function Comparison() {
  return (
    <section className="py-20 px-4 md:px-8 bg-white overflow-hidden">
      <div className="container mx-auto max-w-5xl">
        <div className="text-center mb-12">
          <p className="text-[11px] font-bold uppercase tracking-[0.3em] text-secondary mb-3">
            Mealtime Difference
          </p>
          <h2 className="text-2xl md:text-3xl font-bold uppercase tracking-tight text-primary leading-tight max-w-2xl mx-auto">
            PetPosture: The Mealtime Difference
          </h2>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16 items-start">
          {/* Wrong Way */}
          <div className="flex flex-col">
            <div className="relative border-2 border-red-500/10 rounded-lg p-2 bg-zinc-50 mb-8">
              <div className="absolute top-2 left-2 z-10 flex items-center gap-2 bg-red-500 text-white px-2 py-1 rounded-sm">
                <X size={14} strokeWidth={3} />
                <span className="text-[10px] font-black uppercase tracking-widest">WRONG - STRAINING POSTURE</span>
              </div>
              <div className="relative aspect-[4/3] w-full bg-white rounded-md overflow-hidden">
                <Image
                  src="/assets/comparison.jpg"
                  alt="Dog with straining posture"
                  fill
                  className="object-cover opacity-90"
                />
              </div>
            </div>

            <div className="px-4">
              <h4 className="flex items-center gap-2 text-red-500 font-bold uppercase tracking-widest text-[11px] mb-4">
                <X size={14} strokeWidth={3} /> Standard Pet Bowls
              </h4>
              <ul className="space-y-3">
                {[
                  "Causes Spinal and Neck Strain Over Time",
                  "Restricts Airways During Digestion",
                  "Increases Risk of Bloat and Gulping",
                  "Increases Pressure on Front and Shoulder Joints",
                ].map((item, i) => (
                  <li key={i} className="flex gap-2 text-[12px] text-primary/60 leading-relaxed group">
                    <span className="text-red-300 group-hover:text-red-500 transition-colors shrink-0">•</span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Correct Way */}
          <div className="flex flex-col">
            <div className="relative border-2 border-green-500/10 rounded-lg p-2 bg-zinc-50 mb-8">
              <div className="absolute top-2 left-2 z-10 flex items-center gap-2 bg-green-500 text-white px-2 py-1 rounded-sm">
                <Check size={14} strokeWidth={3} />
                <span className="text-[10px] font-black uppercase tracking-widest">CORRECT - ERGONOMIC POSTURE</span>
              </div>
              <div className="relative aspect-[4/3] w-full bg-white rounded-md overflow-hidden">
                <Image
                  src="/assets/badposture-goodposture.jpg"
                  alt="Dog with correct posture"
                  fill
                  className="object-cover"
                />
              </div>
            </div>

            <div className="px-4">
              <h4 className="flex items-center gap-2 text-green-500 font-bold uppercase tracking-widest text-[11px] mb-4">
                <Check size={14} strokeWidth={3} /> PetPosture Solutions
              </h4>
              <ul className="space-y-3">
                {[
                  "Eliminates Neck and Spinal Compression",
                  "Facilitates Natural Digestion and Breathing",
                  "Optimized Entry Angle for Better Swallowing",
                  "Balanced Distribution of Weight Across Joints",
                ].map((item, i) => (
                  <li key={i} className="flex gap-2 text-[12px] text-primary/60 leading-relaxed group">
                    <span className="text-green-300 group-hover:text-green-500 transition-colors shrink-0">•</span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        <div className="mt-20 text-center">
          <Link
            href="/shop"
            className="inline-block bg-secondary hover:bg-secondary/90 text-white px-10 py-4 text-[12px] font-black uppercase tracking-[0.2em] transition-all hover:shadow-xl hover:-translate-y-1 active:scale-95"
          >
            Protect Your Pet&apos;s Spine
          </Link>
        </div>
      </div>
    </section>
  );
}
