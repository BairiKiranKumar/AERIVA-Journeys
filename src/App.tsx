import { useEffect, useRef, useState } from 'react';
import GlobeCanvas, { type JourneyStage } from './components/GlobeCanvas';
import { destinationById, destinations, type DestinationId } from './data/destinations';
import { buildEnquiryMessage, whatsAppLink, type Enquiry } from './utils/enquiry';

const WHATSAPP_NUMBER = import.meta.env.VITE_AGENCY_WHATSAPP;

function ArrowIcon({ diagonal = false }: { diagonal?: boolean }) {
  return diagonal ? (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none"><path d="M5 19 19 5M8 5h11v11" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
  ) : (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none"><path d="M4 12h16m-7-7 7 7-7 7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
  );
}

function CloseIcon() {
  return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none"><path d="M5 5 19 19M19 5 5 19" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>;
}

function Brand({ light = true }: { light?: boolean }) {
  return (
    <span className={`brand ${light ? 'brand-light' : 'brand-dark'}`} aria-label="AERIVA Journeys">
      <svg className="brand-mark" viewBox="0 0 36 36" fill="none" aria-hidden="true">
        <circle cx="18" cy="18" r="15.5" stroke="currentColor" strokeWidth="1.1" />
        <path d="M7 23c5-2 9-7 13-15m-4 17c3-7 7-11 13-12M8 26c8-3 15-5 21-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        <circle cx="28" cy="12" r="2" fill="currentColor" />
      </svg>
      <span><strong>AERIVA</strong><small>JOURNEYS</small></span>
    </span>
  );
}

const steps: { title: string; description: string }[] = [
  { title: 'The world', description: 'Start exploring' },
  { title: 'The destination', description: 'Find your escape' },
  { title: 'The arrival', description: 'Imagine yourself there' },
];

function useReducedMotion() {
  const [reduced, setReduced] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReduced(query.matches);
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);
  return reduced;
}

function InquiryDialog({
  destinationId,
  onClose,
}: {
  destinationId: DestinationId;
  onClose: () => void;
}) {
  const destination = destinationById(destinationId);
  const [data, setData] = useState<Enquiry>({ name: '', month: '', travelers: '2 adults', style: 'Relaxed luxury escape' });
  const [copyMessage, setCopyMessage] = useState('');
  const nameField = useRef<HTMLInputElement>(null);
  const text = buildEnquiryMessage(destination, data);
  const whatsapp = whatsAppLink(WHATSAPP_NUMBER, text);

  useEffect(() => {
    nameField.current?.focus();
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previous; };
  }, []);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopyMessage('Enquiry copied. Paste it into your preferred messaging app.');
    } catch {
      setCopyMessage('Select the message below to copy it manually.');
    }
  };

  return (
    <div className="modal-layer" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="inquiry-dialog" role="dialog" aria-modal="true" aria-labelledby="inquiry-title">
        <div className="dialog-head">
          <span className="eyebrow dark-eyebrow">Your next chapter</span>
          <button className="icon-button close-dialog" type="button" onClick={onClose} aria-label="Close enquiry"><CloseIcon /></button>
        </div>
        <h2 id="inquiry-title">Let’s make <em>{destination.name}</em> yours.</h2>
        <p>Tell us what you have in mind. This concept demo prepares an enquiry; it does not book a trip or send your details to a server.</p>
        <form className="inquiry-form" onSubmit={(event) => { event.preventDefault(); void copy(); }}>
          <label>Your name<input ref={nameField} type="text" maxLength={80} placeholder="Name (optional)" value={data.name} onChange={(event) => setData({ ...data, name: event.target.value })} /></label>
          <label>When would you like to travel?<input type="month" value={data.month} min={new Date().toISOString().slice(0, 7)} onChange={(event) => setData({ ...data, month: event.target.value })} /></label>
          <label>Travelers<select value={data.travelers} onChange={(event) => setData({ ...data, travelers: event.target.value })}>
            <option>1 adult</option><option>2 adults</option><option>3 adults</option><option>4 adults</option><option>Family / group</option>
          </select></label>
          <label>What are you celebrating?<select value={data.style} onChange={(event) => setData({ ...data, style: event.target.value })}>
            <option>Relaxed luxury escape</option><option>Honeymoon</option><option>Anniversary</option><option>Family holiday</option><option>Adventure & culture</option>
          </select></label>
          <div className="enquiry-preview">
            <span className="preview-label">Your enquiry preview</span>
            <textarea readOnly aria-label="Prepared enquiry message" value={text} rows={7} />
          </div>
          <div className="dialog-actions">
            <button className="solid-button dark-button" type="submit">Copy enquiry <ArrowIcon /></button>
            {whatsapp ? (
              <a className="text-link dark-link" href={whatsapp} target="_blank" rel="noopener noreferrer">Open WhatsApp <ArrowIcon diagonal /></a>
            ) : (
              <span className="demo-note">WhatsApp contact pending agency setup</span>
            )}
          </div>
          <p className="copy-status" aria-live="polite">{copyMessage}</p>
        </form>
      </section>
    </div>
  );
}

