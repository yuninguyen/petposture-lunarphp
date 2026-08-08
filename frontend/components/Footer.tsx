"use client";

import { useState } from "react";
import Link from "next/link";
import { Facebook, Instagram, Twitter, Youtube, Mail, Plus, Minus } from "lucide-react";
import PaymentIcons from "./PaymentIcons";
import { useSettings } from "@/context/SettingsContext";
import { TikTokIcon, PinterestIcon } from "@/lib/socialIcons";

const shopBySolution = [
  "Eating & Digestion",
  "Mobility & Support",
  "Comfort & Safety",
];
const shopByBreed = ["Flat-Faced Breeds", "Long-Backed Breeds"];
const customerService = [
  "Contact Us",
  "Shipping Policy",
  "Return & Refund Policy",
  "FAQs",
  "Track Your Order",
  "Request a Return",
];
const legalLinks = [
  "Privacy Policy",
  "Terms and Conditions",
  "Cookie Policy",
  "Acceptable Use Policy",
  "Affiliate Disclosure",
  "Do Not Sell My Personal Information",
];
const bottomBarLegalLinks = [
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
  wrapperClassName?: string;
};

const getLegalHref = (link: string) => {
  switch (link) {
    case "Privacy Policy": return "/privacy-policy";
    case "Terms and Conditions": return "/terms-and-conditions";
    case "Cookie Policy": return "/cookie-policy";
    case "Acceptable Use Policy": return "/acceptable-use-policy";
    case "Affiliate Disclosure": return "/affiliate-disclosure";
    case "Do Not Sell My Personal Information": return "/privacy-policy#us-state-rights";
    default: return "#";
  }
};

const getShopHref = (item: string) => {
  switch (item) {
    case "Eating & Digestion": return "/shop/solutions/eating-digestion";
    case "Mobility & Support": return "/shop/solutions/mobility-support";
    case "Comfort & Safety": return "/shop/solutions/comfort-safety";
    case "Flat-Faced Breeds": return "/shop/breeds/flat-faced";
    case "Long-Backed Breeds": return "/shop/breeds/long-backed";
    default: return "#";
  }
};

