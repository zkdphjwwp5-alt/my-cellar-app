import React, { useEffect, useRef, useState } from 'react';
import { Camera, ChevronLeft, Plus } from 'lucide-react';
import WineCard from './WineCard.jsx';

function clean(value) {
  return String(value ?? '').trim();
}

export default function CameraFirstFlow({ wines, onBack, onOpen, onCreateWine, bestMatch, savePhotoForExistingWine }) {
  const fileInputRef = useRef(null);
  const [photoUrl, setPhotoUrl] = useState('');
  const [photoFile, setPhotoFile] = useState(null);
  const [searchText, setSearchText] = useState('');
  const [newWineName, setNewWineName] = useState('');
  const [newProducer, setNewProducer] = useState('');
  const [newVintage, setNewVintage] = useState('');
  const [recognising, setRecognising] = useState(false);
  const [recognitionMessage, setRecognitionMessage] = useState('');

  useEffect(() => {
    setTimeout(() => fileInputRef.current?.click(), 250);
  }, []);

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

        const combined = [extracted.vintage, extracted.producer, extracted.wine_name].map(clean).filter(Boolean).join(' ');
        setSearchText(combined);

        const match = bestMatch(wines, extracted);

        if (match) {
          setRecognitionMessage('Match found. Opening wine…');
          const wineToOpen = await savePhotoForExistingWine(file, match);
          setTimeout(() => onOpen(wineToOpen), 500);
        } else {
          setRecognitionMessage('No clear match found. Details have been pre-filled.');
        }
      } catch {
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
