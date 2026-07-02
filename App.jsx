import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import Papa from 'papaparse';
import { Camera, Search, Wine, Plus, Minus, ChevronLeft, AlertCircle } from 'lucide-react';
import './style.css';

const CSV_PATH = '/cellartracker_seed_inventory.csv';

function clean(value) {
  return String(value ?? '').replace(/^\uFEFF/, '').trim();
}

function keyName(key) {
  return clean(key).toLowerCase().replace(/[_\s-]/g, '');
}

function pick(row, names) {
  const wanted = names.map(keyName);
  for (const [key, value] of Object.entries(row)) {
    if (wanted.includes(keyName(key))) return clean(value);
  }
  return '';
}

function wineFromRow(row, index) {
  const quantity = Number(pick(row, ['quantity', 'qty', 'count'])) || 0;
  const vintage = pick(row, ['vintage', 'year']);
  const producer = pick(row, ['producer']);
  const wineName = pick(row, ['wine_name', 'wineName', 'wine', 'name', 'full_name', 'fullName']);
  const fullName = pick(row, ['full_name', 'fullName']) || wineName;

  return {
    id: index + 1,
    quantity,
    vintage,
    producer,
    name: wineName || fullName,
    fullName,
    category: pick(row, ['category']),
    colour: pick(row, ['colour', 'color', 'type']),
    country: pick(row, ['country']),
    region: pick(row, ['region']),
    subregion: pick(row, ['subregion']),
    appellation: pick(row, ['appellation']),
    locationText: pick(row, ['location_text', 'locationText']),
    size: pick(row, ['bottle_size', 'bottleSize', 'size']) || '750ml',
    storageLocation: pick(row, ['storage_location', 'storageLocation']) || 'Not set yet',
    drinkFrom: pick(row, ['drink_from', 'drinkFrom']),
    drinkTo: pick(row, ['drink_to', 'drinkTo']),
    notes: pick(row, ['notes'])
  };
}

function App() {
  const [wines, setWines] = useState([]);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState(null);
  const [scan, setScan] = useState(false);
  const [status, setStatus] = useState('Loading CellarTracker seed inventory…');
  const [error, setError] = useState('');

  useEffect(() => {
    async function loadInventory() {
      try {
        const response = await fetch(`${CSV_PATH}?v=${Date.now()}`);
        if (!response.ok) throw new Error(`Could not load ${CSV_PATH} (${response.status})`);
        const text = await response.text();
        const parsed = Papa.parse(text, { header: true, skipEmptyLines: true });
        if (parsed.errors?.length) console.warn('CSV parse warnings:', parsed.errors);
        const loaded = parsed.data
          .map(wineFromRow)
          .filter(wine => wine.quantity > 0 || wine.name || wine.fullName);
        setWines(loaded);
        setStatus(`${loaded.length} wines imported from CellarTracker`);
      } catch (err) {
        setError(err.message || String(err));
        setStatus('Inventory not loaded');
      }
    }
    loadInventory();
  }, []);

  const totalBottles = wines.reduce((sum, wine) => sum + wine.quantity, 0);
  const countries = new Set(wines.map(w => w.country).filter(Boolean)).size;
  const filtered = useMemo(() => {
    const needle = query.toLowerCase().trim();
    if (!needle) return wines;
    return wines.filter(wine => Object.values(wine).join(' ').toLowerCase().includes(needle));
  }, [query, wines]);

  function changeQuantity(id, delta) {
    setWines(current => current.map(wine => wine.id === id ? { ...wine, quantity: Math.max(0, wine.quantity + delta) } : wine));
    setSelected(current => current?.id === id ? { ...current, quantity: Math.max(0, current.quantity + delta) } : current);
  }

  if (selected) return <WineDetail wine={selected} onBack={() => setSelected(null)} onChangeQuantity={changeQuantity} />;
  if (scan) return <ScanPrototype wines={wines} onBack={() => setScan(false)} onOpen={setSelected} />;

  return (
    <main>
      <header className="hero">
        <div>
          <p className="eyebrow">My Cellar</p>
          <h1>{totalBottles.toLocaleString()} bottles</h1>
          <p>{status}</p>
        </div>
        <Wine size={50} />
      </header>

      {error && <section className="error"><AlertCircle /> {error}</section>}

      <section className="stats">
        <div><strong>{wines.length}</strong><span>wines</span></div>
        <div><strong>{countries}</strong><span>countries</span></div>
        <div><strong>{filtered.length}</strong><span>shown</span></div>
      </section>

      <section className="actions">
        <button onClick={() => setScan(true)}><Camera /> Scan bottle</button>
        <button><Plus /> Add wine</button>
      </section>

      <label className="search">
        <Search />
        <input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search producer, vintage, region…" />
      </label>

      <section className="list">
        {filtered.map(wine => <WineCard key={wine.id} wine={wine} onClick={() => setSelected(wine)} />)}
      </section>
    </main>
  );
}

