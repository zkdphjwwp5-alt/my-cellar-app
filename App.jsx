import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Camera, Search, Wine, Plus, Minus, ChevronLeft, AlertCircle, RefreshCw } from 'lucide-react';
import { supabase } from './supabase.js';
import './style.css';

function clean(value) {
  return String(value ?? '').replace(/^\uFEFF/, '').trim();
}

function wineFromDatabase(row) {
  const vintage = clean(row.vintage);
  const producer = clean(row.producer);
  const wineName = clean(row.wine_name);
  const fullName = [producer, wineName].filter(Boolean).join(' ') || wineName || 'Unnamed wine';

  return {
    id: row.id,
    quantity: Number(row.quantity) || 0,
    vintage,
    producer,
    name: wineName || fullName,
    fullName,
    category: clean(row.category),
    colour: clean(row.colour),
    country: clean(row.country),
    region: clean(row.region),
    subregion: clean(row.subregion),
    appellation: clean(row.appellation),
    locationText: [row.country, row.region, row.subregion, row.appellation].map(clean).filter(Boolean).join(', '),
    size: clean(row.bottle_size) || '750ml',
    storageLocation: clean(row.storage_location) || 'Not set yet',
    drinkFrom: clean(row.drinking_from),
    drinkTo: clean(row.drinking_to),
    notes: clean(row.notes),
    photoUrl: clean(row.photo_url)
  };
}

function App() {
  const [wines, setWines] = useState([]);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState(null);
  const [scan, setScan] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  async function loadWines() {
    setLoading(true);
    setLoadError('');

    const { data, error } = await supabase
      .from('wines')
      .select('*')
      .order('wine_name', { ascending: true });

    if (error) {
      console.error('Supabase load error:', error);
      setLoadError('Unable to connect to the cellar database.');
      setWines([]);
      setLoading(false);
      return;
    }

    setWines((data || []).map(wineFromDatabase));
    setLoading(false);
  }

  useEffect(() => {
    loadWines();
  }, []);

  const totalBottles = wines.reduce((sum, wine) => sum + wine.quantity, 0);
  const countries = new Set(wines.map(w => w.country).filter(Boolean)).size;

  const filtered = useMemo(() => {
    const needle = query.toLowerCase().trim();
    if (!needle) return wines;
    return wines.filter(wine => Object.values(wine).join(' ').toLowerCase().includes(needle));
  }, [query, wines]);

  async function changeQuantity(id, delta) {
    const currentWine = wines.find(wine => wine.id === id);
    if (!currentWine) return;

    const previousQuantity = currentWine.quantity;
    const nextQuantity = Math.max(0, previousQuantity + delta);

    setWines(current => current.map(wine => wine.id === id ? { ...wine, quantity: nextQuantity } : wine));
    setSelected(current => current?.id === id ? { ...current, quantity: nextQuantity } : current);

    const { error } = await supabase
      .from('wines')
      .update({ quantity: nextQuantity, updated_at: new Date().toISOString() })
      .eq('id', id);

    if (error) {
      console.error('Supabase quantity update error:', error);
      setWines(current => current.map(wine => wine.id === id ? { ...wine, quantity: previousQuantity } : wine));
      setSelected(current => current?.id === id ? { ...current, quantity: previousQuantity } : current);
      setLoadError('The bottle count could not be saved. Please try again.');
    }
  }

  if (selected) return <WineDetail wine={selected} onBack={() => setSelected(null)} onChangeQuantity={changeQuantity} />;
  if (scan) return <ScanPrototype wines={wines} onBack={() => setScan(false)} onOpen={setSelected} />;

  return (
    <main>
      <header className="hero">
        <div>
          <p className="eyebrow">My Cellar</p>
          <h1>{loading ? 'Loading…' : `${totalBottles.toLocaleString()} bottles`}</h1>
          <p>{loading ? 'Connecting to Supabase' : `${wines.length} wines loaded from Supabase`}</p>
        </div>
        <Wine size={50} />
      </header>

      {loadError && (
        <section className="error">
          <AlertCircle />
          <div>
            <strong>Database issue</strong>
            <p>{loadError}</p>
            <button onClick={loadWines}><RefreshCw /> Try again</button>
          </div>
        </section>
      )}

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
        {loading && <div className="card"><div><strong>Loading wines…</strong><small>Reading from Supabase</small></div></div>}
        {!loading && filtered.length === 0 && <div className="card"><div><strong>No wines found</strong><small>Try a different search</small></div></div>}
        {!loading && filtered.map(wine => <WineCard key={wine.id} wine={wine} onClick={() => setSelected(wine)} />)}
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
    .filter(wine => text && Object.values(wine).join(' ').toLowerCase().includes(text.toLowerCase()))
    .slice(0, 10);

  return (
    <main>
      <button className="back" onClick={onBack}><ChevronLeft /> Back</button>
      <section className="detail">
        <Camera size={44} />
        <h1>Scan bottle prototype</h1>
        <p>For v0.2, type label text. A later release will replace this with camera OCR.</p>
        <input className="biginput" value={text} onChange={event => setText(event.target.value)} placeholder="Try: Meerlust Rubicon 2021" autoFocus />
        {text && matches.length === 0 && <p>No match yet. Try producer, vintage, or region.</p>}
        {matches.map(wine => <WineCard key={wine.id} wine={wine} onClick={() => onOpen(wine)} />)}
      </section>
    </main>
  );
}

createRoot(document.getElementById('root')).render(<App />);
