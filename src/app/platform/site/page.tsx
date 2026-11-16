'use client';

import { Switch } from '@heroui/react';
import React, { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  ArrowDown,
  ArrowUp,
  ExternalLink,
  FileText,
  Scale,
  Globe,
  HelpCircle,
  LayoutList,
  Link2,
  Loader2,
  Megaphone,
  Plus,
  Save,
  Search,
  Sparkles,
  Tags,
  Trash2,
} from 'lucide-react';
import { toast } from 'sonner';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { CustomSelect } from '@/components/ui/CustomSelect';
import {
  SITE_SECTION_KEYS,
  SITE_SECTION_LABELS,
  type SiteContent,
  type SiteContentKey,
  type SiteLegalDoc,
} from '@/lib/site-content-schema';

/** Adresse publique du site vitrine (projet Vercel optispace-landing). */
const SITE_URL = process.env.NEXT_PUBLIC_LANDING_URL || 'https://space.optiwifi.site';

type Plan = { id: string; name: string; price: number; currency: string };

const TABS = [
  { value: 'links', label: 'Liens', icon: Link2 },
  { value: 'hero', label: 'Accroche', icon: Sparkles },
  { value: 'sections', label: 'Sections', icon: LayoutList },
  { value: 'pricing', label: 'Tarifs', icon: Tags },
  { value: 'faq', label: 'FAQ', icon: HelpCircle },
  { value: 'final_cta', label: 'Appel final', icon: Megaphone },
  { value: 'seo', label: 'Google', icon: Search },
  { value: 'cgu', label: 'CGU', icon: FileText },
  { value: 'cgv', label: 'CGV', icon: Scale },
] as const satisfies readonly { value: SiteContentKey; label: string; icon: unknown }[];

export default function PlatformSitePage() {
  return (
    <Suspense fallback={null}>
      <SiteContentEditor />
    </Suspense>
  );
}

