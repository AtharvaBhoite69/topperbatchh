import React, { useState, useEffect } from 'react';
import ComicButton from '../../components/ui/ComicButton';
import ComicCard from '../../components/ui/ComicCard';
import ComicInput from '../../components/ui/ComicInput';
import { admin as adminApi } from '../../services/api';
import { Settings, Save, ShieldCheck } from 'lucide-react';
import toast from 'react-hot-toast';

export const PlatformSettings = () => {
  const [settings, setSettings] = useState({
    max_sessions_per_user: '1',
    enable_private_messaging: 'false',
    mcq_questions_per_challenge: '10',
    scoring_correct_points: '10',
    scoring_participation_bonus: '5',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const res = await adminApi.getSettings();
        if (res.data?.success && res.data.settings) {
          setSettings((prev) => ({ ...prev, ...res.data.settings }));
        }
      } catch (err) {
        toast.error('Failed to load settings.');
      } finally {
        setLoading(false);
      }
    };

    fetchSettings();
  }, []);

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await adminApi.updateSettings(settings);
      toast.success('Platform settings updated successfully!');
    } catch (err) {
      toast.error('Could not save platform settings.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 text-left select-none">
      <div className="comic-box bg-white p-6">
        <div className="flex items-center gap-2 mb-1">
          <Settings className="w-6 h-6 text-punch-red" />
          <h1 className="font-heading text-3xl uppercase tracking-wide text-ink">
            CONTROL ROOM & PLATFORM SETTINGS
          </h1>
        </div>
        <p className="font-sans text-xs text-olive-dark font-medium max-w-xl">
          Adjust security parameters, device session constraints, and MCQ scoring mechanics.
        </p>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {/* Device & Session Control */}
        <div className="comic-box bg-white p-6 space-y-4">
          <h3 className="font-heading text-xl uppercase tracking-wide text-ink border-b-2 border-ink/20 pb-2">
            DEVICE & SECURITY RESTRICTIONS
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="font-comic text-xs uppercase text-ink block mb-1">
                MAX ACTIVE SESSIONS PER STUDENT
              </label>
              <select
                value={settings.max_sessions_per_user}
                onChange={(e) =>
                  setSettings({ ...settings, max_sessions_per_user: e.target.value })
                }
                className="comic-input text-xs py-2 bg-cream font-mono"
              >
                <option value="1">1 Active Device (Strict Single Device)</option>
                <option value="2">2 Devices (Laptop + Mobile)</option>
                <option value="5">5 Devices (Relaxed Mode)</option>
              </select>
              <span className="text-[10px] font-sans text-olive-dark mt-1 block">
                Enforces automatic revocation of oldest sessions on student login.
              </span>
            </div>

            <div>
              <label className="font-comic text-xs uppercase text-ink block mb-1">
                DIRECT PRIVATE 1-ON-1 MESSAGING
              </label>
              <select
                value={settings.enable_private_messaging}
                onChange={(e) =>
                  setSettings({ ...settings, enable_private_messaging: e.target.value })
                }
                className="comic-input text-xs py-2 bg-cream font-mono"
              >
                <option value="false">Disabled (Public Batch Channels Only)</option>
                <option value="true">Enabled (Allow Student DMs)</option>
              </select>
              <span className="text-[10px] font-sans text-olive-dark mt-1 block">
                Controls whether students can initiate private direct chats.
              </span>
            </div>
          </div>
        </div>

        {/* Scoring & Competition Rules */}
        <div className="comic-box bg-white p-6 space-y-4">
          <h3 className="font-heading text-xl uppercase tracking-wide text-ink border-b-2 border-ink/20 pb-2">
            DAILY MCQ SCORING RULES
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="font-comic text-xs uppercase text-ink block mb-1">
                POINTS PER CORRECT ANSWER
              </label>
              <input
                type="number"
                value={settings.scoring_correct_points || '10'}
                onChange={(e) =>
                  setSettings({ ...settings, scoring_correct_points: e.target.value })
                }
                className="comic-input text-xs py-2 bg-white"
              />
            </div>

            <div>
              <label className="font-comic text-xs uppercase text-ink block mb-1">
                PARTICIPATION BONUS POINTS
              </label>
              <input
                type="number"
                value={settings.scoring_participation_bonus || '5'}
                onChange={(e) =>
                  setSettings({ ...settings, scoring_participation_bonus: e.target.value })
                }
                className="comic-input text-xs py-2 bg-white"
              />
            </div>

            <div>
              <label className="font-comic text-xs uppercase text-ink block mb-1">
                DEFAULT QUESTIONS PER BATTLE
              </label>
              <input
                type="number"
                value={settings.mcq_questions_per_challenge || '10'}
                onChange={(e) =>
                  setSettings({ ...settings, mcq_questions_per_challenge: e.target.value })
                }
                className="comic-input text-xs py-2 bg-white"
              />
            </div>
          </div>
        </div>

        <ComicButton
          type="submit"
          variant="yellow"
          size="lg"
          loading={saving}
          icon={<Save className="w-5 h-5" />}
        >
          SAVE PLATFORM CONFIGURATION
        </ComicButton>
      </form>
    </div>
  );
};

export default PlatformSettings;

