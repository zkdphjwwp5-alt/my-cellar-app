import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Wine, AlertCircle, RefreshCw } from 'lucide-react';
import { supabase } from './supabase.js';
import Home from './Home.jsx';
import WineDetail from './WineDetail.jsx';
import CameraFirstFlow from './CameraFirstFlow.jsx';
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

function App() {
  const [wines, setWines] = useState([]);
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

  useEffect(() => {
    loadWines();
  }, []);

  async function changeQuantity(id, delta) {
    const currentWine = wines.find(wine => wine.id === id);
    if (!currentWine) return;

    const previousQuantity = currentWine.quantity;
    const nextQuantity = Math.max(0, previousQuantity + delta);

    setWines(current => current.map(wine => wine.id === id ? { ...wine, quantity: nextQuantity } : wine));
    setSelected(current => current?.id === id ? { ...current, quantity: nextQuantity } : current);

    const { error } = await supabase.from('wines').update({
      quantity: nextQuantity,
      updated_at: new Date().toISOString()
    }).eq('id', id);

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
    const { data, error } = await supabase.from('wines').insert({
      producer: producer || '',
      wine_name: wineName || 'New wine',
      vintage: vintage || '',
      quantity: 1
    }).select('*').single();

    if (error) {
      setLoadError('The new wine could not be saved.');
      return null;
    }

    let savedRow = data;
    const photoUrl = await uploadScannedPhoto(photoFile, data.id);

    if (photoUrl) {
      const { data: updatedData } = await supabase.from('wines').update({
        photo_url: photoUrl,
        updated_at: new Date().toISOString()
      }).eq('id', data.id).select('*').single();

      if (updatedData) savedRow = updatedData;
    }

    const newWine = wineFromDatabase(savedRow);
    setWines(current => [newWine, ...current]);
    setSelected(newWine);
    setScan(false);
    return newWine;
  }

  async function savePhotoForExistingWine(file, wine) {
    if (!file || !wine || wine.photoUrl) return wine;

    const photoUrl = await uploadScannedPhoto(file, wine.id);
    if (!photoUrl) return wine;

    const { data } = await supabase.from('wines').update({
      photo_url: photoUrl,
      updated_at: new Date().toISOString()
    }).eq('id', wine.id).select('*').single();

    if (!data) return wine;

    const updatedWine = wineFromDatabase(data);
    updateWinePhoto(wine.id, photoUrl);
    return updatedWine;
  }

  if (selected) {
    return <WineDetail wine={selected} onBack={() => setSelected(null)} onChangeQuantity={changeQuantity} onPhotoSaved={updateWinePhoto} />;
  }

  if (scan) {
    return (
      <CameraFirstFlow
        wines={wines}
        onBack={() => setScan(false)}
        onOpen={setSelected}
        onCreateWine={createWineFromScan}
        bestMatch={bestMatch}
        savePhotoForExistingWine={savePhotoForExistingWine}
      />
    );
  }

  return (
    <Home
      wines={wines}
      loading={loading}
      loadError={loadError}
      onRetry={loadWines}
      onOpenWine={setSelected}
      onScan={() => setScan(true)}
    />
  );
}

createRoot(document.getElementById('root')).render(<App />);
