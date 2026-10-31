import { useEffect, useRef, useState } from 'react';
import GlobeCanvas from './components/GlobeCanvas';
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

function Brand() {
  return (
    <span className="brand" aria-label="AERIVA Journeys">
      <svg className="brand-mark" viewBox="0 0 36 36" fill="none" aria-hidden="true">
        <circle cx="18" cy="18" r="15.5" stroke="currentColor" strokeWidth="1.2" />
        <path d="M7 23c5-2 9-7 13-15m-4 17c3-7 7-11 13-12M8 26c8-3 15-5 21-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        <circle cx="28" cy="12" r="2" fill="currentColor" />
      </svg>
      <span className="brand-text"><strong>AERIVA</strong><small>JOURNEYS</small></span>
    </span>
  );
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
          <span className="eyebrow">Your next chapter</span>
          <button className="icon-button close-dialog" type="button" onClick={onClose} aria-label="Close enquiry"><CloseIcon /></button>
        </div>
        <h2 id="inquiry-title">Let’s plan <em>{destination.name}</em> for you.</h2>
        <p>Tell us what you have in mind. This portfolio showcase prepares an enquiry message; it does not book a trip or transmit private data.</p>
        <form className="inquiry-form" onSubmit={(event) => { event.preventDefault(); void copy(); }}>
          <label>Your name<input ref={nameField} type="text" maxLength={80} placeholder="Name (optional)" value={data.name} onChange={(event) => setData({ ...data, name: event.target.value })} /></label>
          <label>When would you like to travel?<input type="month" value={data.month} min={new Date().toISOString().slice(0, 7)} onChange={(event) => setData({ ...data, month: event.target.value })} /></label>
          <label>Travelers<select value={data.travelers} onChange={(event) => setData({ ...data, travelers: event.target.value })}>
            <option>1 adult</option><option>2 adults</option><option>3 adults</option><option>4 adults</option><option>Family / group</option>
          </select></label>
          <label>Style of journey<select value={data.style} onChange={(event) => setData({ ...data, style: event.target.value })}>
            <option>Relaxed luxury escape</option><option>Honeymoon</option><option>Anniversary</option><option>Family holiday</option><option>Adventure & culture</option>
          </select></label>
          <div className="enquiry-preview">
            <span className="preview-label">Your prepared enquiry</span>
            <textarea readOnly aria-label="Prepared enquiry message" value={text} rows={6} />
          </div>
          <div className="dialog-actions">
            <button className="primary-btn" type="submit">Copy enquiry <ArrowIcon /></button>
            {whatsapp ? (
              <a className="secondary-link" href={whatsapp} target="_blank" rel="noopener noreferrer">Open WhatsApp <ArrowIcon diagonal /></a>
            ) : (
              <span className="demo-note">WhatsApp contact ready upon agency setup</span>
            )}
          </div>
          <p className="copy-status" aria-live="polite">{copyMessage}</p>
        </form>
      </section>
    </div>
  );
}

export type ViewMode = 'editorial' | 'destination' | 'globe';