function SiteContentEditor() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tabParam = searchParams.get('tab');
  const tab: SiteContentKey = TABS.some((t) => t.value === tabParam) ? (tabParam as SiteContentKey) : 'links';
  const selectTab = (value: SiteContentKey) =>
    router.replace(value === 'links' ? '/platform/site' : `/platform/site?tab=${value}`, { scroll: false });

  const [saved, setSaved] = useState<SiteContent | null>(null);
  const [draft, setDraft] = useState<SiteContent | null>(null);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/platform/site-content');
        const result = await res.json();
        if (!res.ok) throw new Error(result.error);
        setSaved(result.data.content);
        setDraft(result.data.content);
        setPlans(result.data.plans);
        setUpdatedAt(result.data.updatedAt);
      } catch {
        toast.error('Erreur de chargement du contenu du site');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) {
    return (
      <div className="py-10 flex justify-center items-center gap-2 text-muted text-sm font-medium">
        <Loader2 className="w-5 h-5 animate-spin text-accent" />
        <span>Chargement du site vitrine...</span>
      </div>
    );
  }
  if (!draft || !saved) {
    return <p className="py-10 text-center text-sm text-muted">Contenu du site indisponible.</p>;
  }

  const dirty = JSON.stringify(draft[tab]) !== JSON.stringify(saved[tab]);

  function set<K extends SiteContentKey>(key: K, value: SiteContent[K]) {
    setDraft((d) => (d ? { ...d, [key]: value } : d));
  }

  async function save() {
    if (!draft) return;
    setSaving(true);
    try {
      const res = await fetch('/api/platform/site-content', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: tab, value: draft[tab] }),
      });
      const result = await res.json();
      if (!res.ok) {
        toast.error(result.error || "Erreur lors de l'enregistrement");
        return;
      }
      setSaved((s) => (s ? { ...s, [tab]: result.data } : s));
      setDraft((d) => (d ? { ...d, [tab]: result.data } : d));
      setUpdatedAt(new Date().toISOString());
      toast.success('Enregistré. Le site sera à jour dans moins d’une minute.');
    } catch {
      toast.error("Erreur lors de l'enregistrement");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5 max-w-4xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Site vitrine</h1>
          <p className="text-xs text-muted">
            Textes, liens et sections de la page de présentation d&apos;OptiSpace.
            {updatedAt && ` Dernière modification : ${new Date(updatedAt).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })}.`}
          </p>
        </div>
        <div className="flex gap-2">
          <a
            href={SITE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-2 h-11 px-4 rounded-xl border border-border text-sm font-semibold text-foreground hover:bg-surface-secondary flex-1 sm:flex-none"
          >
            <ExternalLink className="w-4 h-4" /> Voir le site
          </a>
          <Button onClick={save} variant="secondary" className="gap-2 font-semibold flex-1 sm:flex-none" isLoading={saving} disabled={!dirty}>
            <Save className="w-4 h-4" /> Enregistrer
          </Button>
        </div>
      </div>

      <div role="tablist" aria-label="Rubriques du site" className="flex gap-1.5 overflow-x-auto -mx-1 px-1 pb-1">
        {TABS.map((t) => {
          const Icon = t.icon;
          const active = tab === t.value;
          const changed = JSON.stringify(draft[t.value]) !== JSON.stringify(saved[t.value]);
          return (
            <button
              key={t.value}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => selectTab(t.value)}
              className={`shrink-0 inline-flex items-center gap-2 h-10 px-4 rounded-xl text-sm font-semibold border transition ${
                active
                  ? 'bg-foreground text-background border-border '
                  : 'bg-surface text-muted border-border hover:border-border'
              }`}
            >
              <Icon className="w-4 h-4" /> {t.label}
              {changed && <span className="w-2 h-2 rounded-full bg-warning" aria-label="modifié, non enregistré" />}
            </button>
          );
        })}
      </div>

      {tab === 'links' && (
        <Section icon={Link2} title="Liens et redirections" hint="Où mènent les boutons du site. Lien complet commençant par https://">
          <Input
            label="Bouton « Essai gratuit » / « Créer mon espace »"
            value={draft.links.signup_url}
            onChange={(e) => set('links', { ...draft.links, signup_url: e.target.value })}
            placeholder="https://www.optiwifi.site/login"
          />
          <Input
            label="Bouton « Se connecter »"
            value={draft.links.login_url}
            onChange={(e) => set('links', { ...draft.links, login_url: e.target.value })}
            placeholder="https://www.optiwifi.site/login"
          />
          <Input
            label="Lien WhatsApp (facultatif)"
            value={draft.links.whatsapp_url}
            onChange={(e) => set('links', { ...draft.links, whatsapp_url: e.target.value })}
            placeholder="https://wa.me/2250700000000"
            helperText="Ajoute un bouton « Nous écrire sur WhatsApp » à l'appel final. Laisser vide pour le masquer."
          />
        </Section>
      )}

      {tab === 'hero' && (
        <Section icon={Sparkles} title="Accroche (haut de page)" hint="La première chose que voit le visiteur.">
          <Input label="Bandeau au-dessus du titre" value={draft.hero.badge} onChange={(e) => set('hero', { ...draft.hero, badge: e.target.value })} />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            <Input label="Titre, ligne 1 (blanc)" value={draft.hero.title_line1} onChange={(e) => set('hero', { ...draft.hero, title_line1: e.target.value })} />
            <Input label="Titre, ligne 2 (vert)" value={draft.hero.title_line2} onChange={(e) => set('hero', { ...draft.hero, title_line2: e.target.value })} />
          </div>
          <TextArea label="Sous-titre" value={draft.hero.subtitle} onChange={(v) => set('hero', { ...draft.hero, subtitle: v })} />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            <Input label="Bouton principal" value={draft.hero.cta_primary} onChange={(e) => set('hero', { ...draft.hero, cta_primary: e.target.value })} />
            <Input label="Bouton secondaire" value={draft.hero.cta_secondary} onChange={(e) => set('hero', { ...draft.hero, cta_secondary: e.target.value })} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
            {[0, 1, 2].map((i) => (
              <Input
                key={i}
                label={`Argument ${i + 1}`}
                value={draft.hero.trust[i] ?? ''}
                onChange={(e) => {
                  const trust = [0, 1, 2].map((j) => (j === i ? e.target.value : draft.hero.trust[j] ?? ''));
                  set('hero', { ...draft.hero, trust });
                }}
              />
            ))}
          </div>
        </Section>
      )}

      {tab === 'sections' && (
        <Section icon={LayoutList} title="Sections affichées" hint="Masquez une section sans la supprimer : elle réapparaît dès que vous la réactivez.">
          <ul className="divide-y divide-separator">
            {SITE_SECTION_KEYS.map((k) => (
              <li key={k} className="flex items-center justify-between gap-4 py-3">
                <span className="text-sm font-medium text-foreground">{SITE_SECTION_LABELS[k]}</span>
                <Toggle checked={draft.sections[k]} onChange={(v) => set('sections', { ...draft.sections, [k]: v })} label={SITE_SECTION_LABELS[k]} />
              </li>
            ))}
          </ul>
        </Section>
      )}

      {tab === 'pricing' && (
        <Section
          icon={Tags}
          title="Tarifs"
          hint="Les forfaits, leurs prix et leurs limites viennent directement de Licences → Forfaits : une seule saisie pour l'outil et le site."
        >
          <Input label="Titre" value={draft.pricing.title} onChange={(e) => set('pricing', { ...draft.pricing, title: e.target.value })} />
          <TextArea label="Sous-titre" value={draft.pricing.subtitle} onChange={(v) => set('pricing', { ...draft.pricing, subtitle: v })} />
          <CustomSelect
            label="Forfait mis en avant (« Recommandé »)"
            value={draft.pricing.featured_plan_id ?? ''}
            onChange={(v) => set('pricing', { ...draft.pricing, featured_plan_id: v || null })}
            options={[{ value: '', label: 'Aucun' }, ...plans.map((p) => ({ value: p.id, label: p.name, sublabel: formatPrice(p) }))]}
          />
          <div>
            <p className="text-xs sm:text-xs font-semibold text-muted mb-2">Forfaits affichés sur le site</p>
            <ul className="divide-y divide-separator rounded-xl border border-border px-4">
              {plans.length === 0 && <li className="py-3 text-sm text-muted">Aucun forfait actif.</li>}
              {plans.map((p) => {
                const shown = !draft.pricing.hidden_plan_ids.includes(p.id);
                return (
                  <li key={p.id} className="flex items-center justify-between gap-4 py-3">
                    <span className="text-sm text-foreground">
                      <strong>{p.name}</strong> <span className="text-muted">· {formatPrice(p)}</span>
                    </span>
                    <Toggle
                      checked={shown}
                      label={`Afficher ${p.name}`}
                      onChange={(v) =>
                        set('pricing', {
                          ...draft.pricing,
                          hidden_plan_ids: v
                            ? draft.pricing.hidden_plan_ids.filter((id) => id !== p.id)
                            : [...draft.pricing.hidden_plan_ids, p.id],
                        })
                      }
                    />
                  </li>
                );
              })}
            </ul>
          </div>
        </Section>
      )}

      {tab === 'faq' && (
        <Section icon={HelpCircle} title="Questions fréquentes" hint="Les réponses aux objections des visiteurs, dans l'ordre affiché.">
          <div className="space-y-4">
            {draft.faq.items.map((item, i) => {
              const items = draft.faq.items;
              const update = (next: typeof items) => set('faq', { items: next });
              return (
                <div key={i} className="rounded-xl border border-border p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-muted">Question {i + 1}</span>
                    <div className="flex gap-1">
                      <IconButton label="Monter" disabled={i === 0} onClick={() => update(move(items, i, i - 1))} icon={ArrowUp} />
                      <IconButton label="Descendre" disabled={i === items.length - 1} onClick={() => update(move(items, i, i + 1))} icon={ArrowDown} />
                      <IconButton label="Supprimer" danger onClick={() => update(items.filter((_, j) => j !== i))} icon={Trash2} />
                    </div>
                  </div>
                  <Input label="Question" value={item.q} onChange={(e) => update(items.map((it, j) => (j === i ? { ...it, q: e.target.value } : it)))} />
                  <TextArea label="Réponse" value={item.a} onChange={(v) => update(items.map((it, j) => (j === i ? { ...it, a: v } : it)))} />
                </div>
              );
            })}
          </div>
          <Button
            variant="outline"
            className="gap-2"
            disabled={draft.faq.items.length >= 20}
            onClick={() => set('faq', { items: [...draft.faq.items, { q: '', a: '' }] })}
          >
            <Plus className="w-4 h-4" /> Ajouter une question
          </Button>
        </Section>
      )}

      {tab === 'final_cta' && (
        <Section icon={Megaphone} title="Appel final (bas de page)" hint="Le dernier message avant que le visiteur parte.">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            <Input label="Titre" value={draft.final_cta.title} onChange={(e) => set('final_cta', { ...draft.final_cta, title: e.target.value })} />
            <Input label="Fin du titre (en vert)" value={draft.final_cta.highlight} onChange={(e) => set('final_cta', { ...draft.final_cta, highlight: e.target.value })} />
          </div>
          <TextArea label="Texte" value={draft.final_cta.text} onChange={(v) => set('final_cta', { ...draft.final_cta, text: v })} />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            <Input label="Bouton" value={draft.final_cta.cta_label} onChange={(e) => set('final_cta', { ...draft.final_cta, cta_label: e.target.value })} />
            <Input label="Mention sous le bouton" value={draft.final_cta.note} onChange={(e) => set('final_cta', { ...draft.final_cta, note: e.target.value })} />
          </div>
        </Section>
      )}

      {tab === 'seo' && (
        <Section icon={Globe} title="Référencement Google" hint="Le titre et la description qui apparaissent dans les résultats Google et les partages WhatsApp.">
          <Input
            label={`Titre (${draft.seo.title.length}/70)`}
            value={draft.seo.title}
            onChange={(e) => set('seo', { ...draft.seo, title: e.target.value })}
          />
          <TextArea
            label={`Description (${draft.seo.description.length}/170)`}
            value={draft.seo.description}
            onChange={(v) => set('seo', { ...draft.seo, description: v })}
          />
        </Section>
      )}

      {(tab === 'cgu' || tab === 'cgv') && (
        <LegalEditor
          key={tab}
          kind={tab}
          doc={draft[tab]}
          onChange={(doc) => set(tab, doc)}
        />
      )}
    </div>
  );
}

