import React, { useRef, useState } from 'react';
import { Camera, Upload } from 'lucide-react';
import { supabase } from './supabase.js';

const BUCKET_NAME = 'wine-photos';

export default function PhotoUploader({ wine, onPhotoSaved }) {
  const inputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState('');

  async function uploadPhoto(event) {
    const file = event.target.files?.[0];
    if (!file || !wine?.id) return;

    setUploading(true);
    setMessage('');

    const fileExtension = file.name.split('.').pop() || 'jpg';
    const filePath = `${wine.id}/${Date.now()}.${fileExtension}`;

    const { error: uploadError } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: true
      });

    if (uploadError) {
      console.error('Photo upload error:', uploadError);
      setMessage('Photo upload failed.');
      setUploading(false);
      return;
    }

    const { data } = supabase.storage
      .from(BUCKET_NAME)
      .getPublicUrl(filePath);

    const photoUrl = data?.publicUrl;

    if (!photoUrl) {
      setMessage('Photo uploaded but no public URL was returned.');
      setUploading(false);
      return;
    }

    const { error: updateError } = await supabase
      .from('wines')
      .update({ photo_url: photoUrl, updated_at: new Date().toISOString() })
      .eq('id', wine.id);

    if (updateError) {
      console.error('Photo URL save error:', updateError);
      setMessage('Photo uploaded but could not be saved to the wine.');
      setUploading(false);
      return;
    }

    onPhotoSaved(wine.id, photoUrl);
    setMessage('Photo saved.');
    setUploading(false);
  }

  return (
    <section className="photo-panel">
      {wine.photoUrl ? (
        <img className="wine-photo" src={wine.photoUrl} alt={`${wine.fullName} label`} />
      ) : (
        <div className="photo-placeholder">
          <Camera size={36} />
          <span>No bottle photo yet</span>
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={uploadPhoto}
        style={{ display: 'none' }}
      />

      <button className="photo-button" onClick={() => inputRef.current?.click()} disabled={uploading}>
        <Upload />
        {uploading ? 'Uploading…' : wine.photoUrl ? 'Replace photo' : 'Upload photo'}
      </button>

      {message && <p className="photo-message">{message}</p>}
    </section>
  );
}
