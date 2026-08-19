import { useState } from 'react';
import { motion } from 'framer-motion';
import { Check, ArrowRight, Phone, Heart, Clock, MapPin } from 'lucide-react';

/* ---------------------------------- palette ----------------------------------
   cream  #F1E6CF   paper #EADCBE   charcoal #2A241C
   orange #D95B29   mustard #E0A22E  teal #36746A  rose #C26E52  wood #7C4A24
--------------------------------------------------------------------------------*/

const C = {
  cream: '#F1E6CF',
  paper: '#EADCBE',
  ink: '#2A241C',
  orange: '#D95B29',
  mustard: '#E0A22E',
  teal: '#36746A',
  rose: '#C26E52',
  wood: '#7C4A24',
};

/* ------------------------------ atomic artworks ------------------------------ */

const Starburst = ({ color = C.cream }) => (
  <svg viewBox="0 0 120 120" className="w-full h-full">
    {[...Array(16)].map((_, i) => {
      const a = (i * Math.PI) / 8;
      const r1 = i % 2 === 0 ? 18 : 26;
      const r2 = i % 2 === 0 ? 50 : 38;
      return (
        <g key={i}>
          <line x1={60 + r1 * Math.cos(a)} y1={60 + r1 * Math.sin(a)} x2={60 + r2 * Math.cos(a)} y2={60 + r2 * Math.sin(a)} stroke={color} strokeWidth="2.5" strokeLinecap="round" />
          {i % 2 === 0 && <circle cx={60 + (r2 + 5) * Math.cos(a)} cy={60 + (r2 + 5) * Math.sin(a)} r="3" fill={color} />}
        </g>
      );
    })}
    <circle cx="60" cy="60" r="9" fill={color} />
  </svg>
);

const NestArt = ({ color = C.ink, accent = C.cream }) => (
  <svg viewBox="0 0 160 110" className="w-full h-full">
    <ellipse cx="80" cy="58" rx="62" ry="40" fill="none" stroke={color} strokeWidth="3" transform="rotate(-6 80 58)" />
    <ellipse cx="80" cy="58" rx="44" ry="28" fill="none" stroke={color} strokeWidth="3" transform="rotate(5 80 58)" />
    <ellipse cx="80" cy="58" rx="27" ry="17" fill="none" stroke={color} strokeWidth="3" transform="rotate(-10 80 58)" />
    <circle cx="80" cy="58" r="8" fill={accent} stroke={color} strokeWidth="3" />
    <circle cx="132" cy="22" r="4.5" fill={color} />
  </svg>
);

const AtomArt = ({ color = C.cream, accent = C.mustard }) => (
  <svg viewBox="0 0 160 110" className="w-full h-full">
    <ellipse cx="80" cy="55" rx="60" ry="22" fill="none" stroke={color} strokeWidth="2.5" />
    <ellipse cx="80" cy="55" rx="60" ry="22" fill="none" stroke={color} strokeWidth="2.5" transform="rotate(60 80 55)" />
    <ellipse cx="80" cy="55" rx="60" ry="22" fill="none" stroke={color} strokeWidth="2.5" transform="rotate(120 80 55)" />
    <circle cx="80" cy="55" r="9" fill={accent} />
    <circle cx="140" cy="55" r="5" fill={color} />
    <circle cx="50" cy="13" r="5" fill={color} />
    <circle cx="110" cy="97" r="5" fill={color} />
  </svg>
);

const BoomerangArt = ({ color = C.cream, accent = C.orange }) => (
  <svg viewBox="0 0 160 110" className="w-full h-full">
    <path d="M18 86 Q80 6 142 86 Q80 52 18 86 Z" fill={accent} />
    <path d="M30 100 Q80 36 130 100 Q80 74 30 100 Z" fill="none" stroke={color} strokeWidth="3" />
    <circle cx="80" cy="22" r="5" fill={color} />
    <circle cx="20" cy="20" r="3.5" fill={color} />
    <circle cx="140" cy="20" r="3.5" fill={color} />
  </svg>
);

const HangItAllArt = ({ colors = [C.orange, C.mustard, C.teal, C.cream, C.rose, C.orange] }) => (
  <svg viewBox="0 0 160 110" className="w-full h-full">
    {[...Array(6)].map((_, i) => {
      const a = (i * Math.PI) / 3 - Math.PI / 2;
      const x = 80 + 42 * Math.cos(a);
      const y = 55 + 38 * Math.sin(a);
      return (
        <g key={i}>
          <line x1="80" y1="55" x2={x} y2={y} stroke={C.cream} strokeWidth="2.5" />
          <circle cx={x} cy={y} r="8" fill={colors[i]} />
        </g>
      );
    })}
    <circle cx="80" cy="55" r="6" fill={C.cream} />
  </svg>
);

