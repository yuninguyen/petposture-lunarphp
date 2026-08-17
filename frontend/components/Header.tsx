"use client";

import Link from "next/link";
import Image from "next/image";
import { Heart, User, ShoppingBag, Menu, Phone, Mail, Clock, Truck, X, Facebook, Instagram, Twitter, Youtube, ChevronRight, LogOut, Search } from "lucide-react";
import { useState, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useCart } from "@/context/CartContext";
import { useAuth } from "@/context/AuthContext";
import { useWishlist } from "@/context/WishlistContext";
import { useSettings } from "@/context/SettingsContext";
import { TikTokIcon, PinterestIcon } from "@/lib/socialIcons";

export default function Header() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const router = useRouter();
  const pathname = usePathname();

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const term = searchTerm.trim();
    if (!term) return;
    router.push(`/shop?q=${encodeURIComponent(term)}`);
    setMobileSearchOpen(false);
  };
  const { items, setCartOpen } = useCart();
  const { items: wishlistItems } = useWishlist();
  const { user, logout } = useAuth();
  const { shop_name, shop_logo, contact, social } = useSettings();
  const logoSrc = shop_logo || "/assets/logo/Logo-PetPosture-1-e1761840892773.webp";
  const phone = contact.phone || "+1 (916) 623-5368";
  const phoneHref = `tel:${phone.replace(/[^\d+]/g, "")}`;

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
      ? "bg-secondary text-ink"
      : "text-gray-100 hover:text-ink hover:bg-secondary"
    }`;

  return (
    <header className="w-full relative z-50 flex flex-col font-sans">
      {/* Announcement Top Bar - Professional Refinement */}
      <div className="bg-primary text-white py-1.5 px-4 text-center text-xs md:text-sm font-medium tracking-[0.03em] md:tracking-[0.1em] uppercase w-full">
        <div className="flex items-center justify-center gap-1.5 md:gap-2 opacity-90">
          <Truck size={13} className="text-secondary flex-shrink-0" />
          <span className="whitespace-nowrap">Free Shipping on all US orders over $50</span>
        </div>
      </div>

      {/* Top Bar - White */}
      <div className="bg-white h-[70px] md:h-[80px] border-b border-zinc-100 relative z-30">
        <div className="max-w-[1200px] mx-auto w-full px-6 flex items-center justify-between h-full gap-4 md:gap-8">

          {/* Mobile Menu Toggle */}
          <button
            className="md:hidden text-primary hover:text-rust transition-colors p-1"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label="Menu"
          >
            <Menu size={24} strokeWidth={2.5} />
          </button>

          {/* Left: Logo */}
          <Link href="/" className="flex-shrink-0 flex items-center">
            <Image
              src={logoSrc}
              alt={`${shop_name} Logo`}
              width={400}
              height={140}
              sizes="150px"
              priority
              className="h-[45px] w-auto object-contain"
            />
          </Link>

          {/* Center: Search (Desktop) */}
          <form onSubmit={handleSearchSubmit} className="hidden md:flex flex-1 max-w-[500px]">
            <div className="flex w-full border border-zinc-300 rounded overflow-hidden focus-within:border-zinc-400 transition-colors">
              <input
                type="text"
                placeholder="Search"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="flex-1 px-4 h-[44px] border-none outline-none focus:ring-0 text-[14px] text-primary bg-transparent"
              />
              <button
                type="submit"
                className="bg-secondary text-ink px-8 h-[44px] font-bold tracking-wider text-sm capitalize hover:bg-secondary-dark transition-colors border-none m-0 rounded-none"
              >
                Search
              </button>
            </div>
          </form>

          {/* Right: Icons */}
          <div className="flex items-center gap-4 md:gap-6 text-primary flex-shrink-0">
            <button
              className="md:hidden hover:text-rust transition-colors"
              onClick={() => setMobileSearchOpen((open) => !open)}
              aria-label="Search"
              aria-expanded={mobileSearchOpen}
            >
              <Search size={22} strokeWidth={2} />
            </button>
            <Link href="/wishlist" className="relative hover:text-rust transition-colors hidden sm:block" aria-label="Wishlist">
              <Heart size={22} strokeWidth={2} />
              {wishlistItems.length > 0 && (
                <span className="absolute -top-1 -right-1.5 bg-secondary text-ink text-xs font-black rounded-full w-4 h-4 flex items-center justify-center shadow-sm">
                  {wishlistItems.length}
                </span>
              )}
            </Link>
            {user ? (
              <div className="flex items-center gap-3">
                <Link href="/account" className="text-sm font-bold uppercase tracking-widest text-rust hidden lg:block hover:underline">
                  Hi, {user.name.split(' ')[0]}
                </Link>
                <Link href="/account" className="hover:text-rust transition-colors" title="My Account">
                  <User size={22} strokeWidth={2} />
                </Link>
                <button onClick={logout} className="hover:text-rust transition-colors" title="Log Out">
                  <LogOut size={22} strokeWidth={2} />
                </button>
              </div>
            ) : (
              <Link href="/sign-in" className="hover:text-rust transition-colors" title="Login / Register">
                <User size={22} strokeWidth={2} />
              </Link>
            )}
            <button
              onClick={() => setCartOpen(true)}
              className="relative group p-1 hover:text-rust transition-colors outline-none"
              aria-label="Shopping cart"
            >
              <ShoppingBag size={22} strokeWidth={2} />
              {items.length > 0 && (
                <span className="absolute -top-1 -right-1.5 bg-secondary text-ink text-xs font-black rounded-full w-4 h-4 flex items-center justify-center shadow-sm">
                  {items.reduce((total, item) => total + item.quantity, 0)}
                </span>
              )}
            </button>
          </div>

        </div>
      </div>

      {/* Secondary Navigation (Dark Blue) */}
      <nav className="hidden md:block bg-primary text-gray-100 h-[45px] relative z-40" aria-label="Main menu">
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
              <a href="mailto:support@petposture.com" className="flex items-center gap-2.5 h-full px-6 hover:text-secondary transition-colors text-gray-100">
                <Mail size={14} className="text-secondary" /> Support
              </a>
              <NavTooltip textCase="lowercase">support@petposture.com</NavTooltip>
            </li>
            <li className="h-full relative group flex items-center hover:bg-white/10 transition-all duration-300">
              <span className="flex items-center gap-2.5 h-full px-6 text-gray-100 cursor-default">
                <Clock size={14} className="text-secondary" /> 10:00 AM - 20:00 PM
              </span>
              <NavTooltip textCase="uppercase">10:00 AM - 20:00 PM</NavTooltip>
            </li>
            <li className="h-full relative group flex items-center hover:bg-white/10 transition-all duration-300">
              <a href={phoneHref} className="flex items-center gap-2.5 h-full px-6 hover:text-secondary transition-colors text-gray-100">
                <Phone size={14} className="text-secondary" /> {phone}
              </a>
              <NavTooltip textCase="lowercase">{phone}</NavTooltip>
            </li>
          </ul>

        </div>
      </nav>

      {/* Mobile Search Bar - opens on demand via the header search icon */}
      <AnimatePresence>
        {mobileSearchOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="md:hidden overflow-hidden bg-white border-b border-zinc-100"
          >
            <form onSubmit={handleSearchSubmit} className="p-4">
              <div className="flex w-full border-2 border-zinc-200 rounded overflow-hidden">
                <input
                  type="text"
                  placeholder="Search products..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  autoFocus
                  className="flex-1 px-3 py-2 outline-none text-sm"
                />
                <button type="submit" className="bg-secondary px-4 text-ink capitalize text-sm font-bold">
                  Search
                </button>
              </div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

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
              <div className="flex items-center justify-between px-6 h-[70px] border-b border-zinc-100 relative">
                <Link href="/" onClick={() => setMobileOpen(false)} className="flex-shrink-0 flex items-center">
                  <Image
                    src={logoSrc}
                    alt={`${shop_name} Logo`}
                    width={320}
                    height={100}
                    sizes="120px"
                    className="h-[38px] w-auto object-contain"
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
                      className={`flex items-center justify-between px-4 py-4 rounded-xl group transition-all duration-300 mb-1 ${isActive(item.href) ? "bg-secondary" : "text-primary hover:bg-zinc-50"
                        }`}
                    >
                      <span className={`text-[14px] font-bold uppercase tracking-widest transition-colors duration-300 ${isActive(item.href) ? "text-ink" : "group-hover:text-rust"}`}>
                        {item.label}
                      </span>
                      <ChevronRight size={18} className={`transition-all duration-300 ${isActive(item.href) ? "text-ink translate-x-1" : "group-hover:text-rust group-hover:translate-x-1"}`} />
                    </Link>
                  ))}
                </nav>

                {/* Secondary Info */}
                <div className="mt-10 pt-8 border-t border-zinc-100 space-y-6">
                  <div className="flex items-center gap-4 text-primary">
                    <div className="w-10 h-10 rounded-full bg-zinc-50 flex items-center justify-center text-rust shadow-sm">
                      <Phone size={18} />
                    </div>
                    <div>
                      <div className="text-xs uppercase font-bold text-gray-400 tracking-wider">Call Us</div>
                      <a href={phoneHref} className="text-[14px] font-bold">{phone}</a>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 text-primary">
                    <div className="w-10 h-10 rounded-full bg-zinc-50 flex items-center justify-center text-rust shadow-sm">
                      <Mail size={18} />
                    </div>
                    <div>
                      <div className="text-xs uppercase font-bold text-gray-400 tracking-wider">Email Us</div>
                      <a href="mailto:support@petposture.com" className="text-[14px] font-bold">support@petposture.com</a>
                    </div>
                  </div>
                </div>

                {/* Social Links */}
                <div className="mt-10 flex flex-wrap gap-4">
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
                        className="w-10 h-10 rounded-full border border-zinc-100 flex items-center justify-center text-primary hover:bg-secondary hover:text-ink transition-all duration-300 shadow-sm"
                      >
                        <Icon size={18} />
                      </a>
                    ))}
                </div>
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
    <div className={`absolute bottom-[55px] left-1/2 -translate-x-1/2 px-4 py-2.5 bg-primary text-white text-sm rounded shadow-2xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-300 translate-y-2 group-hover:translate-y-0 whitespace-nowrap z-[9999] font-sans font-medium pointer-events-none ${textCase} after:content-[''] after:absolute after:top-full after:left-1/2 after:-translate-x-1/2 after:border-8 after:border-transparent after:border-t-primary`}>
      {children}
    </div>
  );
}
