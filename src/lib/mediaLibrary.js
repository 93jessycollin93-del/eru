/**
 * mediaLibrary — the single data-access layer for the media library.
 * ------------------------------------------------------------------
 * Every read/write for tracks, playlists, audio files, tags, play history and
 * collaborators goes through this module. UI components must NOT touch the
 * Base44 SDK (or any storage backend) directly — they import from here. This
 * mirrors the `streamingProvider` pattern: one module owns the data contract,
 * so the backend can change without touching the UI.
 *
 * Backend today: Base44 entities + Base44 file storage (Core.UploadFile).
 * To migrate to Supabase later, only this file changes.
 *
 * Sharing model: a public/unlisted playlist shares the playlist AND its audio
 * files. That decision is centralized in `sharedPayloadForPlaylist()` so it can
 * later switch to metadata-only sharing without a schema change or UI edits.
 *
 * Privacy note: Base44 row-level security here is all-or-nothing (owner-scoped
 * or fully public). Mixed-visibility tables therefore enforce "what a non-owner
 * may see" in this module. Genuine server-side privacy for community browse is
 * implemented in a later phase via a Base44 backend function; until then these
 * helpers are the single chokepoint for that logic.
 */

import { base44 } from '@/api/base44Client';

const E = base44.entities;

// ---------------------------------------------------------------------------
// Visibility
// ---------------------------------------------------------------------------

export const VISIBILITY = {
  PRIVATE: 'private',
  UNLISTED: 'unlisted',
  PUBLIC: 'public',
};

/** A playlist is "shared" (discoverable/streamable by non-owners) when it is
 *  public or unlisted. Private playlists are owner-only. */
export function isPlaylistShared(playlist) {
  return (
    playlist?.visibility === VISIBILITY.PUBLIC ||
    playlist?.visibility === VISIBILITY.UNLISTED
  );
}

/**
 * The single source of truth for WHAT a shared playlist exposes.
 *
 * Today: the playlist plus its tracks *including their audio file URLs* (others
 * stream the uploader's files). To switch to metadata-only sharing later,
 * change ONLY this function (e.g. strip `file_url`) — no schema or UI changes.
 */
export function sharedPayloadForPlaylist(playlist, tracks = []) {
  if (!isPlaylistShared(playlist)) {
    return { playlist: null, tracks: [] };
  }
  return {
    playlist,
    // Audio files ARE shared in the current model.
    tracks: tracks.map((t) => ({ ...t })),
  };
}

// ---------------------------------------------------------------------------
// Storage (audio files)
// ---------------------------------------------------------------------------

/**
 * Upload an audio/video file blob to Base44 storage and return its URL.
 * @param {File|Blob} file
 * @returns {Promise<string>} the stored file URL
 */
export async function uploadAudioFile(file) {
  const { file_url } = await base44.integrations.Core.UploadFile({ file });
  return file_url;
}

// ---------------------------------------------------------------------------
// Tracks
// ---------------------------------------------------------------------------

export async function listTracks({ sort = '-created_date', limit = 200 } = {}) {
  return (await E.Track.list(sort, limit)) || [];
}

export async function getTrack(id) {
  const rows = await E.Track.filter({ id });
  return rows?.[0] || null;
}

export async function createTrack(data) {
  return E.Track.create({
    kind: 'audio',
    added_via: 'converter',
    ...data,
  });
}

export async function updateTrack(id, patch) {
  return E.Track.update(id, patch);
}

export async function deleteTrack(id) {
  // Remove the track and any join rows / history that reference it.
  await Promise.all([
    removeTrackEverywhere(id),
    removeTagsForTrack(id),
  ]);
  return E.Track.delete(id);
}

/**
 * Persist a freshly-converted file as a Track. Accepts the Blob produced by the
 * converter, uploads it, and stores metadata. Centralized here so the converter
 * UI never talks to storage or entities directly.
 */