const HorizonArt = ({ color = C.ink, sun = C.orange }) => (
  <svg viewBox="0 0 160 110" className="w-full h-full">
    <path d="M40 70 A40 40 0 0 1 120 70 Z" fill={sun} />
    {[...Array(7)].map((_, i) => {
      const a = Math.PI - (i * Math.PI) / 6;
      return <line key={i} x1={80 + 46 * Math.cos(a)} y1={70 - 46 * Math.sin(a)} x2={80 + 56 * Math.cos(a)} y2={70 - 56 * Math.sin(a)} stroke={color} strokeWidth="3" strokeLinecap="round" />;
    })}
    <line x1="14" y1="78" x2="146" y2="78" stroke={color} strokeWidth="3" />
    <line x1="26" y1="88" x2="134" y2="88" stroke={color} strokeWidth="2.5" />
    <line x1="40" y1="97" x2="120" y2="97" stroke={color} strokeWidth="2" />
  </svg>
);

/* ------------------------------- exhibit data -------------------------------- */

const ROOMS = [
  {
    no: '01',
    wing: 'EAST WING',
    title: 'ARRIVAL & WELCOME',
    medium: 'Identity, kindly verified — three questions, zero fine print',
    desc: "Tell us your name and we'll hold the door. No credit pulls, no squinting at clauses. Most visitors are inside before their coffee cools.",
    time: '1 MIN',
    bg: C.orange,
    art: <Starburst color={C.cream} />,
    label: 'ROOM ONE',
  },
  {
    no: '02',
    wing: 'EAST WING',
    title: 'THE NEST',
    medium: 'Savings spaces, hand-built — Rent, Rainy Day, The Postponed Trip',
    desc: 'Little rooms inside your account, each with its own purpose. We tuck money into them automatically, the way you meant to but never quite did.',
    time: '2 MIN',
    bg: C.mustard,
    art: <NestArt color={C.ink} accent={C.cream} />,
    label: 'ROOM TWO',
  },
  {
    no: '03',
    wing: 'EAST WING',
    title: 'THE ROUND-UP ROOM',
    medium: 'Spare change in continuous motion, swept nightly',
    desc: 'Every coffee leaves a coin behind. We sweep the difference into your Nest while you go about your day — members save $43.18 a month without noticing.',
    time: '45 SEC',
    bg: C.teal,
    art: <AtomArt color={C.cream} accent={C.mustard} />,
    label: 'ROOM THREE',
  },
  {
    no: '04',
    wing: 'WEST WING',
    title: 'THE SAFETY NET',
    medium: 'Up to $200 of grace — no fees, no lecture, no asterisk',
    desc: "Slip below zero and we catch you. We'll mention it quietly, cover the gap, and help you back up. That's the whole feature.",
    time: '1 MIN',
    bg: C.ink,
    art: <BoomerangArt color={C.cream} accent={C.rose} />,
    label: 'ROOM FOUR',
  },
  {
    no: '05',
    wing: 'WEST WING',
    title: 'SHARED CARE',
    medium: 'Joint accounts, allowances & permissions, set gently',
    desc: "Add a partner, a kid's allowance, a grandparent's groceries. You decide who sees what; we send the gentle nudges so you don't have to.",
    time: '3 MIN',
    bg: C.rose,
    art: <HangItAllArt />,
    label: 'ROOM FIVE',
  },
  {
    no: '06',
    wing: 'WEST WING',
    title: 'THE LONG VIEW',
    medium: 'Calm, round portfolios that rebalance themselves',
    desc: "When today feels settled, we start looking after tomorrow. Steady index portfolios, automatic and unhurried — built to be ignored for thirty years.",
    time: '4 MIN',
    bg: C.paper,
    art: <HorizonArt color={C.ink} sun={C.orange} />,
    label: 'ROOM SIX',
  },
];

/* --------------------------------- motion ------------------------------------ */

const gridV = { hidden: {}, show: { transition: { staggerChildren: 0.09, delayChildren: 0.2 } } };
const itemV = {
  hidden: { opacity: 0, y: 28 },
  show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] } },
};

/* --------------------------------- pieces ------------------------------------ */

