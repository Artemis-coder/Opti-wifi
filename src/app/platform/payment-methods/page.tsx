'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, Eye, EyeOff, ImagePlus, Loader2, Pencil, Plus, QrCode, Trash2, X } from 'lucide-react';
import { toast } from 'sonner';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { confirmAction } from '@/components/ui/ConfirmDialog';
import {
  DEFAULT_BRAND_COLOR,
  PaymentMethodPreview,
  PaymentQrThumb,
  type PublicPaymentMethod,
} from '@/components/payments/PaymentMethodCard';
import { cn } from '@/lib/utils/cn';
import { normalizeWhatsappUrl, whatsappFromNumber } from '@/lib/whatsapp';

interface PaymentMethod extends PublicPaymentMethod {
  is_active: boolean;
  sort_order: number;
}

const EMPTY_FORM = {
  name: 'Wave',
  account_number: '',
  account_name: '',
  whatsapp_url: '',
  description: '',
  logo: null as string | null,
  brand_logo: null as string | null,
  brand_color: DEFAULT_BRAND_COLOR,
  is_active: true,
};
type FormState = typeof EMPTY_FORM;

// Mêmes limites que côté serveur (src/lib/payment-methods.ts)
const MAX_QR_LENGTH = 1_000_000;
const MAX_BRAND_LOGO_LENGTH = 300_000;
const COLOR_RE = /^#[0-9a-fA-F]{6}$/;

/**
 * Prépare une image dans le navigateur : réduite à `maxSize` px, encodée en PNG (sans perte, le QR code
 * reste scannable) ; repli en JPEG haute qualité si le PNG dépasse `maxLength`.
 */
function prepareImage(file: File, maxSize: number, maxLength: number, opaque: boolean): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(img.width * scale));
      canvas.height = Math.max(1, Math.round(img.height * scale));
      const ctx = canvas.getContext('2d');
      if (!ctx) return reject(new Error('canvas'));
      if (opaque) {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      const png = canvas.toDataURL('image/png');
      if (png.length <= maxLength) return resolve(png);
      const jpeg = canvas.toDataURL('image/jpeg', 0.92);
      if (opaque && jpeg.length <= maxLength) return resolve(jpeg);
      reject(new Error('too_big'));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('image'));
    };
    img.src = url;
  });
}

function ImageField({
  label,
  help,
  value,
  onPick,
  onClear,
  preview,
}: {
  label: string;
  help: string;
  value: string | null;
  onPick: (file: File) => void;
  onClear: () => void;
  preview: React.ReactNode;
}) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <div className="space-y-1.5">
      <p className="block text-[11px] sm:text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider">{label}</p>
      <div className="flex items-center gap-3">
        {preview}
        <div className="flex flex-col gap-2">
          <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={() => ref.current?.click()}>
            <ImagePlus className="w-4 h-4" /> {value ? 'Changer' : 'Importer'}
          </Button>
          {value && (
            <Button type="button" variant="ghost" size="sm" className="gap-1.5" onClick={onClear}>
              <X className="w-4 h-4" /> Retirer
            </Button>
          )}
        </div>
        <input
          ref={ref}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = '';
            if (file) onPick(file);
          }}
        />
      </div>
      <p className="text-xs text-slate-500">{help}</p>
    </div>
  );
}

