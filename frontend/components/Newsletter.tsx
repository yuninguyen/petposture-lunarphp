export default function Newsletter() {
  return (
    <section className="py-24 px-4 md:px-8 bg-white border-b border-zinc-50 overflow-hidden">
      <div className="container mx-auto">
        <div className="max-w-4xl mx-auto flex flex-col md:flex-row items-center justify-between gap-12">
          {/* Text Area */}
          <div className="flex-1 text-center md:text-left">
            <h2 className="text-3xl md:text-4xl font-black uppercase tracking-[0.2em] text-primary mb-4 leading-tight">
              Get 10% Off <br className="hidden md:block" /> Your First <br className="hidden md:block" /> Order
            </h2>
            <p className="text-[11px] font-black uppercase tracking-[0.3em] text-primary/30 max-w-sm mx-auto md:mx-0">
              Join our pack and get exclusive deals, posture tips, and early access.
            </p>
          </div>

          {/* Form Area */}
          <div className="w-full max-w-md">
            <form className="flex flex-col gap-3 group" noValidate>
              <div className="relative">
                <label htmlFor="nl-email" className="sr-only">Email address</label>
                <input
                  id="nl-email"
                  type="email"
                  name="email"
                  placeholder="Your email address…"
                  autoComplete="email"
                  required
                  spellCheck={false}
                  className="w-full border-b-2 border-zinc-100 py-4 px-1 text-[12px] font-bold uppercase tracking-widest focus:outline-none focus:border-secondary transition-all bg-transparent placeholder:text-zinc-200"
                />
              </div>
              <button
                type="submit"
                className="bg-secondary hover:bg-primary text-white px-8 py-4 font-black text-[11px] uppercase tracking-[0.25em] transition-all shadow-xl hover:-translate-y-1 active:scale-95 whitespace-nowrap"
              >
                Subscribe
              </button>
            </form>

            <p className="mt-6 text-[9px] font-bold uppercase tracking-[0.1em] text-primary/20 text-center md:text-left leading-relaxed">
              By subscribing you agree to our{" "}
              <a href="/privacy" className="underline hover:text-primary transition-colors">Privacy Policy</a>
              . Unsubscribe at any time.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