const Plaque = ({ children, className = '' }) => (
  <div className={`border-[3px] border-[#2A241C] bg-[#F6EEDB] ${className}`}>{children}</div>
);

function ExhibitCard({ room, visited, onVisit }) {
  const darkRoom = room.bg === C.ink;
  return (
    <motion.article
      variants={itemV}
      className="lg:col-span-4 md:col-span-6 col-span-12 border-[3px] border-[#2A241C] bg-[#F6EEDB] flex flex-col group"
    >
      {/* plaque header */}
      <div className="flex items-stretch border-b-[3px] border-[#2A241C]">
        <div className="px-3 py-2 bg-[#2A241C] text-[#F1E6CF] font-head text-[11px] tracking-[0.22em]">{room.label}</div>
        <div className="px-3 py-2 font-head text-[11px] tracking-[0.22em] text-[#2A241C]/70 border-l-[3px] border-[#2A241C]">{room.wing}</div>
        <div className="ml-auto px-3 py-2 font-head text-[11px] tracking-[0.22em] flex items-center gap-1.5 border-l-[3px] border-[#2A241C]" style={{ color: visited ? C.teal : '#2A241C' }}>
          <span className="inline-block w-2 h-2 rounded-full" style={{ background: visited ? C.teal : C.orange }} />
          {visited ? 'VISITED' : 'ON VIEW'}
        </div>
      </div>

      {/* the artwork */}
      <div className="relative h-44 flex items-center justify-center overflow-hidden" style={{ background: room.bg }}>
        <div className="w-44 h-32 transition-transform duration-500 group-hover:scale-105 group-hover:-rotate-1">{room.art}</div>
        <div className="absolute top-2 right-3 font-head text-[44px] leading-none font-medium tracking-[0.05em]" style={{ color: darkRoom ? 'rgba(241,230,207,0.25)' : 'rgba(42,36,28,0.22)' }}>
          {room.no}
        </div>
      </div>

      {/* wall label */}
      <div className="border-t-[3px] border-[#2A241C] p-4 flex flex-col gap-2 flex-1">
        <h3 className="font-head text-[17px] font-semibold tracking-[0.16em] text-[#2A241C]">{room.title}</h3>
        <p className="font-serif italic text-[13px] leading-snug text-[#7C4A24]">{room.medium}</p>
        <p className="text-[13px] leading-relaxed text-[#2A241C]/85">{room.desc}</p>
      </div>

      {/* meta footer */}
      <div className="mt-auto border-t-[3px] border-[#2A241C] flex items-stretch">
        <div className="px-3 py-2.5 font-head text-[11px] tracking-[0.2em] text-[#2A241C]/70 flex items-center gap-1.5">
          <Clock size={12} strokeWidth={2.5} /> {room.time}
        </div>
        <button
          onClick={onVisit}
          className="ml-auto px-4 py-2.5 font-head text-[11px] tracking-[0.2em] flex items-center gap-2 border-l-[3px] border-[#2A241C] transition-colors duration-300"
          style={{ background: visited ? C.teal : '#F6EEDB', color: visited ? C.cream : C.ink }}
          onMouseEnter={(e) => { if (!visited) e.currentTarget.style.background = C.mustard; }}
          onMouseLeave={(e) => { if (!visited) e.currentTarget.style.background = '#F6EEDB'; }}
        >
          {visited ? <><Check size={13} strokeWidth={3} /> ROOM SEEN</> : <>STEP INSIDE <ArrowRight size={13} strokeWidth={2.5} /></>}
        </button>
      </div>
    </motion.article>
  );
}

/* ----------------------------------- app ------------------------------------- */

