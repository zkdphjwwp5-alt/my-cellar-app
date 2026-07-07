import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { supabase } from './supabase.js';
import Home from './Home.jsx';
import WineDetail from './WineDetail.jsx';
import ScanBottle from './ScanBottle.jsx';
import './style.css';

const BUCKET_NAME = 'wine-photos';

export function clean(value) {
  return String(value ?? '').trim();
}

export function wineFromDatabase(row) {
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
    size: clean(row.bottle_size) || '750ml',
    storageLocation: clean(row.storage_location) || 'Not set yet',
    drinkFrom: clean(row.drinking_from),
    drinkTo: clean(row.drinking_to),
    notes: clean(row.notes),
    photoUrl: clean(row.photo_url),
    locationText: [row.country, row.region, row.subregion, row.appellation].map(clean).filter(Boolean).join(', ')
  };
}

export async function uploadWinePhoto(file, wineId) {
  if (!file || !wineId) return '';

  const extension = file.name.split('.').pop() || 'jpg';
  const filePath = `${wineId}/${Date.now()}.${extension}`;

  const { error } = await supabase.storage
    .from(BUCKET_NAME)
    .upload(filePath, file, { cacheControl: '3600', upsert: true });

  if (error) return '';

  const { data } = supabase.storage.from(BUCKET_NAME).getPublicUrl(filePath);
  return data?.publicUrl || '';
}

export function findBestMatch(wines, extracted) {
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
  const [screen, setScreen] = useState('home');
  const [selectedWine, setSelectedWine] = useState(null);
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

  function openWine(wine) {
    setSelectedWine(wine);
    setScreen('detail');
  }

  function updateWineInState(updatedWine) {
    setWines(current => current.map(wine => wine.id === updatedWine.id ? updatedWine : wine));
    setSelectedWine(current => current?.id === updatedWine.id ? updatedWine : current);
  }

  async function changeQuantity(wine, delta) {
    const nextQuantity = Math.max(0, wine.quantity + delta);

    const { data, error } = await supabase
      .from('wines')
      .update({ quantity: nextQuantity, updated_at: new Date().toISOString() })
      .eq('id', wine.id)
      .select('*')
      .single();

    if (!error && data) {
      updateWineInState(wineFromDatabase(data));
    }
  }

  async function savePhotoForWine(wine, file) {
    const photoUrl = await uploadWinePhoto(file, wine.id);
    if (!photoUrl) return wine;

    const { data } = await supabase
      .from('wines')
      .update({ photo_url: photoUrl, updated_at: new Date().toISOString() })
      .eq('id', wine.id)
      .select('*')
      .single();

    const updatedWine = data ? wineFromDatabase(data) : { ...wine, photoUrl };
    updateWineInState(updatedWine);
    return updatedWine;
  }

  async function createWine({ producer, wineName, vintage, photoFile }) {
    const { data, error } = await supabase
      .from('wines')
      .insert({
        producer: producer || '',
        wine_name: wineName || 'New wine',
        vintage: vintage || '',
        quantity: 1
      })
      .select('*')
      .single();

    if (error || !data) return null;

    let newWine = wineFromDatabase(data);

    if (photoFile) {
      newWine = await savePhotoForWine(newWine, photoFile);
    }

    setWines(current => [newWine, ...current.filter(wine => wine.id !== newWine.id)]);
    openWine(newWine);
    return newWine;
  }

  if (screen === 'detail' && selectedWine) {
    return (
      <WineDetail
        wine={selectedWine}
        onBack={() => setScreen('home')}
        onAddOne={() => changeQuantity(selectedWine, 1)}
        onConsumeOne={() => changeQuantity(selectedWine, -1)}
        onPhotoSaved={updatedWine => updateWineInState(updatedWine)}
        savePhotoForWine={savePhotoForWine}
      />
    );
  }

  if (screen === 'scan') {
    return (
      <ScanBottle
        wines={wines}
        onBack={() => setScreen('home')}
        onOpenWine={openWine}
        onCreateWine={createWine}
        savePhotoForWine={savePhotoForWine}
      />
    );
  }

  return (
    <Home
      wines={wines}
      loading={loading}
      loadError={loadError}
      onRetry={loadWines}
      onOpenWine={openWine}
      onScan={() => setScreen('scan')}
    />
  );
}

createRoot(document.getElementById('root')).render(<App />);