function Section({ icon: Icon, title, hint, children }: { icon: React.ElementType; title: string; hint: string; children: React.ReactNode }) {
  return (
    <Card className="space-y-4">
      <div className="flex items-center gap-3 pb-4 border-b border-border">
        <Icon className="w-5 h-5 text-warning-soft-foreground" />
        <div>
          <p className="text-sm font-semibold text-foreground">{title}</p>
          <p className="text-xs text-muted">{hint}</p>
        </div>
      </div>
      {children}
    </Card>
  );
}

const LEGAL_LABELS = {
  cgu: { short: 'CGU', title: "Conditions générales d'utilisation", path: '/cgu' },
  cgv: { short: 'CGV', title: 'Conditions générales de vente', path: '/cgv' },
} as const;

/** Éditeur des CGU / CGV : publiées sur le site (page + PDF) dès l'enregistrement. */
function LegalEditor({ kind, doc, onChange }: { kind: 'cgu' | 'cgv'; doc: SiteLegalDoc; onChange: (doc: SiteLegalDoc) => void }) {
  const meta = LEGAL_LABELS[kind];
  const sections = doc.sections;
  const setSections = (next: SiteLegalDoc['sections']) => onChange({ ...doc, sections: next });
  const updated = doc.updated_at
    ? new Date(`${doc.updated_at}T12:00:00`).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
    : '—';

  return (
    <Section
      icon={kind === 'cgu' ? FileText : Scale}
      title={meta.title}
      hint={`Publiées sur ${SITE_URL}${meta.path} et dans le PDF téléchargeable, moins d'une minute après l'enregistrement.`}
    >
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-xl bg-surface-secondary px-4 py-3 text-xs text-muted">
        <span>
          Dernière mise à jour publiée : <strong>{updated}</strong> (mise à jour automatiquement à l&apos;enregistrement)
        </span>
        <a href={`${SITE_URL}${meta.path}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-semibold text-accent hover:underline">
          <ExternalLink className="w-3.5 h-3.5" /> Voir la page
        </a>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-[160px_1fr] gap-3 sm:gap-4">
        <Input label="Version" value={doc.version} onChange={(e) => onChange({ ...doc, version: e.target.value })} placeholder="1.1" />
        <TextArea label="Introduction" value={doc.intro} onChange={(v) => onChange({ ...doc, intro: v })} />
      </div>

      <p className="text-xs text-muted">
        Dans le texte d&apos;une section : une ligne vide sépare deux paragraphes ; une ligne qui commence par « - » devient une puce.
        Pensez à augmenter le numéro de version lors d&apos;un changement important.
      </p>

      <div className="space-y-4">
        {sections.map((sec, i) => (
          <div key={i} className="rounded-xl border border-border p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-muted">Section {i + 1}</span>
              <div className="flex gap-1">
                <IconButton label="Monter" disabled={i === 0} onClick={() => setSections(move(sections, i, i - 1))} icon={ArrowUp} />
                <IconButton label="Descendre" disabled={i === sections.length - 1} onClick={() => setSections(move(sections, i, i + 1))} icon={ArrowDown} />
                <IconButton
                  label="Supprimer"
                  danger
                  disabled={sections.length <= 1}
                  onClick={() => setSections(sections.filter((_, j) => j !== i))}
                  icon={Trash2}
                />
              </div>
            </div>
            <Input
              label="Titre"
              value={sec.title}
              onChange={(e) => setSections(sections.map((s, j) => (j === i ? { ...s, title: e.target.value } : s)))}
            />
            <TextArea
              label="Texte"
              rows={8}
              value={sec.body}
              onChange={(v) => setSections(sections.map((s, j) => (j === i ? { ...s, body: v } : s)))}
            />
          </div>
        ))}
      </div>

      <Button
        variant="outline"
        className="gap-2"
        disabled={sections.length >= 40}
        onClick={() => setSections([...sections, { title: `${sections.length + 1}. Nouvelle section`, body: '' }])}
      >
        <Plus className="w-4 h-4" /> Ajouter une section
      </Button>
    </Section>
  );
}

function TextArea({ label, value, onChange, rows = 3 }: { label: string; value: string; onChange: (v: string) => void; rows?: number }) {
  const id = React.useId();
  return (
    <div className="space-y-5 w-full">
      <label htmlFor={id} className="block text-xs sm:text-xs font-semibold text-muted">
        {label}
      </label>
      <textarea
        id={id}
        rows={rows}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="textarea textarea--primary w-full resize-y"
      />
    </div>
  );
}

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <Switch aria-label={label} isSelected={checked} onChange={onChange} className="shrink-0">
      <Switch.Control>
        <Switch.Thumb />
      </Switch.Control>
    </Switch>
  );
}

function IconButton({
  icon: Icon,
  label,
  onClick,
  disabled,
  danger,
}: {
  icon: React.ElementType;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={`grid h-9 w-9 place-items-center rounded-xl transition disabled:opacity-30 ${
        danger ? 'text-danger hover:bg-danger-soft ' : 'text-muted hover:bg-default '
      }`}
    >
      <Icon className="w-4 h-4" />
    </button>
  );
}

function move<T>(list: T[], from: number, to: number): T[] {
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

function formatPrice(p: Plan) {
  return p.price === 0 ? 'Gratuit' : `${new Intl.NumberFormat('fr-FR').format(p.price)} ${p.currency === 'XOF' ? 'FCFA' : p.currency}`;
}
