"use client";

import Link from "next/link";
import Image from "next/image";
import { Search, Heart, User, ShoppingBag, Menu, Phone, MessageCircle, Mail, Clock, Truck, X, Facebook, Instagram, Twitter, ChevronRight, LogOut } from "lucide-react";
import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useCart } from "@/context/CartContext";
import { useAuth } from "@/context/AuthContext";

export default function Header() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();
  const { items, setCartOpen } = useCart();
  const { user, logout } = useAuth();

  const isActive = (path: string) => pathname === path;

  // Body scroll lock logic
  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [mobileOpen]);

  const navLinkClass = (path: string) =>
    `flex items-center h-full px-6 transition-colors ${isActive(path)
      ? "bg-[#df8448] text-white"
      : "text-[#e8eaec] hover:text-white hover:bg-[#df8448]"
    }`;

  return (
    <header className="w-full relative z-50 flex flex-col font-sans">
      {/* Announcement Top Bar - Professional Refinement */}
      <div className="bg-[#3e4c57] text-white py-1.5 px-4 text-center text-[10px] md:text-[11px] font-medium tracking-[0.2em] uppercase w-full">
        <div className="flex items-center justify-center gap-2 opacity-90">
          <Truck size={13} className="text-[#df8448]" />
          <span>Free Shipping on all US orders over $50</span>
        </div>
      </div>

      {/* Top Bar - White */}
      <div className="bg-white h-[65px] md:h-[100px] border-b border-zinc-100 relative z-30">
        <div className="max-w-[1200px] mx-auto w-full px-6 flex items-center justify-between h-full gap-4 md:gap-8">

          {/* Mobile Menu Toggle */}
          <button
            className="md:hidden text-primary hover:text-secondary transition-colors p-1"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label="Menu"
          >
            <Menu size={24} strokeWidth={2.5} />
          </button>

          {/* Left: Logo */}
          <Link href="/" className="flex-shrink-0 relative w-[220px] md:w-[240px] h-full flex items-center -ml-2">
            <img
              src="/assets/Logo-PetPosture-1.png"
              alt="PetPosture Logo"
              className="absolute top-1/2 -translate-y-[45%] left-0 h-[130px] md:h-[130px] w-auto object-contain z-50 drop-shadow-sm"
            />
          </Link>

          {/* Center: Search (Desktop) */}
          <div className="hidden md:flex flex-1 max-w-[500px]">
            <div className="flex w-full border border-zinc-300 rounded overflow-hidden focus-within:border-zinc-400 transition-colors">
              <input
                type="text"
                placeholder="Search"
                className="flex-1 px-4 h-[44px] border-none outline-none focus:ring-0 text-[14px] text-primary bg-transparent"
              />
              <button
                className="bg-[#df8448] text-white px-8 h-[44px] font-bold tracking-wider text-[11px] uppercase hover:bg-[#c9713a] transition-colors border-none m-0 rounded-none"
              >
                Search
              </button>
            </div>
          </div>

          {/* Right: Icons */}
          <div className="flex items-center gap-4 md:gap-6 text-primary flex-shrink-0">
            <Link href="/wishlist" className="hover:text-[#df8448] transition-colors hidden sm:block">
              <Heart size={22} strokeWidth={2} />
            </Link>
            {user ? (
              <div className="flex items-center gap-3">
                <span className="text-[12px] font-bold uppercase tracking-widest text-[#df8448] hidden lg:block">
                  Hi, {user.name.split(' ')[0]}
                </span>
                <button onClick={logout} className="hover:text-[#df8448] transition-colors" title="Log Out">
                  <LogOut size={22} strokeWidth={2} />
                </button>
              </div>
            ) : (
              <Link href="/auth" className="hover:text-[#df8448] transition-colors" title="Login / Register">
                <User size={22} strokeWidth={2} />
              </Link>
            )}
            <button
              onClick={() => setCartOpen(true)}
              className="relative group p-1 hover:text-[#df8448] transition-colors outline-none"
            >
              <ShoppingBag size={22} strokeWidth={2} />
              {items.length > 0 && (
                <span className="absolute -top-1 -right-1.5 bg-[#df8448] text-white text-[9px] font-black rounded-full w-4 h-4 flex items-center justify-center shadow-sm">
                  {items.reduce((total, item) => total + item.quantity, 0)}
                </span>
              )}
            </button>
          </div>

        </div>
      </div>

      {/* Secondary Navigation (Dark Blue) */}
      <nav className="hidden md:block bg-[#3e4c57] text-[#e8eaec] h-[45px] relative z-40" aria-label="Main menu">
        <div className="max-w-[1200px] mx-auto w-full px-6 flex justify-between h-full">

          {/* Main Links */}
          <ul className="flex items-center text-[13px] font-bold uppercase tracking-[0.1em] h-full" style={{ fontFamily: "var(--font-lato), sans-serif" }}>
            <li className="h-full">
              <Link href="/" className={navLinkClass("/")}>
                Home
              </Link>
            </li>
            <li className="h-full">
              <Link href="/shop" className={navLinkClass("/shop")}>
                Shop
              </Link>
            </li>
            <li className="h-full">
              <Link href="/our-mission" className={navLinkClass("/our-mission")}>
                Our Mission
              </Link>
            </li>
            <li className="h-full">
              <Link href="/blog" className={navLinkClass("/blog")}>
                Blog
              </Link>
            </li>
            <li className="h-full">
              <Link href="/contact" className={navLinkClass("/contact")}>
                Contact
              </Link>
            </li>
          </ul>


          {/* Utility Links */}
          <ul className="flex items-center text-[13px] font-bold uppercase tracking-[0.1em] divide-x divide-white/10 h-full" style={{ fontFamily: "var(--font-lato), sans-serif" }}>
            <li className="h-full relative group flex items-center hover:bg-white/10 transition-all duration-300">
              <a href="mailto:support@petposture.com" className="flex items-center gap-2.5 h-full px-6 hover:text-[#df8448] transition-colors text-[#e8eaec]">
                <Mail size={14} className="text-[#df8448]" /> Support
              </a>
              <NavTooltip textCase="lowercase">support@petposture.com</NavTooltip>
            </li>
            <li className="h-full relative group flex items-center hover:bg-white/10 transition-all duration-300">
              <span className="flex items-center gap-2.5 h-full px-6 text-[#e8eaec] cursor-default">
                <Clock size={14} className="text-[#df8448]" /> 10:00 AM - 20:00 PM
              </span>
              <NavTooltip textCase="uppercase">10:00 AM - 20:00 PM</NavTooltip>
            </li>
            <li className="h-full relative group flex items-center hover:bg-white/10 transition-all duration-300">
              <a href="tel:19166680065" className="flex items-center gap-2.5 h-full px-6 hover:text-[#df8448] transition-colors text-[#e8eaec]">
                <Phone size={14} className="text-[#df8448]" /> +1 (916) 668-0065
              </a>
              <NavTooltip textCase="lowercase">+1 (916) 668-0065</NavTooltip>
            </li>
          </ul>

        </div>
      </nav>

      {/* Mobile Search Bar */}
      <div className="md:hidden bg-white p-4 border-b border-zinc-100">
        <div className="flex w-full border-2 border-zinc-200 rounded overflow-hidden">
          <input
            type="text"
            placeholder="Search products..."
            className="flex-1 px-3 py-2 outline-none text-[12px]"
          />
          <button className="bg-[#df8448] px-4 text-white uppercase text-[10px] font-bold">
            Search
          </button>
        </div>
      </div>

      {/* Mobile Drawer Overlay - Professional Redesign */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            {/* Backdrop Blur */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMobileOpen(false)}
              className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[100] md:hidden"
            />

            {/* Side Drawer */}
            <motion.div
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="fixed inset-y-0 left-0 w-[85%] max-w-[400px] bg-white z-[110] md:hidden flex flex-col shadow-2xl"
            >
              {/* Drawer Header */}
              <div className="flex items-center justify-between px-6 h-[80px] border-b border-zinc-100 relative">
                <Link href="/" onClick={() => setMobileOpen(false)} className="flex-shrink-0 relative w-[240px] h-full flex items-center -ml-2">
                  <img
                    src="/assets/Logo-PetPosture-1.png"
                    alt="Logo"
                    className="absolute top-1/2 -translate-y-[45%] left-0 h-[140px] md:h-[130px] w-auto object-contain z-50 drop-shadow-sm"
                  />
                </Link>
                <button
                  onClick={() => setMobileOpen(false)}
                  className="p-2 text-primary hover:bg-zinc-100 rounded-full transition-colors relative z-[60]"
                >
                  <X size={24} />
                </button>
              </div>

              {/* Scrollable Content */}
              <div className="flex-1 overflow-y-auto px-6 py-6">
                {/* Primary Nav Links */}
                <nav className="space-y-1">
                  {[
                    { label: "Home", href: "/" },
                    { label: "Shop", href: "/shop" },
                    { label: "Our Mission", href: "/our-mission" },
                    { label: "Blog", href: "/blog" },
                    { label: "Contact", href: "/contact" },
                  ].map((item) => (
                    <Link
                      key={item.label}
                      href={item.href}
                      onClick={() => setMobileOpen(false)}
                      className={`flex items-center justify-between px-4 py-4 rounded-xl group transition-all duration-300 mb-1 ${isActive(item.href) ? "bg-[#df8448]" : "text-primary hover:bg-zinc-50"
                        }`}
                    >
                      <span className={`text-[14px] font-bold uppercase tracking-widest transition-colors duration-300 ${isActive(item.href) ? "text-white" : "group-hover:text-[#df8448]"}`}>
                        {item.label}
                      </span>
                      <ChevronRight size={18} className={`transition-all duration-300 ${isActive(item.href) ? "text-white translate-x-1" : "group-hover:text-[#df8448] group-hover:translate-x-1"}`} />
                    </Link>
                  ))}
                </nav>

                {/* Secondary Info */}
                <div className="mt-10 pt-8 border-t border-zinc-100 space-y-6">
                  <div className="flex items-center gap-4 text-primary">
                    <div className="w-10 h-10 rounded-full bg-zinc-50 flex items-center justify-center text-secondary shadow-sm">
                      <Phone size={18} />
                    </div>
                    <div>
                      <div className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Call Us</div>
                      <a href="tel:19166680065" className="text-[14px] font-bold">+1 (916) 668-0065</a>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 text-primary">
                    <div className="w-10 h-10 rounded-full bg-zinc-50 flex items-center justify-center text-secondary shadow-sm">
                      <Mail size={18} />
                    </div>
                    <div>
                      <div className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Email Us</div>
                      <a href="mailto:support@petposture.com" className="text-[14px] font-bold">support@petposture.com</a>
                    </div>
                  </div>
                </div>

                {/* Social Links */}
                <div className="mt-10 flex gap-4">
                  {[Facebook, Instagram, Twitter].map((Icon, idx) => (
                    <a key={idx} href="#" className="w-10 h-10 rounded-full border border-zinc-100 flex items-center justify-center text-primary hover:bg-secondary hover:text-white transition-all duration-300 shadow-sm">
                      <Icon size={18} />
                    </a>
                  ))}
                </div>
              </div>

              {/* Drawer Footer CTA */}
              <div className="p-6 border-t border-zinc-100">
                <Link
                  href="/shop"
                  onClick={() => setMobileOpen(false)}
                  className="w-full bg-secondary text-white py-4 rounded font-black uppercase tracking-[0.2em] text-[12px] flex items-center justify-center gap-3 shadow-lg hover:bg-secondary/90 transition-all"
                >
                  <ShoppingBag size={18} />
                  Shop the Collection
                </Link>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </header>
  );
}

function NavTooltip({ children, textCase = 'lowercase' }: { children: React.ReactNode, textCase?: 'lowercase' | 'uppercase' }) {
  return (
    <div className={`absolute bottom-[55px] left-1/2 -translate-x-1/2 px-4 py-2.5 bg-[#3e4c57] text-white text-[12px] rounded shadow-2xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-300 translate-y-2 group-hover:translate-y-0 whitespace-nowrap z-[9999] font-sans font-medium pointer-events-none ${textCase} after:content-[''] after:absolute after:top-full after:left-1/2 after:-translate-x-1/2 after:border-8 after:border-transparent after:border-t-[#3e4c57]`}>
      {children}
    </div>
  );
}

