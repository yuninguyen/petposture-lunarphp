"use client";

import { useState } from "react";
import Link from "next/link";
import { Facebook, Instagram, Twitter, Mail, Plus, Minus } from "lucide-react";
import PaymentIcons from "./PaymentIcons";

const shopBySolution = [
  "Eating & Digestion",
  "Mobility & Support",
  "Comfort & Safety",
  "All Products",
];
const shopByBreed = ["Flat-Faced Breeds", "Long-Backed Breeds"];
const customerService = [
  "Contact Us",
  "Shipping Policy",
  "Return & Refund Policy",
  "FAQs",
  "Track Your Order",
];
const legalLinks = [
  "Privacy Policy",
  "Terms and Conditions",
  "Cookie Policy",
  "Acceptable Use Policy",
];

type FooterSectionProps = {
  title: string;
  id: string;
  isOpen: boolean;
  onToggle: (section: string) => void;
  items?: string[];
  isCustomContent?: React.ReactNode;
};

const getLegalHref = (link: string) => {
  switch (link) {
    case "Privacy Policy": return "/privacy-policy";
    case "Terms and Conditions": return "/terms-and-conditions";
    case "Cookie Policy": return "/cookie-policy";
    case "Acceptable Use Policy": return "/acceptable-use-policy";
    default: return "#";
  }
};

