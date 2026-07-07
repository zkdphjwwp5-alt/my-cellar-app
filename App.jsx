import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Camera, Search, Wine, Plus, Minus, ChevronLeft, AlertCircle, RefreshCw } from 'lucide-react';
import { supabase } from './supabase.js';
import PhotoUploader from './PhotoUploader.jsx';
import './style.css';

const BUCKET_NAME = 'wine-photos';

function clean(value) {
  return String(value ?? '').trim();
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

function bestMatch(wines, extracted) {
  const terms = [extracted.vintage, extracted.producer, extracted.wine_name].map(clean).filter(Boolean);
  if (!terms.length) return null;
  const scored = wines.map(wine => {
    const haystack = Object.values(wine).join(' ').toLowerCase();
    const score = terms.reduce((sum, term) => sum + (haystack.includes(term.toLowerCase()) ? 1 : 0), 0);
    return { wine, score };
  }).sort((a, b) => b.score - a.score);
  return scored[0]?.score >= 2 ? scored[0].wine : null;
}

async function uploadScannedPhoto(file, wineId) {
  if (!file || !wineId) return '';
  const fileExtension = file.name.split('.').pop() || 'jpg';
  const filePath = `${wineId}/${Date.now()}.${fileExtension}`;
  const { error } = await supabase.storage.from(BUCKET_NAME).upload(filePath, file, {
    cacheControl: '3600',
    upsert: true
  });
  if (error) return '';
  const { data } = supabase.storage.from(BUCKET_NAME).getPublicUrl(filePath);
  return data?.publicUrl || '';
}

function App() {
  const [wines, setWines] = useState([]);
  const [query, setQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [showSort, setShowSort] = useState(false);
  const [filters, setFilters] = useState({ colour: '', country: '', region: '', producer: '', vintage: '', bottleSize: '', photo: '', stock: 'in-stock' });
  const [sortBy, setSortBy] = useState('producer');
  const [selected, setSelected] = useState(null);
  const [scan, setScan] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  async function loadWines() {
    setLoading(true);
    setLoadError('');
    const { data, error } = await supabase.from('wines').select('*').order('wine_name', { ascending: true });
    if (error) {
      setLoadError('Unable to connect to the cellar database.');
      setWines([]);
      setLoading(false);
      return;
    }
    setWines((data || []).map(wineFromDatabase));
    setLoading(false);
  }

  useEffect(() => { loadWines(); }, []);

  const totalBottles = wines.reduce((sum, wine) => sum + wine.quantity, 0);
  const countries = new Set(wines.map(w => w.country).filter(Boolean)).size;

  function uniqueValues(field) {
    return [...new Set(wines.map(wine => clean(wine[field])).filter(Boolean))].sort();
  }

  function updateFilter(field, value) {
    setFilters(current => ({ ...current, [field]: value }));
  }

  const filtered = useMemo(() => {
    const needle = query.toLowerCase().trim();

    let result = wines.filter(wine => {
      const searchMatch = !needle || Object.values(wine).join(' ').toLowerCase().includes(needle);
      const colourMatch = !filters.colour || wine.colour === filters.colour;
      const countryMatch = !filters.country || wine.country === filters.country;
      const regionMatch = !filters.region || wine.region === filters.region;
      const producerMatch = !filters.producer || wine.producer === filters.producer;
      const vintageMatch = !filters.vintage || wine.vintage === filters.vintage;
      const bottleSizeMatch = !filters.bottleSize || wine.size === filters.bottleSize;
      const photoMatch = !filters.photo || (filters.photo === 'has-photo' ? Boolean(wine.photoUrl) : !wine.photoUrl);
      const stockMatch = filters.stock !== 'in-stock' || wine.quantity > 0;
      return searchMatch && colourMatch && countryMatch && regionMatch && producerMatch && vintageMatch && bottleSizeMatch && photoMatch && stockMatch;
    });

    result = [...result].sort((a, b) => {
      if (sortBy === 'vintage') return clean(b.vintage).localeCompare(clean(a.vintage), undefined, { numeric: true });
      if (sortBy === 'country') return clean(a.country).localeCompare(clean(b.country));
      if (sortBy === 'region') return clean(a.region).localeCompare(clean(b.region));
      if (sortBy === 'bottle-size') return clean(a.size).localeCompare(clean(b.size), undefined, { numeric: true });
      if (sortBy === 'bottle-count') return b.quantity - a.quantity;
      if (sortBy === 'wine-name') return clean(a.name).localeCompare(clean(b.name));
      return clean(a.producer || a.fullName).localeCompare(clean(b.producer || b.fullName));
    });

    return result;
  }, [query, wines, filters, sortBy]);

  async function changeQuantity(id, delta) {
    const currentWine = wines.find(wine => wine.id === id);
    if (!currentWine) return;
    const previousQuantity = currentWine.quantity;
    const nextQuantity = Math.max(0, previousQuantity + delta);

    setWines(current => current.map(wine => wine.id === id ? { ...wine, quantity: nextQuantity } : wine));
    setSelected(current => current?.id === id ? { ...current, quantity: nextQuantity } : current);

    const { error } = await supabase.from('wines').update({ quantity: nextQuantity, updated_at: new Date().toISOString() }).eq('id', id);

    if (error) {
      setWines(current => current.map(wine => wine.id === id ? { ...wine, quantity: previousQuantity } : wine));
      setSelected(current => current?.id === id ? { ...current, quantity: previousQuantity } : current);
      setLoadError('The bottle count could not be saved. Please try again.');
    }
  }

  function updateWinePhoto(id, photoUrl) {
    setWines(current => current.map(wine => wine.id === id ? { ...wine, photoUrl } : wine));
    setSelected(current => current?.id === id ? { ...current, photoUrl } : current);
  }

  async function createWineFromScan({ producer, wineName, vintage, photoFile }) {
    const { data, error } = await supabase
      .from('wines')
      .insert({ producer: producer || '', wine_name: wineName || 'New wine', vintage: vintage || '', quantity: 1 })
      .select('*')
      .single();

    if (error) {
      setLoadError('The new wine could not be saved.');
      return null;
    }

    let savedRow = data;
    const photoUrl = await uploadScannedPhoto(photoFile, data.id);

    if (photoUrl) {
      const { data: updatedData } = await supabase
        .from('wines')
        .update({ photo_url: photoUrl, updated_at: new Date().toISOString() })
        .eq('id', data.id)
        .select('*')
        .single();

      if (updatedData) savedRow = updatedData;
    }

    const newWine = wineFromDatabase(savedRow);
    setWines(current => [newWine, ...current]);
    setSelected(newWine);
    setScan(false);
    return newWine;
  }

  if (selected) return <WineDetail wine={selected} onBack={() => setSelected(null)} onChangeQuantity={changeQuantity} onPhotoSaved={updateWinePhoto} />;
  if (scan) return <CameraFirstFlow wines={wines} onBack={() => setScan(false)} onOpen={setSelected} onCreateWine={createWineFromScan} onExistingWinePhotoSaved={updateWinePhoto} />;

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
        <button onClick={() => setScan(true)}><Camera /> Scan Bottle</button>
        <button onClick={() => setScan(true)}><Plus /> Add from Photo</button>
      </section>

      <label className="search">
        <Search />
        <input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search producer, vintage, region…" />
      </label>

      <section className="filter-sort-actions">
        <button onClick={() => setShowFilters(current => !current)}>Filter</button>
        <button onClick={() => setShowSort(current => !current)}>Sort</button>
      </section>

      {showFilters && (
        <section className="filter-panel">
          <select value={filters.colour} onChange={event => updateFilter('colour', event.target.value)}><option value="">All colours</option>{uniqueValues('colour').map(value => <option key={value} value={value}>{value}</option>)}</select>
          <select value={filters.country} onChange={event => updateFilter('country', event.target.value)}><option value="">All countries</option>{uniqueValues('country').map(value => <option key={value} value={value}>{value}</option>)}</select>
          <select value={filters.region} onChange={event => updateFilter('region', event.target.value)}><option value="">All regions</option>{uniqueValues('region').map(value => <option key={value} value={value}>{value}</option>)}</select>
          <select value={filters.producer} onChange={event => updateFilter('producer', event.target.value)}><option value="">All producers</option>{uniqueValues('producer').map(value => <option key={value} value={value}>{value}</option>)}</select>
          <select value={filters.vintage} onChange={event => updateFilter('vintage', event.target.value)}><option value="">All vintages</option>{uniqueValues('vintage').map(value => <option key={value} value={value}>{value}</option>)}</select>
          <select value={filters.bottleSize} onChange={event => updateFilter('bottleSize', event.target.value)}><option value="">All bottle sizes</option>{uniqueValues('size').map(value => <option key={value} value={value}>{value}</option>)}</select>
          <select value={filters.photo} onChange={event => updateFilter('photo', event.target.value)}><option value="">Photo: all</option><option value="has-photo">Has photo</option><option value="no-photo">No photo</option></select>
          <select value={filters.stock} onChange={event => updateFilter('stock', event.target.value)}><option value="in-stock">In stock only</option><option value="">Include zero bottles</option></select>
          <button onClick={() => setFilters({ colour: '', country: '', region: '', producer: '', vintage: '', bottleSize: '', photo: '', stock: 'in-stock' })}>Clear filters</button>
        </section>
      )}

      {showSort && (
        <section className="filter-panel">
          <select value={sortBy} onChange={event => setSortBy(event.target.value)}>
            <option value="producer">Producer A–Z</option>
            <option value="wine-name">Wine name A–Z</option>
            <option value="vintage">Vintage newest</option>
            <option value="country">Country A–Z</option>
            <option value="region">Region A–Z</option>
            <option value="bottle-size">Bottle size</option>
            <option value="bottle-count">Bottle count</option>
          </select>
        </section>
      )}

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

function WineDetail({ wine, onBack, onChangeQuantity, onPhotoSaved }) {
  return (
    <main>
      <button className="back" onClick={onBack}><ChevronLeft /> Back</button>
      <section className="detail">
        <p className="eyebrow">{wine.category || wine.colour || 'Wine'}</p>
        <h1>{[wine.vintage, wine.producer || wine.fullName].filter(Boolean).join(' ')}</h1>
        {wine.producer && <h2>{wine.name}</h2>}
        <p>{[wine.colour, wine.country, wine.region, wine.subregion, wine.appellation].filter(Boolean).join(' · ')}</p>
        <PhotoUploader wine={wine} onPhotoSaved={onPhotoSaved} />
        <div className="qty">{wine.quantity}<span>bottles</span></div>
        <div className="actions">
          <button onClick={() => onChangeQuantity(wine.id, -1)}><Minus /> Consume one</button>
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

function CameraFirstFlow({ wines, onBack, onOpen, onCreateWine, onExistingWinePhotoSaved }) {
  const fileInputRef = useRef(null);
  const [photoUrl, setPhotoUrl] = useState('');
  const [photoFile, setPhotoFile] = useState(null);
  const [searchText, setSearchText] = useState('');
  const [newWineName, setNewWineName] = useState('');
  const [newProducer, setNewProducer] = useState('');
  const [newVintage, setNewVintage] = useState('');
  const [recognising, setRecognising] = useState(false);
  const [recognitionMessage, setRecognitionMessage] = useState('');

  useEffect(() => { setTimeout(() => fileInputRef.current?.click(), 250); }, []);

  const matches = wines
    .filter(wine => searchText && Object.values(wine).join(' ').toLowerCase().includes(searchText.toLowerCase()))
    .slice(0, 10);

  async function handleLocalPhoto(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    setPhotoFile(file);
    setPhotoUrl(URL.createObjectURL(file));
    await recogniseLabel(file);
  }

  async function recogniseLabel(file) {
    setRecognising(true);
    setRecognitionMessage('Reading label…');

    const reader = new FileReader();

    reader.onloadend = async () => {
      try {
        const response = await fetch('/api/analyze-wine-label', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ image: String(reader.result || '') })
        });

        const extracted = await response.json();

        if (!response.ok) {
          throw new Error(extracted.error || 'Recognition failed');
        }

        setNewProducer(clean(extracted.producer));
        setNewWineName(clean(extracted.wine_name));
        setNewVintage(clean(extracted.vintage));

        const combined = [extracted.vintage, extracted.producer, extracted.wine_name]
          .map(clean)
          .filter(Boolean)
          .join(' ');

        setSearchText(combined);

        const match = bestMatch(wines, extracted);

        if (match) {
          setRecognitionMessage('Match found. Opening wine…');

          if (!match.photoUrl && file) {
            const photoUrl = await uploadScannedPhoto(file, match.id);

            if (photoUrl) {
              const { data: updatedData } = await supabase
                .from('wines')
                .update({ photo_url: photoUrl, updated_at: new Date().toISOString() })
                .eq('id', match.id)
                .select('*')
                .single();

              if (updatedData) {
                const updatedWine = wineFromDatabase(updatedData);
                onExistingWinePhotoSaved(match.id, photoUrl);
                setTimeout(() => onOpen(updatedWine), 500);
                return;
              }
            }
          }

          setTimeout(() => onOpen(match), 500);
        } else {
          setRecognitionMessage('No clear match found. Details have been pre-filled.');
        }
      } catch (error) {
        setRecognitionMessage('Could not read the label yet. You can search or add manually.');
      }

      setRecognising(false);
    };

    reader.readAsDataURL(file);
  }

  return (
    <main>
      <button className="back" onClick={onBack}><ChevronLeft /> Back</button>
      <section className="detail">
        <Camera size={44} />
        <h1>Scan Bottle</h1>
        <p>Take a photo. The app will try to recognise the wine automatically.</p>

        <input ref={fileInputRef} type="file" accept="image/*" capture="environment" onChange={handleLocalPhoto} style={{ display: 'none' }} />

        <button className="photo-button" onClick={() => fileInputRef.current?.click()}><Camera /> Take Photo</button>
        {photoUrl && <img className="wine-photo" src={photoUrl} alt="Bottle preview" />}
        {recognitionMessage && <p className="photo-message">{recognising ? '⏳ ' : ''}{recognitionMessage}</p>}

        <h2>Find existing wine</h2>
        <input className="biginput" value={searchText} onChange={event => setSearchText(event.target.value)} placeholder="Try: Meerlust Rubicon 2021" />
        {matches.map(wine => <WineCard key={wine.id} wine={wine} onClick={() => onOpen(wine)} />)}

        <h2>Add new wine</h2>
        <input className="biginput" value={newVintage} onChange={event => setNewVintage(event.target.value)} placeholder="Vintage e.g. 2021 or NV" />
        <input className="biginput" value={newProducer} onChange={event => setNewProducer(event.target.value)} placeholder="Producer" />
        <input className="biginput" value={newWineName} onChange={event => setNewWineName(event.target.value)} placeholder="Wine name" />
        <button onClick={() => onCreateWine({ producer: newProducer, wineName: newWineName, vintage: newVintage, photoFile })}>
          <Plus /> Create new wine
        </button>
      </section>
    </main>
  );
}

createRoot(document.getElementById('root')).render(<App />);