export default function App() {
  const [stage, setStage] = useState<JourneyStage>(0);
  const [selected, setSelected] = useState<DestinationId>('maldives');
  const [menuOpen, setMenuOpen] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const reducedMotion = useReducedMotion();
  const destination = destinationById(selected);

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (dialogOpen) { setDialogOpen(false); return; }
        if (menuOpen) { setMenuOpen(false); return; }
        setStage((current) => (current > 0 ? (current - 1) as JourneyStage : current));
      }
      if (dialogOpen || event.target instanceof HTMLInputElement || event.target instanceof HTMLSelectElement || event.target instanceof HTMLTextAreaElement) return;
      if (event.key === 'ArrowRight' && stage < 2) setStage((stage + 1) as JourneyStage);
      if (event.key === 'ArrowLeft' && stage > 0) setStage((stage - 1) as JourneyStage);
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [stage, dialogOpen, menuOpen]);

  const choose = (id: DestinationId, nextStage: JourneyStage = 1) => {
    setSelected(id);
    setStage(nextStage);
    window.scrollTo({ top: 0, behavior: reducedMotion ? 'instant' : 'smooth' });
  };

  return (
    <>
      <div className={`site stage-${stage} destination-${selected}`}>
        <section className="immersive" id="home" aria-label="Explore destinations">
          <div className="hero-noise" aria-hidden="true" />
          <div className="orbital-glow" aria-hidden="true" />
          <div className="hero-grid" aria-hidden="true" />
          <div className="ghost-word" aria-hidden="true">ELSEWHERE</div>

          <div className="globe-shell">
            <GlobeCanvas stage={stage} destinationId={selected} reducedMotion={reducedMotion} onTap={() => setStage(1)} />
          </div>
          <div className="arrival-bg" style={{ backgroundImage: `url("${destination.image}")` }} aria-hidden="true" />
          <div className="arrival-tint" aria-hidden="true" />
          <div className="arrival-sweep" aria-hidden="true" />

          <header className="main-nav">
            <a className="brand-anchor" href="#home" onClick={() => { setStage(0); setMenuOpen(false); }}><Brand /></a>
            <nav className={menuOpen ? 'nav-links nav-open' : 'nav-links'} aria-label="Main navigation">
              <a href="#destinations" onClick={() => setMenuOpen(false)}>Destinations</a>
              <a href="#approach" onClick={() => setMenuOpen(false)}>Our approach</a>
              <button type="button" onClick={() => { setDialogOpen(true); setMenuOpen(false); }}>Plan a journey <ArrowIcon diagonal /></button>
            </nav>
            <div className="nav-end">
              <span className="nav-location"><span className="status-dot" /> Hyderabad, India</span>
              <button className="nav-menu" type="button" onClick={() => setMenuOpen(!menuOpen)} aria-label={menuOpen ? 'Close navigation' : 'Open navigation'} aria-expanded={menuOpen}>{menuOpen ? <CloseIcon /> : <span className="hamburger"><i /><i /></span>}</button>
            </div>
          </header>

          <div className="hero-stage orbit-stage" aria-hidden={stage !== 0}>
            <span className="eyebrow"><span className="eyebrow-line" /> Discover beautifully different places</span>
            <h1>Go beyond<br />the <em>ordinary.</em></h1>
            <p>Curated journeys for people who would rather collect moments than miles.</p>
            <div className="orbit-actions">
              <button className="solid-button" type="button" onClick={() => setStage(1)}>Explore the world <ArrowIcon /></button>
              <a className="subtle-link" href="#destinations">See our escapes <ArrowIcon diagonal /></a>
            </div>
          </div>

          <div className="hero-stage locate-stage" aria-hidden={stage !== 1}>
            <div className="locate-left">
              <span className="eyebrow"><span className="eyebrow-line" /> Choose where to disappear</span>
              <h2>The world is<br /><em>wide open.</em></h2>
              <p>Some places change your perspective. A few change the way you feel.</p>
              <span className="latitude">DESTINATION / {destination.coordinates}</span>
            </div>
            <div className="destination-picker" aria-label="Select a destination">
              <p className="picker-label">Featured escapes <span>02 / 02</span></p>
              {destinations.map((item, index) => (
                <button key={item.id} className={`picker-card ${selected === item.id ? 'picker-active' : ''}`} type="button" onClick={() => setSelected(item.id)} aria-pressed={selected === item.id}>
                  <span className="picker-index">0{index + 1}</span>
                  <span className="picker-info"><strong>{item.name}</strong><small>{item.country}</small></span>
                  <span className="picker-arrow"><ArrowIcon diagonal /></span>
                </button>
              ))}
              <button className="solid-button picker-continue" type="button" onClick={() => setStage(2)}>Experience {destination.name} <ArrowIcon /></button>
            </div>
          </div>

          <div className="hero-stage arrive-stage" aria-hidden={stage !== 2}>
            <div className="arrival-copy">
              <span className="eyebrow"><span className="eyebrow-line" /> {destination.eyebrow}</span>
              <span className="arrival-geo">{destination.coordinates}</span>
              <h2>{destination.name}<span className="arrival-period">.</span></h2>
              <p>{destination.headline}</p>
              <div className="arrival-actions">
                <button type="button" className="solid-button" onClick={() => setDialogOpen(true)}>Design my escape <ArrowIcon /></button>
                <button type="button" className="subtle-link inline-button" onClick={() => setStage(1)}>Back to the globe <ArrowIcon diagonal /></button>
              </div>
            </div>
            <div className="arrival-caption"><span>THE EXPERIENCE</span><span>01 / {destination.code}</span></div>
          </div>

          <div className="hero-side-label" aria-hidden="true">AN AERIVA WAY TO SEE THE WORLD&nbsp; / &nbsp; EST. IN IMAGINATION</div>
          <div className="hero-progress" aria-label="Experience stages">
            {steps.map((step, index) => (
              <button type="button" key={step.title} className={stage === index ? 'progress-item progress-active' : 'progress-item'} onClick={() => setStage(index as JourneyStage)} aria-current={stage === index ? 'step' : undefined}>
                <span className="progress-number">0{index + 1}</span><span className="progress-content"><strong>{step.title}</strong><small>{step.description}</small></span><span className="progress-bar" />
              </button>
            ))}
          </div>
          <div className="hero-bottom">
            <span className="concept-label">A CONCEPT TRAVEL EXPERIENCE</span>
            <span className="drag-hint">{stage === 0 ? 'DRAG THE GLOBE TO EXPLORE' : stage === 1 ? 'SELECT A DESTINATION TO CONTINUE' : 'SCROLL TO DISCOVER MORE'}</span>
            <a href="#destinations" aria-label="Scroll to destinations" className="scroll-indicator"><span /><span /></a>
          </div>
        </section>

        <main>
          <section className="intro-block" id="destinations">
            <div className="section-headline"><span className="section-kicker"><i /> DESTINATIONS / 001</span><h2>Not just places.<br /><em>New perspectives.</em></h2></div>
            <div className="intro-right"><p>Every remarkable journey starts with curiosity. Follow yours to moments that stay long after you return.</p><span>EXPLORE THE COLLECTION <ArrowIcon diagonal /></span></div>
          </section>

          <section className="editorial-cards" aria-label="Featured destinations">
            {destinations.map((item, index) => (
              <article key={item.id} className={`editorial-card editorial-${item.id}`}>
                <div className="editorial-image" style={{ backgroundImage: `url("${item.image}")` }} role="img" aria-label={`Scenic landscape representing ${item.name}`} />
                <div className="editorial-gradient" />
                <div className="editorial-top"><span>0{index + 1} / FEATURED ESCAPE</span><span>{item.coordinates}</span></div>
                <div className="editorial-body"><span className="editorial-region">{item.country}</span><h3>{item.name}</h3><p>{item.summary}</p><button type="button" onClick={() => choose(item.id, 2)} aria-label={`Experience ${item.name}`}><ArrowIcon diagonal /></button></div>
              </article>
            ))}
          </section>

          <section className="manifesto" id="approach">
            <div className="manifesto-label"><span className="section-kicker"><i /> THE AERIVA PHILOSOPHY / 002</span><span className="asterisk">✳</span></div>
            <div className="manifesto-content"><h2>Travel should<br />make you <em>feel.</em></h2><p>Less rushing. More noticing. We imagine escapes built around your pace, your people, and the experiences you came for.</p><div className="manifesto-points"><div><span>01</span><strong>Thoughtfully curated</strong><small>Experiences shaped around you, never a one-size-fits-all checklist.</small></div><div><span>02</span><strong>Beautifully considered</strong><small>Space to explore, stay present, and enjoy the details.</small></div><div><span>03</span><strong>Easy from Hyderabad</strong><small>A single starting point for planning your international escape.</small></div></div></div>
          </section>

          <section className="feature-band"><div className="feature-photo" style={{ backgroundImage: `url("${destinationById('maldives').tileImage}")` }} role="img" aria-label="Tropical coast and blue water" /><div className="feature-copy"><span className="section-kicker"><i /> THE BEAUTY OF BEING AWAY / 003</span><h2>There is more<br />to <em>the moment.</em></h2><p>Open skies. Quiet mornings. A view worth leaving your phone behind for. The best journeys are the ones you really get to live.</p><button type="button" className="text-link" onClick={() => choose('maldives', 2)}>Experience the Maldives <ArrowIcon diagonal /></button></div></section>

          <section className="closing" id="inquiry"><div className="closing-orbit" aria-hidden="true" /><span className="section-kicker light-kicker"><i /> YOUR NEXT STORY / 004</span><h2>Leave room<br />for <em>wonder.</em></h2><p>Your next extraordinary escape begins with a simple conversation.</p><button type="button" className="solid-button" onClick={() => setDialogOpen(true)}>Start planning <ArrowIcon /></button><div className="closing-foot"><Brand /><span>CONCEPT SHOWCASE · HYDERABAD, INDIA</span><a href="#home" onClick={() => setStage(0)}>Back to top ↑</a></div></section>
        </main>
      </div>
      {dialogOpen && <InquiryDialog key={selected} destinationId={selected} onClose={() => setDialogOpen(false)} />}
    </>
  );
}