function FooterSection({ title, items, id, isOpen, onToggle, isCustomContent }: FooterSectionProps) {
  return (
    <div className="border-b lg:border-none border-white/5 py-4 lg:py-0">
      <button
        onClick={() => onToggle(id)}
        className="flex items-center justify-between w-full lg:mb-4 group text-left"
      >
        <div>
          <h4 className="font-bold text-[16px] uppercase tracking-[0.15em] text-white inline-block">
            {title}
          </h4>
          <div className="hidden lg:block w-8 h-[2px] bg-[#df8448] mt-3" />
        </div>
        <div className="lg:hidden text-white/40 group-hover:text-white transition-colors">
          {isOpen ? <Minus size={18} /> : <Plus size={18} />}
        </div>
      </button>

      <div className={`
        overflow-hidden lg:overflow-visible transition-all duration-300 ease-in-out lg:max-h-none lg:opacity-100 lg:mt-0
        ${isOpen ? 'max-h-[500px] opacity-100 mt-4' : 'max-h-0 opacity-0'}
      `}>
        {isCustomContent ? (
          isCustomContent
        ) : (
          <ul className="space-y-3 pb-2 lg:pb-0">
            {items?.map((item) => (
              <li key={item}>
                <Link
                  href={
                    item === "Contact Us" ? "/contact" :
                      item === "Shipping Policy" ? "/shipping-policy" :
                        item === "Return & Refund Policy" ? "/return-refund-policy" :
                          item === "FAQs" ? "/faqs" :
                            item === "Track Your Order" ? "/track-order" :
                              item === "Eating & Digestion" ? "/shop?category=Bowls" :
                                item === "Mobility & Support" ? "/shop?category=Ramps" :
                                  item === "Comfort & Safety" ? "/shop?category=Beds" :
                                    item === "All Products" ? "/shop" :
                                      item === "Flat-Faced Breeds" ? "/shop?category=Bowls" :
                                        item === "Long-Backed Breeds" ? "/shop?category=Ramps" : "#"
                  }
                  className="text-[16px] text-white/60 hover:text-[#df8448] transition-colors flex items-center gap-2 group"
                >
                  <span className="w-0 h-[1px] bg-[#df8448] transition-all group-hover:w-3" />
                  {item}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

export default function Footer() {
  const [openSection, setOpenSection] = useState<string | null>(null);

  const toggleSection = (section: string) => {
    setOpenSection(openSection === section ? null : section);
  };

  return (
    <footer className="bg-primary text-white font-hanken">
      {/* Main Footer */}
      <div className="py-10 md:py-10 px-4 md:px-8 border-t border-white/5">
        <div className="max-w-[1200px] w-full mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 lg:gap-8">
            {/* About Section */}
            <FooterSection
              title="About PetPosture"
              id="about"
              isOpen={openSection === "about"}
              onToggle={toggleSection}
              isCustomContent={
                <div className="pb-4 lg:pb-0">
                  <p className="text-[16px] text-white/60 leading-[1.75] mb-6 max-w-sm">
                    At PetPosture, we believe pets deserve comfort built for them.
                    We provide ergonomic essentials designed to support your pet&apos;s
                    unique posture and improve their health.
                  </p>
                  <div className="flex gap-4">
                    {[
                      { Icon: Facebook, label: "Facebook" },
                      { Icon: Instagram, label: "Instagram" },
                      { Icon: Twitter, label: "Twitter" },
                      { Icon: Mail, label: "Email" },
                    ].map(({ Icon, label }) => (
                      <Link
                        key={label}
                        href="#"
                        aria-label={label}
                        className="w-11 h-11 rounded-full border border-white/10 flex items-center justify-center text-white/60 hover:text-white hover:bg-white/10 hover:border-white/10 transition-all duration-300 group"
                      >
                        <Icon size={18} strokeWidth={2} className="transition-transform duration-300 group-hover:scale-125" />
                      </Link>
                    ))}
                  </div>
                </div>
              }
            />

            {/* Shop sections with accordion on mobile */}
            <FooterSection title="Shop by Solution" items={shopBySolution} id="solution" isOpen={openSection === "solution"} onToggle={toggleSection} />
            <FooterSection title="Shop by Breed" items={shopByBreed} id="breed" isOpen={openSection === "breed"} onToggle={toggleSection} />
            <FooterSection title="Customer Service" items={customerService} id="service" isOpen={openSection === "service"} onToggle={toggleSection} />
          </div>
        </div>
      </div>

      {/* Bottom Bar */}
      <div className="bg-black/10 py-5 px-4 md:px-8">
        <div className="max-w-[1200px] w-full mx-auto">
          <div className="flex flex-col lg:flex-row items-center lg:justify-between text-center lg:text-left gap-8 lg:gap-10">
            {/* Links and Copyright Column */}
            <div className="flex flex-col items-center lg:items-start w-full lg:w-auto">
              <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-y-4 gap-x-6 mb-[10px]">
                {/* Mobile Group 1 */}
                <div className="flex items-center gap-6">
                  {legalLinks.slice(0, 2).map((link) => (
                    <Link
                      key={link}
                      href={getLegalHref(link)}
                      className="text-[12px] uppercase tracking-[0.08em] text-white/50 hover:text-[#df8448] transition-colors whitespace-nowrap"
                    >
                      {link}
                    </Link>
                  ))}
                </div>
                {/* Mobile Group 2 */}
                <div className="flex items-center gap-6">
                  {legalLinks.slice(2).map((link) => (
                    <Link
                      key={link}
                      href={getLegalHref(link)}
                      className="text-[12px] uppercase tracking-[0.08em] text-white/50 hover:text-[#df8448] transition-colors whitespace-nowrap"
                    >
                      {link}
                    </Link>
                  ))}
                </div>
              </div>

              <div className="pt-[10px] border-t border-white/10 w-full">
                <p className="text-[13px] text-white/50 font-normal tracking-wide">
                  Copyright {new Date().getFullYear()} © <span className="text-white/60 font-bold">PetPosture</span>. All rights reserved.
                </p>
              </div>
            </div>

            {/* Payment Icons & Back to Top */}
            <div className="flex flex-col lg:flex-row items-center gap-8 lg:gap-10 w-full lg:w-auto">
              <PaymentIcons />

              <button
                onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                className="w-11 h-11 bg-white/5 border border-white/10 flex items-center justify-center rounded-lg transition-all group shadow-xl"
                aria-label="Back to top"
              >
                <span className="border-t-2 border-l-2 border-white/40 w-2.5 h-2.5 rotate-45 group-hover:border-white transition-colors relative top-0.5" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