export async function importConvertedTrack({ blob, filename, sourceUrl, format }) {
  const file = blob instanceof File ? blob : new File([blob], filename || 'track', {
    type: blob?.type || 'application/octet-stream',
  });
  const file_url = await uploadAudioFile(file);
  const isVideo = /mp4|webm|mov/i.test(format || file.type || '');
  const title = (filename || 'Untitled').replace(/\.[a-z0-9]+$/i, '');
  return createTrack({
    title,
    file_url,
    source_url: sourceUrl || '',
    format: format || '',
    kind: isVideo ? 'video' : 'audio',
    size_bytes: file.size || 0,
    added_via: 'converter',
  });
}

// ---------------------------------------------------------------------------
// Playlists
// ---------------------------------------------------------------------------

export async function listPlaylists({ sort = '-updated_date', limit = 200 } = {}) {
  return (await E.Playlist.list(sort, limit)) || [];
}

export async function getPlaylist(id) {
  const rows = await E.Playlist.filter({ id });
  return rows?.[0] || null;
}

export async function createPlaylist({ name, description = '', visibility = VISIBILITY.PRIVATE } = {}) {
  return E.Playlist.create({ name, description, visibility, track_count: 0 });
}

export async function updatePlaylist(id, patch) {
  return E.Playlist.update(id, patch);
}

/**
 * Change a playlist's visibility. When making it shared, the converter terms
 * acknowledgment must be recorded (the caller passes acknowledged=true), since
 * sharing publishes the uploader's audio files.
 */
export async function setPlaylistVisibility(id, visibility, { acknowledged } = {}) {
  const patch = { visibility };
  if (isPlaylistShared({ visibility })) {
    if (acknowledged !== true) {
      throw new Error('Terms must be acknowledged before sharing a playlist.');
    }
    patch.terms_acknowledged = true;
  }
  return E.Playlist.update(id, patch);
}

export async function deletePlaylist(id) {
  const links = await E.PlaylistTrack.filter({ playlist_id: id });
  await Promise.all([
    ...(links || []).map((l) => E.PlaylistTrack.delete(l.id)),
    ...((await E.PlaylistCollaborator.filter({ playlist_id: id })) || []).map((c) =>
      E.PlaylistCollaborator.delete(c.id),
    ),
  ]);
  return E.Playlist.delete(id);
}

// ---------------------------------------------------------------------------
// Playlist <-> Track membership & ordering
// ---------------------------------------------------------------------------

/** Ordered tracks for a playlist (resolves join rows to full Track objects). */
export async function getPlaylistTracks(playlistId) {
  const links = (await E.PlaylistTrack.filter({ playlist_id: playlistId })) || [];
  links.sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
  const tracks = await Promise.all(links.map((l) => getTrack(l.track_id)));
  return links
    .map((l, i) => (tracks[i] ? { ...tracks[i], _linkId: l.id, _position: l.position } : null))
    .filter(Boolean);
}

export async function addTrackToPlaylist(playlistId, trackId, addedBy = '') {
  const existing = (await E.PlaylistTrack.filter({ playlist_id: playlistId })) || [];
  if (existing.some((l) => l.track_id === trackId)) return null; // no dupes
  const position = existing.length;
  const link = await E.PlaylistTrack.create({
    playlist_id: playlistId,
    track_id: trackId,
    position,
    added_by: addedBy,
  });
  await refreshTrackCount(playlistId);
  return link;
}

export async function removeTrackFromPlaylist(linkId, playlistId) {
  await E.PlaylistTrack.delete(linkId);
  if (playlistId) await refreshTrackCount(playlistId);
}

/** Persist a new order. `orderedLinkIds` is the link-row ids in display order. */
export async function reorderPlaylistTracks(orderedLinkIds = []) {
  await Promise.all(
    orderedLinkIds.map((linkId, index) =>
      E.PlaylistTrack.update(linkId, { position: index }),
    ),
  );
}

/** Move (copy membership of) a set of tracks into another playlist. */
export async function moveTracksToPlaylist(trackIds = [], targetPlaylistId, addedBy = '') {
  for (const trackId of trackIds) {
    await addTrackToPlaylist(targetPlaylistId, trackId, addedBy);
  }
}

async function refreshTrackCount(playlistId) {
  const links = (await E.PlaylistTrack.filter({ playlist_id: playlistId })) || [];
  await E.Playlist.update(playlistId, { track_count: links.length }).catch(() => {});
}

