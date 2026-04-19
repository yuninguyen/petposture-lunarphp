import { Globe, Star, RotateCcw } from "lucide-react";

const badges = [
  { icon: Globe, title: "Free Delivery", subtitle: "World Wide*", link: "/shipping" },
  { icon: Star, title: "Loved by Customers", subtitle: "5,000+ Reviews" },
  { icon: RotateCcw, title: "Free Returns", subtitle: "& Free Shipping" },
];

export default function TrustBadges() {
  return (
    <div className="bg-[#f1f1f1] border-y border-zinc-200">
      <div className="container mx-auto px-4 md:px-8">
        <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-zinc-300">
          {badges.map(({ icon: Icon, title, subtitle, link }, i) => (
            <div key={i} className="flex items-center gap-3 px-6 py-4 justify-center">
              <Icon size={18} className="text-primary shrink-0" aria-hidden="true" />
              <p className="text-[11px] text-primary leading-tight">
                <strong className="font-bold">{title}</strong>{" "}
                <span className="opacity-75">{subtitle}</span>
                {link && (
                  <>
                    {" "}
                    <a href={link} className="underline opacity-60 hover:opacity-100 transition-opacity text-[10px]">
                      Learn more
                    </a>
                  </>
                )}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