function ShopLinkGroup({ heading, items }: { heading: string; items: string[] }) {
  return (
    <div>
      <h4 className="text-[12px] font-bold uppercase tracking-[0.15em] text-white/40 mb-3">
        {heading}
      </h4>
      <ul className="space-y-3">
        {items.map((item) => (
          <li key={item}>
            <Link
              href={getShopHref(item)}
              className="text-[16px] text-white/60 hover:text-secondary transition-colors flex items-center gap-2 group"
            >
              <span className="w-0 h-[1px] bg-secondary transition-all group-hover:w-3" />
              {item}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

function FooterSection({ title, items, id, isOpen, onToggle, isCustomContent, wrapperClassName }: FooterSectionProps) {
  return (
    <div className={`border-b lg:border-none border-white/5 py-4 lg:py-0 ${wrapperClassName ?? ""}`}>
      <button
        onClick={() => onToggle(id)}
        className="flex items-center justify-between w-full lg:mb-4 group text-left"
      >
        <div>
          <h3 className="font-bold text-[14px] md:text-[16px] uppercase tracking-[0.15em] text-white inline-block">
            {title}
          </h3>
          <div className="hidden lg:block w-8 h-[2px] bg-secondary mt-3" />
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
                              item === "Request a Return" ? "/returns" : "#"
                  }
                  className="text-[16px] text-white/60 hover:text-secondary transition-colors flex items-center gap-2 group"
                >
                  <span className="w-0 h-[1px] bg-secondary transition-all group-hover:w-3" />
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
  const { description, social } = useSettings();

  const toggleSection = (section: string) => {
    setOpenSection(openSection === section ? null : section);
  };

  return (
    <footer className="bg-primary text-white font-hanken">
      {/* Main Footer */}
      <div className="py-10 md:py-10 px-4 md:px-8 border-t border-white/5">
        <div className="max-w-[1200px] w-full mx-auto">
          <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4 lg:gap-10">
            {/* About Section */}
            <FooterSection
              title="About PetPosture"
              id="about"
              isOpen={openSection === "about"}
              onToggle={toggleSection}
              wrapperClassName="lg:w-64 lg:shrink-0"
              isCustomContent={
                <div className="pb-4 lg:pb-0">
                  <p className="text-[16px] text-white/60 leading-[1.75] mb-6">
                    {description}
                  </p>
                  <div className="flex gap-4">
                    {[
                      { Icon: Facebook, label: "Facebook", href: social.facebook },
                      { Icon: Instagram, label: "Instagram", href: social.instagram },
                      { Icon: Twitter, label: "Twitter", href: social.twitter },
                      { Icon: TikTokIcon, label: "TikTok", href: social.tiktok },
                      { Icon: PinterestIcon, label: "Pinterest", href: social.pinterest },
                      { Icon: Youtube, label: "Youtube", href: social.youtube },
                    ]
                      .filter(({ href }) => href)
                      .map(({ Icon, label, href }) => (
                        <a
                          key={label}
                          href={href!}
                          target="_blank"
                          rel="noopener noreferrer"
                          aria-label={label}
                          className="w-11 h-11 rounded-full border border-white/10 flex items-center justify-center text-white/60 hover:text-white hover:bg-white/10 hover:border-white/10 transition-all duration-300 group"
                        >
                          <Icon size={18} strokeWidth={2} className="transition-transform duration-300 group-hover:scale-125" />
                        </a>
                      ))}
                    <Link
                      href="/contact"
                      aria-label="Email"
                      className="w-11 h-11 rounded-full border border-white/10 flex items-center justify-center text-white/60 hover:text-white hover:bg-white/10 hover:border-white/10 transition-all duration-300 group"
                    >
                      <Mail size={18} strokeWidth={2} className="transition-transform duration-300 group-hover:scale-125" />
                    </Link>
                  </div>
                </div>
              }
            />

            {/* Shop section: solution + breed sub-groups, accordion on mobile */}
            <FooterSection
              title="Shop"
              id="shop"
              isOpen={openSection === "shop"}
              onToggle={toggleSection}
              isCustomContent={
                <div className="pb-4 lg:pb-0 space-y-6">
                  <ShopLinkGroup heading="By Solution" items={shopBySolution} />
                  <ShopLinkGroup heading="By Breed" items={shopByBreed} />
                </div>
              }
            />
            <FooterSection title="Customer Service" items={customerService} id="service" isOpen={openSection === "service"} onToggle={toggleSection} />
            <FooterSection
              title="Legal"
              id="legal"
              isOpen={openSection === "legal"}
              onToggle={toggleSection}
              isCustomContent={
                <ul className="space-y-3 pb-4 lg:pb-0">
                  {legalLinks.map((link) => (
                    <li key={link}>
                      <Link
                        href={getLegalHref(link)}
                        className="text-[16px] text-white/60 hover:text-secondary transition-colors flex items-center gap-2 group"
                      >
                        <span className="w-0 h-[1px] bg-secondary transition-all group-hover:w-3" />
                        {link}
                      </Link>
                    </li>
                  ))}
                </ul>
              }
            />
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
                  {bottomBarLegalLinks.slice(0, 2).map((link) => (
                    <Link
                      key={link}
                      href={getLegalHref(link)}
                      className="text-[13px] uppercase tracking-[0.08em] text-white/70 hover:text-secondary transition-colors whitespace-nowrap"
                    >
                      {link}
                    </Link>
                  ))}
                </div>
                {/* Mobile Group 2 */}
                <div className="flex items-center gap-6">
                  {bottomBarLegalLinks.slice(2).map((link) => (
                    <Link
                      key={link}
                      href={getLegalHref(link)}
                      className="text-[13px] uppercase tracking-[0.08em] text-white/70 hover:text-secondary transition-colors whitespace-nowrap"
                    >
                      {link}
                    </Link>
                  ))}
                </div>
              </div>

              <div className="pt-[10px] border-t border-white/10 w-full">
                <p className="text-xs text-white/70 font-normal tracking-wide">
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
