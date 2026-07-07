import React from 'react';

export default function WineCard({ wine, onClick }) {
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