export default function PaymentMethodsPage() {
  const [methods, setMethods] = useState<PaymentMethod[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<PaymentMethod | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const load = useCallback(
    () =>
      fetch('/api/platform/payment-methods')
        .then(async (res) => {
          const data = await res.json();
          if (!res.ok) throw new Error(data.error);
          setMethods(data.data || []);
        })
        .catch((err) => toast.error(err instanceof Error && err.message ? err.message : 'Erreur de chargement'))
        .finally(() => setLoading(false)),
    []
  );

  useEffect(() => {
    load();
  }, [load]);

  const openModal = (m?: PaymentMethod) => {
    setEditing(m || null);
    setForm(
      m
        ? {
            name: m.name,
            account_number: m.account_number,
            account_name: m.account_name || '',
            whatsapp_url: m.whatsapp_url || '',
            description: m.description || '',
            logo: m.logo,
            brand_logo: m.brand_logo,
            brand_color: m.brand_color || DEFAULT_BRAND_COLOR,
            is_active: m.is_active,
          }
        : EMPTY_FORM
    );
    setModalOpen(true);
  };

  const pickImage = async (file: File, field: 'logo' | 'brand_logo') => {
    if (!/^image\/(png|jpeg|webp)$/.test(file.type)) {
      toast.error('Choisissez une image PNG, JPEG ou WebP');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error('Image trop lourde (10 Mo max)');
      return;
    }
    try {
      // QR code : 1000 px max, fond blanc ; logo : 256 px, transparence conservée
      const data =
        field === 'logo' ? await prepareImage(file, 1000, MAX_QR_LENGTH, true) : await prepareImage(file, 256, MAX_BRAND_LOGO_LENGTH, false);
      setForm((f) => ({ ...f, [field]: data }));
    } catch (err) {
      toast.error(err instanceof Error && err.message === 'too_big' ? 'Image trop lourde : recadrez-la' : "Impossible de lire l'image");
    }
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.account_number.trim()) {
      toast.error('Opérateur et numéro de paiement requis');
      return;
    }
    if (!form.logo) {
      toast.error('Importez le QR code de paiement');
      return;
    }
    if (normalizeWhatsappUrl(form.whatsapp_url) === false) {
      toast.error('Lien WhatsApp invalide');
      return;
    }
    if (!COLOR_RE.test(form.brand_color)) {
      toast.error('Couleur invalide (format #1dc3ff)');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/platform/payment-methods', {
        method: editing ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editing ? { id: editing.id, ...form } : form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success(editing ? 'Moyen de paiement modifié' : 'Moyen de paiement ajouté');
      setModalOpen(false);
      await load();
    } catch (err) {
      toast.error(err instanceof Error && err.message ? err.message : "Échec de l'enregistrement");
    } finally {
      setSaving(false);
    }
  };

  const patch = async (id: string, changes: Partial<PaymentMethod>, success: string) => {
    setBusyId(id);
    try {
      const res = await fetch('/api/platform/payment-methods', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, ...changes }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      if (success) toast.success(success);
      await load();
    } catch (err) {
      toast.error(err instanceof Error && err.message ? err.message : 'Échec de la modification');
    } finally {
      setBusyId(null);
    }
  };

  // Échange l'ordre d'affichage avec le voisin (renumérote pour éviter les égalités)
  const move = async (index: number, delta: -1 | 1) => {
    const target = index + delta;
    if (target < 0 || target >= methods.length) return;
    const reordered = [...methods];
    [reordered[index], reordered[target]] = [reordered[target], reordered[index]];
    setMethods(reordered);
    setBusyId(methods[index].id);
    try {
      await Promise.all(
        reordered.map((m, i) =>
          m.sort_order === i
            ? null
            : fetch('/api/platform/payment-methods', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: m.id, sort_order: i }),
              })
        )
      );
    } finally {
      setBusyId(null);
      await load();
    }
  };

  const remove = async (m: PaymentMethod) => {
    const ok = await confirmAction(
      `Supprimer « ${m.name} » ?\n\nIl ne sera plus proposé aux clients. Les demandes de licence qui le citaient gardent leur référence de transaction.\nPour le masquer temporairement, utilisez plutôt « Masquer ».`,
      { title: 'Supprimer le moyen de paiement', confirmLabel: 'Supprimer' }
    );
    if (!ok) return;
    setBusyId(m.id);
    try {
      const res = await fetch(`/api/platform/payment-methods?id=${m.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success('Moyen de paiement supprimé');
      await load();
    } catch (err) {
      toast.error(err instanceof Error && err.message ? err.message : 'Échec de la suppression');
    } finally {
      setBusyId(null);
    }
  };

  const activeCount = methods.filter((m) => m.is_active).length;
  const normalizedWhatsapp = normalizeWhatsappUrl(form.whatsapp_url);
  const whatsappError =
    normalizedWhatsapp === false ? 'Lien WhatsApp attendu (wa.me/…, api.whatsapp.com/…) ou numéro de téléphone' : undefined;
  const whatsappPreview = normalizedWhatsapp || null;

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">Moyens de paiement</h1>
          <p className="text-xs text-slate-500">
            Affichés au client quand il se réabonne : affiche « Payez avec Wave » avec votre QR code, numéro à copier et numéro pour le
            justificatif de paiement.
          </p>
        </div>
        <Button onClick={() => openModal()} className="gap-2 font-semibold w-full sm:w-auto">
          <Plus className="w-4 h-4" /> Ajouter un moyen
        </Button>
      </div>

      {loading ? (
        <div className="py-16 flex justify-center text-slate-400">
          <Loader2 className="w-6 h-6 animate-spin" />
        </div>
      ) : methods.length === 0 ? (
        <Card className="p-10 text-center space-y-3">
          <QrCode className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto" />
          <h3 className="text-base font-bold text-slate-900 dark:text-white">Aucun moyen de paiement</h3>
          <p className="text-xs text-slate-500">
            Ajoutez Wave avec votre QR code : vos clients le verront en cliquant sur « Me réabonner ».
          </p>
          <Button onClick={() => openModal()} variant="secondary" className="font-bold gap-2">
            <Plus className="w-4 h-4" /> Ajouter un moyen
          </Button>
        </Card>
      ) : (
        <>
          {activeCount === 0 && (
            <p className="text-xs font-medium text-amber-700 dark:text-amber-400 bg-amber-500/10 border border-amber-500/30 rounded-xl px-4 py-3">
              Aucun moyen affiché : les clients ne voient aucun QR code pour payer.
            </p>
          )}
          <div className="space-y-3">
            {methods.map((m, i) => (
              <Card key={m.id} className={cn('p-4 sm:p-5', !m.is_active && 'opacity-70')}>
                <div className="flex flex-col sm:flex-row gap-4 sm:items-center">
                  <div className="flex gap-3.5 min-w-0 flex-1">
                    <PaymentQrThumb method={m} />
                    <div className="min-w-0 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-bold text-slate-900 dark:text-white">{m.name}</p>
                        <Badge variant={m.is_active ? 'success' : 'neutral'}>{m.is_active ? 'Affiché aux clients' : 'Masqué'}</Badge>
                      </div>
                      <p className="text-xs text-slate-500">
                        Paiement : <span className="font-mono font-semibold text-slate-800 dark:text-slate-200">{m.account_number}</span>
                      </p>
                      <p className="text-xs text-slate-500 break-all">
                        Justificatif :{' '}
                        <a
                          href={m.whatsapp_url || whatsappFromNumber(m.account_number)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-semibold text-emerald-700 dark:text-emerald-400 hover:underline"
                        >
                          {(m.whatsapp_url || whatsappFromNumber(m.account_number)).replace(/^https:\/\//, '')}
                        </a>
                      </p>
                      {!m.logo && <p className="text-xs font-medium text-amber-700 dark:text-amber-400">QR code manquant</p>}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 flex-wrap sm:flex-nowrap sm:justify-end">
                    <Button variant="ghost" size="sm" aria-label="Monter" disabled={i === 0 || !!busyId} onClick={() => move(i, -1)}>
                      <ArrowUp className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      aria-label="Descendre"
                      disabled={i === methods.length - 1 || !!busyId}
                      onClick={() => move(i, 1)}
                    >
                      <ArrowDown className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1.5"
                      disabled={busyId === m.id}
                      onClick={() => patch(m.id, { is_active: !m.is_active }, m.is_active ? 'Masqué aux clients' : 'Affiché aux clients')}
                    >
                      {m.is_active ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      {m.is_active ? 'Masquer' : 'Afficher'}
                    </Button>
                    <Button variant="outline" size="sm" className="gap-1.5" onClick={() => openModal(m)}>
                      <Pencil className="w-4 h-4" /> Modifier
                    </Button>
                    <Button variant="ghost" size="sm" aria-label={`Supprimer ${m.name}`} disabled={busyId === m.id} onClick={() => remove(m)}>
                      <Trash2 className="w-4 h-4 text-red-500" />
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </>
      )}

      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Modifier le moyen de paiement' : 'Nouveau moyen de paiement'}
        className="md:max-w-4xl"
      >
        <form onSubmit={save} className="grid gap-6 md:grid-cols-[1fr_20rem]">
          <div className="space-y-4">
            <ImageField
              label="QR code de paiement *"
              help="Votre QR code (Wave Business). Il remplace le QR code de l'affiche « Payez avec Wave »."
              value={form.logo}
              onPick={(f) => pickImage(f, 'logo')}
              onClear={() => setForm((f) => ({ ...f, logo: null }))}
              preview={<PaymentQrThumb method={form} />}
            />
            <Input
              label="Opérateur *"
              placeholder="ex : Wave"
              value={form.name}
              maxLength={100}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
            />
            <ImageField
              label="Logo de l'opérateur"
              help="Facultatif : affiché à côté de « Payez avec » (ex. le pingouin Wave, fond transparent)."
              value={form.brand_logo}
              onPick={(f) => pickImage(f, 'brand_logo')}
              onClear={() => setForm((f) => ({ ...f, brand_logo: null }))}
              preview={
                <span className="w-16 h-16 shrink-0 rounded-xl flex items-center justify-center" style={{ background: form.brand_color }}>
                  {form.brand_logo ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={form.brand_logo} alt="" className="w-12 h-12 object-contain" />
                  ) : (
                    <ImagePlus className="w-6 h-6 text-white/70" />
                  )}
                </span>
              }
            />
            <div className="space-y-1.5">
              <label htmlFor="pm-color" className="block text-[11px] sm:text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                Couleur de l&apos;affiche
              </label>
              <div className="flex items-center gap-2">
                <span className="w-11 h-11 shrink-0 rounded-xl border border-slate-200 dark:border-slate-700" style={{ background: form.brand_color }} />
                <input
                  id="pm-color"
                  value={form.brand_color}
                  maxLength={7}
                  onChange={(e) => setForm({ ...form, brand_color: e.target.value.trim() })}
                  className="w-32 h-11 px-3 font-mono bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-base sm:text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
                {form.brand_color !== DEFAULT_BRAND_COLOR && (
                  <Button type="button" variant="ghost" size="sm" onClick={() => setForm({ ...form, brand_color: DEFAULT_BRAND_COLOR })}>
                    Bleu Wave
                  </Button>
                )}
              </div>
            </div>
            <Input
              label="Numéro de paiement *"
              placeholder="ex : +225 07 00 00 00 00"
              inputMode="tel"
              value={form.account_number}
              maxLength={50}
              onChange={(e) => setForm({ ...form, account_number: e.target.value })}
              helperText="Le client peut le copier au lieu de scanner le QR code."
              required
            />
            <Input
              label="Titulaire du compte"
              placeholder="ex : OptiWifi"
              value={form.account_name}
              maxLength={100}
              onChange={(e) => setForm({ ...form, account_name: e.target.value })}
            />
            <Input
              label="Lien WhatsApp pour le justificatif"
              placeholder="ex : https://wa.me/2250700000000"
              inputMode="url"
              value={form.whatsapp_url}
              maxLength={300}
              onChange={(e) => setForm({ ...form, whatsapp_url: e.target.value })}
              error={whatsappError}
              helperText="Le bouton « Envoyer le justificatif sur WhatsApp » ouvre ce lien. Vide = numéro de paiement."
            />
            <div className="space-y-1.5">
              <label
                htmlFor="pm-description"
                className="block text-[11px] sm:text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider"
              >
                Instructions (facultatif)
              </label>
              <textarea
                id="pm-description"
                rows={3}
                maxLength={1000}
                placeholder="ex : Payez le montant exact du forfait."
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                className="w-full px-4 sm:px-3.5 py-3 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-base sm:text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
              />
            </div>
            <label className="flex items-center gap-3 text-sm font-medium text-slate-700 dark:text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={form.is_active}
                onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
                className="w-5 h-5 rounded accent-brand-600"
              />
              Afficher aux clients
            </label>
          </div>

          {/* Aperçu côté client */}
          <div className="space-y-1.5">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Aperçu pour le client</p>
            <PaymentMethodPreview
              method={{
                id: 'preview',
                name: form.name || 'Opérateur',
                account_number: form.account_number || 'Numéro',
                account_name: form.account_name || null,
                whatsapp_url: whatsappPreview,
                description: form.description || null,
                logo: form.logo,
                brand_logo: form.brand_logo,
                brand_color: COLOR_RE.test(form.brand_color) ? form.brand_color : DEFAULT_BRAND_COLOR,
              }}
            />
          </div>

          <div className="md:col-span-2 flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setModalOpen(false)}>
              Annuler
            </Button>
            <Button type="submit" isLoading={saving}>
              {editing ? 'Enregistrer' : 'Ajouter'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
