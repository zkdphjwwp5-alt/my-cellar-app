import React, { useEffect, useRef, useState } from 'react';
import { Camera, ChevronLeft, Plus } from 'lucide-react';
import WineCard from './WineCard.jsx';
import { clean, findBestMatch } from './App.jsx';

export default function ScanBottle({ wines, onBack, onOpenWine, onCreateWine, savePhotoForWine }) {
  const fileInputRef = useRef(null);
  const [photoUrl, setPhotoUrl] = useState('');
  const [photoFile, setPhotoFile] = useState(null);
  const [searchText, setSearchText] = useState('');
  const [newProducer, setNewProducer] = useState('');
  const [newWineName, setNewWineName] = useState('');
  const [newVintage, setNewVintage] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    setTimeout(() => fileInputRef.current?.click(), 250);
  }, []);

  const matches = wines
    .filter(wine => searchText && Object.values(wine).join(' ').toLowerCase().includes(searchText.toLowerCase()))
    .slice(0, 10);

  async function handlePhoto(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    setPhotoFile(file);
    setPhotoUrl(URL.createObjectURL(file));
    await recogniseLabel(file);
  }

  async function recogniseLabel(file) {
    setMessage('Reading label…');

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

        const combined = [extracted.vintage, extracted.producer, extracted.wine_name].map(clean).filter(Boolean).join(' ');
        setSearchText(combined);

        const match = findBestMatch(wines, extracted);

        if (match) {
          setMessage('Match found. Opening wine…');
          const wineToOpen = match.photoUrl ? match : await savePhotoForWine(file, match);
          setTimeout(() => onOpenWine(wineToOpen), 500);
        } else {
          setMessage('No clear match found. Details have been pre-filled.');
        }
      } catch {
        setMessage('Could not read the label yet. You can search or add manually.');
      }
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

        <input ref={fileInputRef} type="file" accept="image/*" capture="environment" onChange={handlePhoto} style={{ display: 'none' }} />

        <button className="photo-button" onClick={() => fileInputRef.current?.click()}><Camera /> Take Photo</button>

        {photoUrl && <img className="wine-photo" src={photoUrl} alt="Bottle preview" />}
        {message && <p className="photo-message">{message}</p>}

        <h2>Find existing wine</h2>
        <input className="biginput" value={searchText} onChange={event => setSearchText(event.target.value)} placeholder="Try: Meerlust Rubicon 2021" />
        {matches.map(wine => <WineCard key={wine.id} wine={wine} onClick={() => onOpenWine(wine)} />)}

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