export default function App() {
  const [view, setView] = useState<ViewMode>('editorial');
  const [selected, setSelected] = useState<DestinationId>('maldives');
  const [menuOpen, setMenuOpen] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const destination = destinationById(selected);

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (dialogOpen) { setDialogOpen(false); return; }
        if (menuOpen) { setMenuOpen(false); return; }
        if (view !== 'editorial') { setView('editorial'); return; }
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [view, dialogOpen, menuOpen]);

  const selectDestination = (id: DestinationId) => {
    setSelected(id);
    setView('destination');
  };

  return (
    <>
      <div className={`site view-${view} dest-${selected}`}>
        {/* 84px LUXURY EDITORIAL TOP NAVIGATION */}
        <header className="main-nav">
          <a
            className="brand-anchor"
            href="#home"
            onClick={(e) => { e.preventDefault(); setView('editorial'); setMenuOpen(false); }}
          >
            <Brand />
          </a>

          <nav className={menuOpen ? 'nav-links nav-open' : 'nav-links'} aria-label="Main navigation">
            <button
              type="button"
              className={view === 'destination' ? 'nav-item nav-item-active' : 'nav-item'}
              onClick={() => { setView('destination'); setMenuOpen(false); }}
            >
              Destinations
            </button>
            <a href="#approach" className="nav-item" onClick={() => setMenuOpen(false)}>
              Our approach
            </a>
            <button
              type="button"
              className={view === 'globe' ? 'nav-item nav-item-active' : 'nav-item'}
              onClick={() => { setView(view === 'globe' ? 'editorial' : 'globe'); setMenuOpen(false); }}
            >
              3D Globe
            </button>
          </nav>

          <div className="nav-end">
            <span className="nav-origin">Departure / Hyderabad</span>
            <button
              className="nav-cta-btn"
              type="button"
              onClick={() => { setDialogOpen(true); setMenuOpen(false); }}
            >
              Plan a journey <ArrowIcon diagonal />
            </button>
            <button
              className="nav-menu"
              type="button"
              onClick={() => setMenuOpen(!menuOpen)}
              aria-label={menuOpen ? 'Close navigation' : 'Open navigation'}
              aria-expanded={menuOpen}
            >
              {menuOpen ? <CloseIcon /> : <span className="hamburger"><i /><i /></span>}
            </button>
          </div>
        </header>

        {/* HERO SECTION: 42/58 EDITORIAL SPLIT (STATIC DESIGN-FIRST COMPOSITION) */}
        {view === 'editorial' && (
          <section className="editorial-hero" id="home" aria-label="AERIVA Journeys Overview">
            <div className="hero-grid-split">
              {/* 42% LEFT COLUMN: TYPOGRAPHIC EDITORIAL HIERARCHY */}
              <div className="hero-text-col">
                <span className="hero-eyebrow">
                  <span className="eyebrow-line" /> CURATED ESCAPES · FROM HYDERABAD
                </span>

                <h1 className="hero-headline">
                  Go somewhere<br />
                  <em>extraordinary.</em>
                </h1>

                <p className="hero-standfirst">
                  Thoughtful journeys, beautifully planned for you. Private islands, quiet sanctuaries, and moments that stay long after you return.
                </p>

                <div className="hero-actions">
                  <button
                    className="primary-btn"
                    type="button"
                    onClick={() => selectDestination('maldives')}
                  >
                    Explore destinations <ArrowIcon />
                  </button>
                  <button
                    className="secondary-btn"
                    type="button"
                    onClick={() => setDialogOpen(true)}
                  >
                    Plan my trip <ArrowIcon diagonal />
                  </button>
                </div>
              </div>

              {/* 58% RIGHT COLUMN: GENUINE EDITORIAL TRAVEL PHOTOGRAPHY */}
              <div className="hero-visual-col">
                <div className="hero-media-wrapper">
                  <img
                    src={destination.image}
                    alt="Scenic aerial view of Maldives turquoise lagoon and overwater resort villas"
                    className="hero-media-img"
                  />
                  <div className="media-meta-bar">
                    <span className="meta-tag">01 / FEATURED ESCAPE</span>
                    <span className="meta-coord">{destination.coordinates}</span>
                  </div>
                  <button
                    type="button"
                    className="media-affordance"
                    onClick={() => setView('globe')}
                    aria-label="Open 3D spatial globe view"
                  >
                    <span>Spatial 3D Globe ↗</span>
                  </button>
                </div>
              </div>
            </div>

            {/* RESTRAINED DESTINATION INDEX ALONG THE FIRST FOLD BOTTOM */}
            <div className="hero-index-bar">
              <div className="index-destinations">
                {destinations.map((dest, idx) => (
                  <button
                    key={dest.id}
                    type="button"
                    className={`index-item ${selected === dest.id ? 'index-item-active' : ''}`}
                    onClick={() => selectDestination(dest.id)}
                  >
                    <span className="index-num">0{idx + 1}</span>
                    <span className="index-name">{dest.name}</span>
                    <span className="index-region">{dest.country}</span>
                  </button>
                ))}
              </div>
              <a href="#destinations" className="index-explore-all">
                View all escapes <ArrowIcon diagonal />
              </a>
            </div>
          </section>
        )}

        {/* DESTINATION VIEW: FOCUSED EDITORIAL DESTINATION SPREAD */}
        {view === 'destination' && (
          <section className="destination-hero" id="home" aria-label={`Featured Destination: ${destination.name}`}>
            <div className="destination-layout">
              {/* Back & Switcher Control */}
              <div className="destination-nav-bar">
                <button
                  type="button"
                  className="dest-back-btn"
                  onClick={() => setView('editorial')}
                >
                  ← Back to overview
                </button>
                <div className="dest-switcher">
                  {destinations.map((item, i) => (
                    <button
                      key={item.id}
                      type="button"
                      className={`dest-tab-btn ${selected === item.id ? 'dest-tab-active' : ''}`}
                      onClick={() => setSelected(item.id)}
                    >
                      0{i + 1} {item.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* Editorial 2-column Destination Spread */}
              <div className="destination-content-grid">
                <div className="dest-media-frame">
                  <img
                    src={destination.image}
                    alt={`Scenic landscape representing ${destination.name}`}
                    className="dest-photo"
                  />
                  <div className="dest-photo-meta">
                    <span>{destination.coordinates}</span>
                    <span>{destination.country}</span>
                  </div>
                </div>

                <div className="dest-copy-card">
                  <span className="hero-eyebrow">
                    <span className="eyebrow-line" /> {destination.eyebrow}
                  </span>
                  <h2 className="dest-title">
                    {destination.name}<em>.</em>
                  </h2>
                  <p className="dest-headline">
                    {destination.headline}
                  </p>
                  <p className="dest-body">
                    {destination.description}
                  </p>

                  <div className="dest-highlights">
                    <span className="highlight-label">CURATED EXPERIENCES</span>
                    <div className="highlight-tags">
                      {destination.moments.map((moment) => (
                        <span key={moment} className="moment-tag">✦ {moment}</span>
                      ))}
                    </div>
                  </div>

                  <div className="dest-actions">
                    <button
                      type="button"
                      className="primary-btn"
                      onClick={() => setDialogOpen(true)}
                    >
                      Plan my {destination.name} trip <ArrowIcon />
                    </button>
                    {selected === 'bali' && (
                      <span className="dest-status-badge">
                        Concept Showcase · Hyderabad departures
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* 3D SPATIAL GLOBE DISCOVERY VIEW (PURPOSEFUL OPTIONAL INTERACTION) */}
        {view === 'globe' && (
          <section className="globe-discovery-section" id="home" aria-label="3D Globe Exploration">
            <div className="globe-discovery-header">
              <button
                type="button"
                className="dest-back-btn"
                onClick={() => setView('editorial')}
              >
                ← Return to editorial photography
              </button>
              <span className="globe-discovery-title">
                Interactive Planetary Explorer · Hyderabad Departure Route
              </span>
            </div>
            <div className="globe-discovery-canvas-wrap">
              <GlobeCanvas
                stage={0}
                destinationId={selected}
                reducedMotion={true}
                onTap={() => selectDestination('maldives')}
              />
            </div>
            <div className="globe-discovery-footer">
              <span>DRAG TO EXPLORE ORBIT</span>
              <button
                type="button"
                className="secondary-btn"
                onClick={() => selectDestination('maldives')}
              >
                View Maldives Photography <ArrowIcon />
              </button>
            </div>
          </section>
        )}

        {/* MAIN BODY SECTIONS: UNIFIED QUIET LUXURY EDITORIAL SYSTEM */}
        <main>
          {/* Section 001: Destinations */}
          <section className="intro-block" id="destinations">
            <div className="section-headline">
              <span className="section-kicker"><i /> DESTINATIONS / 001</span>
              <h2>Not just places.<br /><em>New perspectives.</em></h2>
            </div>
            <div className="intro-right">
              <p>Every remarkable journey starts with curiosity. Follow yours to moments that stay long after you return.</p>
              <button
                type="button"
                className="secondary-btn"
                onClick={() => selectDestination('maldives')}
              >
                Explore the collection <ArrowIcon diagonal />
              </button>
            </div>
          </section>

          {/* Editorial Destination Feature Cards */}
          <section className="editorial-cards" aria-label="Featured destinations">
            {destinations.map((item, index) => (
              <article key={item.id} className={`editorial-card editorial-${item.id}`}>
                <div
                  className="editorial-image"
                  style={{ backgroundImage: `url("${item.image}")` }}
                  role="img"
                  aria-label={`Scenic landscape representing ${item.name}`}
                />
                <div className="editorial-top">
                  <span>0{index + 1} / FEATURED ESCAPE</span>
                  <span>{item.coordinates}</span>
                </div>
                <div className="editorial-body">
                  <span className="editorial-region">{item.country}</span>
                  <h3>{item.name}</h3>
                  <p>{item.summary}</p>
                  <button
                    type="button"
                    onClick={() => selectDestination(item.id)}
                    aria-label={`Experience ${item.name}`}
                    className="card-explore-btn"
                  >
                    View escape <ArrowIcon diagonal />
                  </button>
                </div>
              </article>
            ))}
          </section>

          {/* Section 002: Manifesto / Philosophy */}
          <section className="manifesto" id="approach">
            <div className="manifesto-label">
              <span className="section-kicker"><i /> THE AERIVA PHILOSOPHY / 002</span>
              <span className="asterisk">✳</span>
            </div>
            <div className="manifesto-content">
              <h2>Travel should<br />make you <em>feel.</em></h2>
              <p>Less rushing. More noticing. We imagine escapes built around your pace, your people, and the experiences you came for.</p>
              <div className="manifesto-points">
                <div>
                  <span>01</span>
                  <strong>Thoughtfully curated</strong>
                  <small>Experiences shaped around you, never a one-size-fits-all checklist.</small>
                </div>
                <div>
                  <span>02</span>
                  <strong>Beautifully considered</strong>
                  <small>Space to explore, stay present, and enjoy the authentic details.</small>
                </div>
                <div>
                  <span>03</span>
                  <strong>Easy from Hyderabad</strong>
                  <small>A single, unhurried starting point for planning your international escape.</small>
                </div>
              </div>
            </div>
          </section>

          {/* Section 003: Feature Band */}
          <section className="feature-band">
            <div
              className="feature-photo"
              style={{ backgroundImage: `url("${destinationById('maldives').tileImage}")` }}
              role="img"
              aria-label="Tropical coast and turquoise water"
            />
            <div className="feature-copy">
              <span className="section-kicker"><i /> THE ART OF BEING AWAY / 003</span>
              <h2>There is more<br />to <em>the moment.</em></h2>
              <p>Open skies. Quiet mornings. A view worth leaving your phone behind for. The best journeys are the ones you really get to live.</p>
              <button
                type="button"
                className="secondary-btn"
                onClick={() => selectDestination('maldives')}
              >
                Experience the Maldives <ArrowIcon diagonal />
              </button>
            </div>
          </section>

          {/* Section 004: Closing & Contact */}
          <section className="closing" id="inquiry">
            <span className="section-kicker"><i /> YOUR NEXT STORY / 004</span>
            <h2>Leave room<br />for <em>wonder.</em></h2>
            <p>Your next extraordinary escape begins with a simple conversation.</p>
            <button
              type="button"
              className="primary-btn"
              onClick={() => setDialogOpen(true)}
            >
              Start planning <ArrowIcon />
            </button>
            <div className="closing-foot">
              <Brand />
              <span className="closing-meta">PORTFOLIO SHOWCASE · HYDERABAD, INDIA</span>
              <a href="#home" onClick={() => setView('editorial')} className="back-to-top">
                Back to top ↑
              </a>
            </div>
          </section>
        </main>
      </div>

      {dialogOpen && (
        <InquiryDialog
          key={selected}
          destinationId={selected}
          onClose={() => setDialogOpen(false)}
        />
      )}
    </>
  );
}