async function removeTrackEverywhere(trackId) {
  const links = (await E.PlaylistTrack.filter({ track_id: trackId })) || [];
  await Promise.all(links.map((l) => E.PlaylistTrack.delete(l.id)));
}

// ---------------------------------------------------------------------------
// Tags (many-to-many, free-form)
// ---------------------------------------------------------------------------

export async function listTags() {
  return (await E.Tag.list('name', 500)) || [];
}

export async function createTag(name, color = '') {
  const trimmed = (name || '').trim();
  if (!trimmed) throw new Error('Tag name is required.');
  const existing = (await E.Tag.filter({ name: trimmed })) || [];
  if (existing.length) return existing[0];
  return E.Tag.create({ name: trimmed, color });
}

export async function assignTag(trackId, tag) {
  const tagRow = typeof tag === 'string' ? await createTag(tag) : tag;
  const existing = (await E.TrackTag.filter({ track_id: trackId, tag_id: tagRow.id })) || [];
  if (existing.length) return existing[0];
  return E.TrackTag.create({ track_id: trackId, tag_id: tagRow.id, tag_name: tagRow.name });
}

export async function unassignTag(trackId, tagId) {
  const rows = (await E.TrackTag.filter({ track_id: trackId, tag_id: tagId })) || [];
  await Promise.all(rows.map((r) => E.TrackTag.delete(r.id)));
}

export async function getTagsForTrack(trackId) {
  return (await E.TrackTag.filter({ track_id: trackId })) || [];
}

export async function getTracksByTag(tagId) {
  const links = (await E.TrackTag.filter({ tag_id: tagId })) || [];
  const tracks = await Promise.all(links.map((l) => getTrack(l.track_id)));
  return tracks.filter(Boolean);
}

async function removeTagsForTrack(trackId) {
  const rows = (await E.TrackTag.filter({ track_id: trackId })) || [];
  await Promise.all(rows.map((r) => E.TrackTag.delete(r.id)));
}

// ---------------------------------------------------------------------------
// Play history (recently / most played)
// ---------------------------------------------------------------------------

export async function recordPlay(track, source = 'library') {
  if (!track?.id) return null;
  return E.PlayHistory.create({
    track_id: track.id,
    track_title: track.title || '',
    played_at: new Date().toISOString(),
    source,
  }).catch(() => null);
}

export async function getRecentlyPlayed(limit = 50) {
  const rows = (await E.PlayHistory.list('-played_at', limit * 4)) || [];
  const seen = new Set();
  const out = [];
  for (const row of rows) {
    if (seen.has(row.track_id)) continue;
    seen.add(row.track_id);
    out.push(row);
    if (out.length >= limit) break;
  }
  return out;
}

export async function getMostPlayed(limit = 50) {
  const rows = (await E.PlayHistory.list('-played_at', 1000)) || [];
  const counts = new Map();
  for (const row of rows) {
    const c = counts.get(row.track_id) || { track_id: row.track_id, track_title: row.track_title, plays: 0 };
    c.plays += 1;
    counts.set(row.track_id, c);
  }
  return [...counts.values()].sort((a, b) => b.plays - a.plays).slice(0, limit);
}

// ---------------------------------------------------------------------------
// Collaborators (collaborative playlists)
// ---------------------------------------------------------------------------

export async function listCollaborators(playlistId) {
  return (await E.PlaylistCollaborator.filter({ playlist_id: playlistId })) || [];
}

export async function addCollaborator(playlistId, userEmail, role = 'editor') {
  const email = (userEmail || '').trim().toLowerCase();
  if (!email) throw new Error('Collaborator email is required.');
  const existing = (await E.PlaylistCollaborator.filter({ playlist_id: playlistId, user_email: email })) || [];
  if (existing.length) return existing[0];
  return E.PlaylistCollaborator.create({ playlist_id: playlistId, user_email: email, role });
}

export async function removeCollaborator(collaboratorId) {
  return E.PlaylistCollaborator.delete(collaboratorId);
}