export default function App() {
  const [visited, setVisited] = useState(new Set(['01']));
  const toggle = (no) =>
    setVisited((prev) => {
      const next = new Set(prev);
      next.has(no) ? next.delete(no) : next.add(no);
      return next;
    });

  return (
    <div className="min-h-screen w-full" style={{ background: C.cream, color: C.ink }}>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link href="https://fonts.googleapis.com/css2?family=Jost:ital,wght@0,400;0,500;0,600;0,700;1,400&family=Fraunces:ital,opsz,wght@0,9..144,400;0,9..144,600;1,9..144,400;1,9..144,500&display=swap" rel="stylesheet" />
      <style dangerouslySetInnerHTML={{ __html: `
        .font-head { font-family: 'Jost', sans-serif; }
        .font-serif { font-family: 'Fraunces', serif; }
        body { font-family: 'Jost', sans-serif; }
        .grain { position: relative; }
        .grain::after {
          content: ''; position: fixed; inset: 0; pointer-events: none; opacity: 0.05; mix-blend-mode: multiply;
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/%3E%3C/filter%3E%3Crect width='160' height='160' filter='url(%23n)'/%3E%3C/svg%3E");
        }
        @keyframes spinSlow { to { transform: rotate(360deg); } }
        .spin-slow { animation: spinSlow 40s linear infinite; }
        ::selection { background: ${C.mustard}; color: ${C.ink}; }
      `}} />

      <div className="grain" />

      {/* ------------------------------ top strip ------------------------------ */}
      <div className="bg-[#2A241C] text-[#F1E6CF]">
        <div className="max-w-[1320px] mx-auto px-4 py-2 flex flex-wrap items-center gap-x-6 gap-y-1 font-head text-[10px] tracking-[0.25em]">
          <span className="flex items-center gap-1.5"><Heart size={11} /> MARIGOLD — A NEIGHBORHOOD BANK FOR THE INTERNET</span>
          <span className="hidden md:inline opacity-60">GALLERY HOURS: ALWAYS OPEN</span>
          <span className="hidden md:inline opacity-60">ADMISSION: FREE, FOREVER</span>
          <span className="ml-auto flex items-center gap-1.5 opacity-80"><MapPin size={11} /> WING A · MEMBER ONBOARDING</span>
        </div>
      </div>

      {/* -------------------------------- hero --------------------------------- */}
      <header className="border-b-[3px] border-[#2A241C]">
        <div className="max-w-[1320px] mx-auto px-4 pt-8 pb-6 grid grid-cols-12 gap-3">
          <motion.div
            initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
            className="col-span-12 lg:col-span-8 flex flex-col justify-end"
          >
            <p className="font-head text-[11px] tracking-[0.3em] text-[#7C4A24] mb-3">THE MARIGOLD PERMANENT COLLECTION · NO. 001</p>
            <h1 className="font-head font-semibold leading-[0.95] tracking-[0.12em] text-[#2A241C] text-[44px] sm:text-[64px] lg:text-[78px]">
              THE FIRST<br />
              DEPOSIT<span className="text-[#D95B29]">.</span>
            </h1>
            <p className="font-serif italic text-[20px] sm:text-[24px] text-[#36746A] mt-3">an onboarding exhibition in six rooms — banking, hung with care</p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
            className="col-span-12 lg:col-span-4 grid grid-cols-2 gap-3"
          >
            <div className="col-span-2 border-[3px] border-[#2A241C] bg-[#D95B29] p-4 flex items-center justify-between">
              <div className="w-20 h-20 spin-slow"><Starburst color={C.cream} /></div>
              <div className="text-right">
                <p className="font-head text-[10px] tracking-[0.25em] text-[#F1E6CF]/80">CURATED BY</p>
                <p className="font-head text-[15px] tracking-[0.18em] text-[#F1E6CF] font-semibold">THE CARE TEAM</p>
                <p className="font-serif italic text-[12px] text-[#F1E6CF]/90 mt-1">real humans, day & night</p>
              </div>
            </div>
            <Plaque className="p-3">
              <p className="font-head text-[10px] tracking-[0.25em] text-[#7C4A24]">ON VIEW</p>
              <p className="font-head text-[14px] tracking-[0.14em] font-semibold mt-1">TODAY → ALWAYS</p>
            </Plaque>
            <Plaque className="p-3">
              <p className="font-head text-[10px] tracking-[0.25em] text-[#7C4A24]">FULL VISIT</p>
              <p className="font-head text-[14px] tracking-[0.14em] font-semibold mt-1">≈ 12 MINUTES</p>
            </Plaque>
          </motion.div>
        </div>

        {/* progress strip */}
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.35, duration: 0.6 }}
          className="border-t-[3px] border-[#2A241C] bg-[#EADCBE]"
        >
          <div className="max-w-[1320px] mx-auto px-4 py-2.5 flex flex-wrap items-center gap-3">
            <span className="font-head text-[11px] tracking-[0.25em] font-semibold">YOUR VISIT</span>
            <div className="flex gap-1.5">
              {ROOMS.map((r) => (
                <div key={r.no} className="w-7 h-3.5 border-2 border-[#2A241C] transition-colors duration-300" style={{ background: visited.has(r.no) ? r.bg : 'transparent' }} />
              ))}
            </div>
            <span className="font-head text-[11px] tracking-[0.2em] text-[#2A241C]/70">{visited.size} OF 6 ROOMS</span>
            <span className="font-serif italic text-[13px] text-[#7C4A24] ml-auto hidden sm:inline">take your time — we'll hold your place at the door</span>
          </div>
        </motion.div>
      </header>

      {/* ------------------------------ exhibition grid ------------------------------ */}
      <main className="max-w-[1320px] mx-auto px-4 py-5">
        <motion.div variants={gridV} initial="hidden" animate="show" className="grid grid-cols-12 gap-3">

          {/* row 1: rooms 1 & 2 + small data tiles */}
          <ExhibitCard room={ROOMS[0]} visited={visited.has('01')} onVisit={() => toggle('01')} />
          <ExhibitCard room={ROOMS[1]} visited={visited.has('02')} onVisit={() => toggle('02')} />

          <motion.div variants={itemV} className="lg:col-span-4 col-span-12 grid grid-cols-2 gap-3">
            <Plaque className="p-4 flex flex-col justify-between">
              <p className="font-head text-[10px] tracking-[0.25em] text-[#7C4A24]">FEES CHARGED, EVER</p>
              <p className="font-head text-[34px] font-semibold tracking-[0.06em] text-[#36746A] leading-none mt-3">$0.00</p>
              <p className="font-serif italic text-[12px] text-[#2A241C]/70 mt-2">acrylic on a clear conscience, 2019–present</p>
            </Plaque>
            <Plaque className="p-4 flex flex-col justify-between bg-[#36746A]" >
              <p className="font-head text-[10px] tracking-[0.25em] text-[#F1E6CF]/80">MEMBERS CARED FOR</p>
              <p className="font-head text-[28px] font-semibold tracking-[0.04em] text-[#F1E6CF] leading-none mt-3">2,418,309</p>
              <p className="font-serif italic text-[12px] text-[#F1E6CF]/80 mt-2">and counting, gently</p>
            </Plaque>
            <Plaque className="p-4 flex flex-col justify-between">
              <p className="font-head text-[10px] tracking-[0.25em] text-[#7C4A24]">AVG. FIRST VISIT</p>
              <p className="font-head text-[28px] font-semibold tracking-[0.04em] leading-none mt-3">4M 12S</p>
              <p className="font-serif italic text-[12px] text-[#2A241C]/70 mt-2">door to first deposit</p>
            </Plaque>
            <Plaque className="p-4 flex flex-col justify-between bg-[#E0A22E]">
              <p className="font-head text-[10px] tracking-[0.25em] text-[#2A241C]/70">OVERDRAFTS FORGIVEN</p>
              <p className="font-head text-[28px] font-semibold tracking-[0.04em] leading-none mt-3">$31.4M</p>
              <p className="font-serif italic text-[12px] text-[#2A241C]/75 mt-2">no lectures were given</p>
            </Plaque>
          </motion.div>

          {/* row 2: rooms 3, 4, 5 */}
          <ExhibitCard room={ROOMS[2]} visited={visited.has('03')} onVisit={() => toggle('03')} />
          <ExhibitCard room={ROOMS[3]} visited={visited.has('04')} onVisit={() => toggle('04')} />
          <ExhibitCard room={ROOMS[4]} visited={visited.has('05')} onVisit={() => toggle('05')} />

          {/* row 3: room 6 + docent + visitor's book */}
          <ExhibitCard room={ROOMS[5]} visited={visited.has('06')} onVisit={() => toggle('06')} />

          <motion.div variants={itemV} className="lg:col-span-5 md:col-span-6 col-span-12 border-[3px] border-[#2A241C] bg-[#2A241C] text-[#F1E6CF] flex flex-col">
            <div className="px-3 py-2 border-b-[3px] border-[#F1E6CF]/30 font-head text-[11px] tracking-[0.22em] flex items-center justify-between">
              <span>THE DOCENT DESK</span><span className="text-[#E0A22E]">OPEN NOW</span>
            </div>
            <div className="p-5 flex flex-col gap-3 flex-1">
              <h3 className="font-head text-[20px] font-semibold tracking-[0.16em]">SOMEONE WILL WALK<br />WITH YOU.</h3>
              <p className="font-serif italic text-[15px] text-[#E0A22E]">no phone trees, no hold music — a person who knows your name</p>
              <p className="text-[13px] leading-relaxed text-[#F1E6CF]/85">Real humans answer in 38 seconds, day or night. Ask about a room you skipped, a charge you don't recognize, or how to set up your kid's first allowance. We like the small questions best.</p>
              <div className="mt-auto grid grid-cols-3 gap-2 pt-2">
                {[['38 SEC', 'AVG. ANSWER'], ['24 / 7', 'EVERY DAY'], ['4.96★', 'MEMBER RATED']].map(([a, b]) => (
                  <div key={b} className="border-2 border-[#F1E6CF]/30 p-2.5">
                    <p className="font-head text-[16px] font-semibold tracking-[0.08em] text-[#E0A22E]">{a}</p>
                    <p className="font-head text-[9px] tracking-[0.22em] text-[#F1E6CF]/60 mt-0.5">{b}</p>
                  </div>
                ))}
              </div>
            </div>
            <button className="border-t-[3px] border-[#F1E6CF]/30 px-4 py-3 font-head text-[12px] tracking-[0.22em] flex items-center justify-between hover:bg-[#D95B29] transition-colors duration-300">
              <span className="flex items-center gap-2"><Phone size={14} /> RING THE DESK</span>
              <ArrowRight size={15} />
            </button>
          </motion.div>

          <motion.div variants={itemV} className="lg:col-span-3 md:col-span-6 col-span-12 flex flex-col gap-3">
            <Plaque className="p-4 flex-1 flex flex-col">
              <p className="font-head text-[10px] tracking-[0.25em] text-[#7C4A24]">FROM THE VISITOR'S BOOK</p>
              <p className="font-serif italic text-[16px] leading-snug mt-3 text-[#2A241C]">"I came in to open a checking account and left feeling looked after. I didn't know a bank could do that."</p>
              <p className="font-head text-[10px] tracking-[0.22em] text-[#36746A] mt-auto pt-4">— MARISOL R., MEMBER SINCE 2022</p>
            </Plaque>
            <div className="border-[3px] border-dashed border-[#2A241C] bg-[#E0A22E] p-4">
              <div className="flex items-center justify-between">
                <p className="font-head text-[12px] tracking-[0.28em] font-semibold">ADMIT ONE</p>
                <Heart size={14} strokeWidth={2.5} />
              </div>
              <p className="font-head text-[10px] tracking-[0.22em] mt-2 text-[#2A241C]/75">MEMBER № 2,418,310 — RESERVED FOR YOU</p>
              <p className="font-serif italic text-[12px] mt-1 text-[#2A241C]/80">free admission · deposits insured to $250,000</p>
            </div>
          </motion.div>

          {/* closing band */}
          <motion.div variants={itemV} className="col-span-12 border-[3px] border-[#2A241C] bg-[#D95B29] text-[#F1E6CF] flex flex-col md:flex-row items-stretch">
            <div className="p-5 md:p-6 flex items-center gap-5 flex-1">
              <div className="w-14 h-14 shrink-0 spin-slow hidden sm:block"><Starburst color={C.cream} /></div>
              <div>
                <h3 className="font-head text-[20px] sm:text-[24px] font-semibold tracking-[0.16em] leading-tight">READY FOR ROOM ONE? THE DOOR IS ALREADY OPEN.</h3>
                <p className="font-serif italic text-[14px] mt-1 text-[#F1E6CF]/90">your money, hung where you can see it — and someone nearby if you need a hand</p>
              </div>
            </div>
            <button className="md:border-l-[3px] border-t-[3px] md:border-t-0 border-[#2A241C] bg-[#2A241C] px-8 py-5 font-head text-[13px] tracking-[0.25em] flex items-center justify-center gap-3 hover:bg-[#36746A] transition-colors duration-300">
              BEGIN YOUR VISIT <ArrowRight size={16} />
            </button>
          </motion.div>
        </motion.div>
      </main>

      {/* -------------------------------- footer -------------------------------- */}
      <footer className="border-t-[3px] border-[#2A241C] bg-[#EADCBE]">
        <div className="max-w-[1320px] mx-auto px-4 py-3 flex flex-wrap items-center gap-x-6 gap-y-1 font-head text-[10px] tracking-[0.22em] text-[#2A241C]/70">
          <span>MARIGOLD FINANCIAL · MEMBER FDIC</span>
          <span>DEPOSITS INSURED TO $250,000</span>
          <span className="hidden md:inline">EXHIBITION CATALOG NO. 001 — "THE FIRST DEPOSIT"</span>
          <span className="ml-auto font-serif italic normal-case tracking-normal text-[12px] text-[#7C4A24]">curated with care in Portland, Oregon · est. 2019</span>
        </div>
      </footer>
    </div>
  );
}