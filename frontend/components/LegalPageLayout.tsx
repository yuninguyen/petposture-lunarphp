"use client";

import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import Header from '@/components/Header';
import Footer from '@/components/Footer';

const fadeUp = {
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0, transition: { duration: 0.6 } }
};

type LegalPage = {
    title: string;
    content: string;
    updatedAt: string | null;
};

function slugify(text: string): string {
    return text
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');
}

function useTableOfContents(html: string) {
    return useMemo(() => {
        const matches = [...html.matchAll(/<h2[^>]*>(.*?)<\/h2>/gi)];
        const seen = new Map<string, number>();

        return matches.map((match) => {
            const title = match[1].replace(/<[^>]+>/g, '').trim();
            const base = slugify(title);
            const count = seen.get(base) ?? 0;
            seen.set(base, count + 1);
            return { id: count ? `${base}-${count}` : base, title };
        });
    }, [html]);
}

function annotateHeadingsWithIds(html: string): string {
    const seen = new Map<string, number>();

    return html.replace(/<h2([^>]*)>(.*?)<\/h2>/gi, (full, attrs, inner) => {
        const title = inner.replace(/<[^>]+>/g, '').trim();
        const base = slugify(title);
        const count = seen.get(base) ?? 0;
        seen.set(base, count + 1);
        const id = count ? `${base}-${count}` : base;
        return `<h2${attrs} id="${id}">${inner}</h2>`;
    });
}

export default function LegalPageLayout({ page }: { page: LegalPage }) {
    const sections = useTableOfContents(page.content);
    const contentWithIds = useMemo(() => annotateHeadingsWithIds(page.content), [page.content]);
    const [activeSection, setActiveSection] = useState('');

    useEffect(() => {
        const handleScroll = () => {
            const offsets = sections
                .map((s) => {
                    const el = document.getElementById(s.id);
                    return el ? { id: s.id, offset: el.offsetTop } : null;
                })
                .filter(Boolean) as { id: string; offset: number }[];

            const scrollPos = window.scrollY + 150;
            const current = [...offsets].reverse().find((o) => scrollPos >= o.offset);
            if (current) setActiveSection(current.id);
        };

        window.addEventListener('scroll', handleScroll);
        handleScroll();
        return () => window.removeEventListener('scroll', handleScroll);
    }, [sections]);

    const scrollTo = (id: string) => {
        const el = document.getElementById(id);
        if (el) {
            window.scrollTo({ top: el.offsetTop - 100, behavior: 'smooth' });
        }
    };

    return (
        <main className="min-h-screen bg-white font-hanken">
            <Header />

            <section className="bg-gray-50 py-20 px-4 md:px-8 border-b border-zinc-100">
                <div className="max-w-[1200px] mx-auto text-center">
                    <motion.div initial="initial" animate="animate" variants={fadeUp}>
                        <h1 className="text-[32px] md:text-[42px] font-bold uppercase tracking-[0.1em] text-primary mb-4">
                            {page.title}
                        </h1>
                        {page.updatedAt && (
                            <p className="text-[#666666] text-[16px] font-medium">
                                Last updated: {page.updatedAt}
                            </p>
                        )}
                        <div className="w-12 h-1 bg-secondary mx-auto rounded-full mt-6"></div>
                    </motion.div>
                </div>
            </section>

            <section className="py-16 px-4 md:px-8">
                <div className="max-w-[1200px] mx-auto flex flex-col lg:flex-row gap-16">
                    {sections.length > 0 && (
                        <aside className="hidden lg:block w-80 sticky top-32 h-fit">
                            <h4 className="text-[14px] font-bold uppercase tracking-widest text-primary mb-8 border-b border-zinc-100 pb-4">
                                Table of Contents
                            </h4>
                            <nav className="flex flex-col gap-4">
                                {sections.map((s) => (
                                    <button
                                        key={s.id}
                                        onClick={() => scrollTo(s.id)}
                                        className={`text-left text-sm font-bold uppercase tracking-wider transition-all hover:text-secondary ${activeSection === s.id ? 'text-secondary pl-2 border-l-2 border-secondary' : 'text-[#666666]'
                                            }`}
                                    >
                                        {s.title}
                                    </button>
                                ))}
                            </nav>
                        </aside>
                    )}

                    <div className="flex-1 max-w-[800px]">
                        <div
                            className="max-w-none text-[#4a4a4a] text-[16px] leading-[1.8] [&_h2]:text-[28px] [&_h2]:font-bold [&_h2]:text-primary [&_h2]:uppercase [&_h2]:tracking-tight [&_h2]:mt-12 [&_h2]:mb-6 [&_h3]:text-[20px] [&_h3]:font-bold [&_h3]:text-primary [&_h3]:mt-8 [&_h3]:mb-4 [&_p]:mb-4 [&_ul]:list-disc [&_ul]:pl-6 [&_ul]:mb-6 [&_ul]:space-y-2 [&_li]:pl-1 [&_a]:text-secondary [&_a:hover]:underline [&_strong]:font-bold [&_em]:italic [&_blockquote]:bg-[#f8fafc] [&_blockquote]:border [&_blockquote]:border-zinc-100 [&_blockquote]:rounded-2xl [&_blockquote]:p-8 [&_blockquote]:mb-8 [&_blockquote_p]:mb-3 [&_blockquote_p:last-child]:mb-0 [&_blockquote]:not-italic"
                            dangerouslySetInnerHTML={{ __html: contentWithIds }}
                        />
                    </div>
                </div>
            </section>

            <Footer />
        </main>
    );
}
