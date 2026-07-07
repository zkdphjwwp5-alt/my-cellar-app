import React from 'react';
import { ChevronLeft, Minus, Plus } from 'lucide-react';
import PhotoUploader from './PhotoUploader.jsx';

export default function WineDetail({ wine, onBack, onChangeQuantity, onPhotoSaved }) {
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
