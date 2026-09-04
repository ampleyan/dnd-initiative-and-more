import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Trash2, ChevronRight, Map, Swords, Edit2, ExternalLink, Search } from 'lucide-react';
import { Campaign, Player } from '../types';
import { AvatarImg } from './AvatarImg';
import { ImagePickerModal } from './ImagePickerModal';

interface CampaignViewProps {
  campaigns: Campaign[];
  players: Player[];
  isEncounterActive: boolean;
  currentEncounterName?: string;
  currentEncounterId?: string | null;
  onSelectCampaign: (id: string) => void;
  onCreateCampaign: (name: string, description: string, mapImage?: string) => Promise<void>;
  onUpdateCampaign: (id: string, updates: Partial<Campaign>) => Promise<void>;
  onDeleteCampaign: (id: string) => Promise<void>;
}

export const CampaignView: React.FC<CampaignViewProps> = ({
  campaigns,
  players,
  isEncounterActive,
  currentEncounterName,
  currentEncounterId,
  onSelectCampaign,
  onCreateCampaign,
  onUpdateCampaign,
  onDeleteCampaign,
}) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [mapImage, setMapImage] = useState('');
  const [imagePickerOpen, setImagePickerOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const handleCreate = async () => {
    if (!name.trim()) return;
    setCreating(true);
    if (editingId) {
      await onUpdateCampaign(editingId, { name: name.trim(), description: description.trim(), mapImage: mapImage.trim() });
    } else {
      await onCreateCampaign(name.trim(), description.trim(), mapImage.trim());
    }
    resetForm();
  };

  const resetForm = () => {
    setName('');
    setDescription('');
    setMapImage('');
    setShowForm(false);
    setEditingId(null);
    setCreating(false);
  };

  const startEdit = (campaign: Campaign) => {
    setName(campaign.name);
    setDescription(campaign.description || '');
    setMapImage(campaign.mapImage || '');
    setEditingId(campaign.id);
    setShowForm(true);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Map className="w-6 h-6 text-teal-400" />
          <h2 className="text-2xl font-headline font-bold text-on-surface">Campaigns</h2>
        </div>
        <button
          onClick={() => { resetForm(); setShowForm(v => !v); }}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-on-primary rounded-lg text-sm font-semibold hover:bg-primary/90 transition-colors"
        >
          <Plus className="w-4 h-4" />
          New Campaign
        </button>
      </div>

      {/* Active encounter banner */}
      {isEncounterActive && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
          </span>
          <Swords className="w-4 h-4 text-emerald-400 shrink-0" />
          <span className="text-sm font-semibold text-emerald-400 flex-1">
            Active: {currentEncounterName || 'Encounter in progress'}
          </span>
          {currentEncounterId && (
            <Link to={`/encounters/${currentEncounterId}`}
                  className="flex items-center gap-1.5 text-xs font-bold text-emerald-400/70 hover:text-emerald-300 transition-colors shrink-0">
              <ExternalLink className="w-3 h-3" />
              Open
            </Link>
          )}
        </div>
      )}

      {/* Party panel */}
      {players.length > 0 && (
        <div className="space-y-3">
          <p className="text-xs font-bold uppercase tracking-widest text-outline">Party</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {players.map(player => {
              return (
                <div key={player.id} className="bg-surface-container rounded-xl p-3 flex flex-col gap-2 border border-outline/10">
                  <div className="flex items-center gap-2">
                    <AvatarImg src={player.avatar} name={player.name} className="w-8 h-8 rounded-full text-sm shrink-0" />
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-on-surface truncate">{player.name}</p>
                      <p className="text-[10px] text-outline truncate">{player.subtitle}</p>
                    </div>
                  </div>
                  <div className="flex justify-between text-[10px] text-outline">
                    <span>HP <span className="text-on-surface font-bold">{player.hp_max ?? '—'}</span></span>
                    <span>AC <span className="text-on-surface font-bold">{player.ac}</span></span>
                  </div>
                  <div className="text-[10px] text-outline">
                    <span>Speed <span className="text-on-surface font-bold">
                      {player.speed
                        ? player.speed.split(',').map((s: string) => s.trim()).filter((s: string) => !/ 0 ft\.?/.test(s)).join(', ') || player.speed
                        : '—'}
                    </span></span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* New/Edit campaign form */}
      {showForm && (
        <div className="bg-surface-container rounded-xl p-6 space-y-4 border border-outline/10">
          <h3 className="text-sm font-bold uppercase tracking-widest text-outline">
            {editingId ? 'Edit Campaign' : 'New Campaign'}
          </h3>
          <div className="space-y-3">
            <div>
              <label className="block text-[10px] uppercase tracking-widest text-outline font-bold mb-1">Name</label>
              <input
                type="text"
                placeholder="Campaign name"
                value={name}
                onChange={e => setName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleCreate()}
                className="w-full bg-surface-container-high border border-outline/20 rounded-lg px-4 py-2 text-sm text-on-surface placeholder:text-outline focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <div>
              <label className="block text-[10px] uppercase tracking-widest text-outline font-bold mb-1">Description</label>
              <textarea
                placeholder="Description (optional)"
                value={description}
                onChange={e => setDescription(e.target.value)}
                rows={3}
                className="w-full bg-surface-container-high border border-outline/20 rounded-lg px-4 py-2 text-sm text-on-surface placeholder:text-outline focus:outline-none focus:ring-1 focus:ring-primary resize-none"
              />
            </div>
            <div>
              <label className="block text-[10px] uppercase tracking-widest text-outline font-bold mb-1">Map Image URL</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="https://..."
                  value={mapImage}
                  onChange={e => setMapImage(e.target.value)}
                  className="flex-1 bg-surface-container-high border border-outline/20 rounded-lg px-4 py-2 text-sm text-on-surface placeholder:text-outline focus:outline-none focus:ring-1 focus:ring-primary"
                />
                <button
                  type="button"
                  onClick={() => setImagePickerOpen(true)}
                  className="px-3 py-2 bg-surface-container-high border border-outline/20 rounded-lg hover:bg-surface-container-highest transition-colors text-outline hover:text-on-surface shrink-0"
                  title="Search images"
                >
                  <Search className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
          <ImagePickerModal
            isOpen={imagePickerOpen}
            onClose={() => setImagePickerOpen(false)}
            onSelect={url => setMapImage(url)}
          />
          <div className="flex gap-3">
            <button
              onClick={handleCreate}
              disabled={creating || !name.trim()}
              className="px-4 py-2 bg-primary text-on-primary rounded-lg text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              {creating ? (editingId ? 'Saving…' : 'Creating…') : (editingId ? 'Save Changes' : 'Create')}
            </button>
            <button
              onClick={resetForm}
              className="px-4 py-2 bg-surface-container-high text-on-surface rounded-lg text-sm font-semibold hover:bg-surface-container-highest transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {campaigns.length === 0 && !showForm && (
        <div className="text-center py-20 text-outline">
          <Map className="w-12 h-12 mx-auto mb-4 opacity-30" />
          <p className="text-sm">No campaigns yet. Create one to organize your sessions.</p>
        </div>
      )}

      {/* Campaign list */}
      <div className="space-y-3">
        {campaigns.map(campaign => (
          <div
            key={campaign.id}
            className="bg-surface-container rounded-xl p-5 flex items-center justify-between group hover:bg-surface-container-high transition-colors cursor-pointer"
            onClick={() => onSelectCampaign(campaign.id)}
          >
            <div className="flex items-center gap-4 min-w-0">
              {campaign.mapImage ? (
                <div className="w-12 h-12 rounded-lg bg-cover bg-center shrink-0 border border-outline/10" style={{ backgroundImage: `url(${campaign.mapImage})` }} />
              ) : (
                <div className="w-12 h-12 rounded-lg bg-surface-container-highest flex items-center justify-center shrink-0 border border-outline/10 text-outline">
                  <Map className="w-6 h-6" />
                </div>
              )}
              <div className="min-w-0">
                <h3 className="text-base font-bold text-on-surface truncate">{campaign.name}</h3>
                {campaign.description && (
                  <p className="text-sm text-outline truncate mt-0.5">{campaign.description}</p>
                )}
                <p className="text-xs text-outline mt-1">
                  {campaign.sessionCount != null && campaign.sessionCount > 0 && (
                    <span className="font-semibold text-on-surface-variant mr-1.5">{campaign.sessionCount} session{campaign.sessionCount !== 1 ? 's' : ''} ·</span>
                  )}
                  Started {new Date(campaign.createdAt).toLocaleDateString()}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0 ml-4">
              <button
                onClick={e => { e.stopPropagation(); startEdit(campaign); }}
                className="p-2 text-outline hover:text-primary hover:bg-primary/10 rounded-lg transition-colors opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
                title="Edit campaign"
              >
                <Edit2 className="w-4 h-4" />
              </button>
              <button
                onClick={e => { e.stopPropagation(); onDeleteCampaign(campaign.id); }}
                className="p-2 text-outline hover:text-error hover:bg-error/10 rounded-lg transition-colors opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
                title="Delete campaign"
              >
                <Trash2 className="w-4 h-4" />
              </button>
              <ChevronRight className="w-5 h-5 text-outline" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );

};