function WineCard({ wine, onClick }) {
  return (
    <button className="card" onClick={onClick}>
      <div>
        <strong>{[wine.vintage, wine.producer || wine.fullName].filter(Boolean).join(' ')}</strong>
        <span>{wine.producer ? wine.name : ''}</span>
        <small>{[wine.colour, wine.country, wine.region, wine.subregion, wine.appellation].filter(Boolean).join(' · ')}</small>
      </div>
      <b>{wine.quantity}</b>
    </button>
  );
}

function WineDetail({ wine, onBack, onChangeQuantity }) {
  return (
    <main>
      <button className="back" onClick={onBack}><ChevronLeft /> Back</button>
      <section className="detail">
        <p className="eyebrow">{wine.category || wine.colour || 'Wine'}</p>
        <h1>{[wine.vintage, wine.producer || wine.fullName].filter(Boolean).join(' ')}</h1>
        {wine.producer && <h2>{wine.name}</h2>}
        <p>{[wine.colour, wine.country, wine.region, wine.subregion, wine.appellation].filter(Boolean).join(' · ')}</p>
        <div className="qty">{wine.quantity}<span>bottles</span></div>
        <div className="actions">
          <button onClick={() => onChangeQuantity(wine.id, -1)}><Minus /> Drink one</button>
          <button onClick={() => onChangeQuantity(wine.id, 1)}><Plus /> Add one</button>
        </div>
        <dl>
          <dt>Bottle size</dt><dd>{wine.size}</dd>
          <dt>Cellar location</dt><dd>{wine.storageLocation}</dd>
          <dt>Original location text</dt><dd>{wine.locationText || 'Not set yet'}</dd>
          <dt>Drinking window</dt><dd>{wine.drinkFrom || wine.drinkTo ? `${wine.drinkFrom || '?'}–${wine.drinkTo || '?'}` : 'Not set yet'}</dd>
        </dl>
      </section>
    </main>
  );
}

function ScanPrototype({ wines, onBack, onOpen }) {
  const [text, setText] = useState('');
  const matches = wines
    .filter(wine => Object.values(wine).join(' ').toLowerCase().includes(text.toLowerCase()))
    .slice(0, 10);

  return (
    <main>
      <button className="back" onClick={onBack}><ChevronLeft /> Back</button>
      <section className="detail">
        <Camera size={44} />
        <h1>Scan bottle prototype</h1>
        <p>For v0.1, type label text. Next sprint will replace this with camera OCR.</p>
        <input className="biginput" value={text} onChange={event => setText(event.target.value)} placeholder="Try: Meerlust Rubicon 2021" autoFocus />
        {text && matches.map(wine => <WineCard key={wine.id} wine={wine} onClick={() => onOpen(wine)} />)}
      </section>
    </main>
  );
}

createRoot(document.getElementById('root')).render(<App />);
