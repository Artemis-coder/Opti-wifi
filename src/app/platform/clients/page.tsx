"use client";

import React, { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  Building2,
  Search,
  Filter,
  Loader2,
  MoreHorizontal,
  CheckCircle,
  PauseCircle,
  Ban,
  Clock,
  Zap,
  AlertCircle,
  Trash2,
  Download,
  Hourglass,
  BadgeCheck,
  CalendarX,
} from "lucide-react";
import { Card } from "@/components/ui/Card";
import { StatTile } from "@/components/ui/StatTile";
import { KpiGrid } from "@/components/ui/KpiGrid";
import { Button, buttonClassName } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { formatCurrencyFCFA, formatDateFR } from "@/lib/utils/format";
import { OrganizationStatus } from "@/types/platform";
import { ResponsiveTable } from "@/components/ui/ResponsiveTable";
import { confirmAction } from "@/components/ui/ConfirmDialog";
import { ExportClientsModal } from "./ExportClientsModal";
import {
  CLIENT_STATUS_LABELS,
  OFFER_STATUS_LABELS,
  type ClientStatus,
  type OfferStatus,
} from "@/lib/platform-client-status";

interface ClientOrg {
  id: string;
  name: string;
  contact_name?: string | null;
  email?: string | null;
  phone?: string | null;
  status: OrganizationStatus;
  currency: string;
  created_at: string;
  plan_name?: string | null;
  subscription_status?: string | null;
  subscription_end_date?: string | null;
  subscription_trial_end?: string | null;
  client_status: ClientStatus;
  offer_status: OfferStatus;
  offer_end_date?: string | null;
}

interface ClientCounts {
  total: number;
  client_active: number;
  client_pending: number;
  client_suspended: number;
  offer_active: number;
  offer_trial: number;
  offer_expiring: number;
  offer_expired: number;
  new_7d: number;
}

type Tone = "success" | "warning" | "danger" | "info" | "neutral";

const CLIENT_TONES: Record<ClientStatus, Tone> = {
  active: "success",
  pending: "warning",
  suspended: "danger",
  refused: "neutral",
  deleted: "neutral",
};

const OFFER_TONES: Record<OfferStatus, Tone> = {
  active: "success",
  trial: "info",
  expiring: "warning",
  expired: "danger",
  unpaid: "danger",
  suspended: "danger",
  cancelled: "neutral",
  none: "neutral",
};

const CLIENT_FILTERS: { value: string; label: string }[] = [
  { value: "all", label: "Tous" },
  { value: "active", label: "Actifs" },
  { value: "pending", label: "En attente" },
  { value: "suspended", label: "Suspendus" },
  { value: "refused", label: "Refusés" },
  { value: "deleted", label: "Supprimés" },
];

const OFFER_FILTERS: { value: string; label: string }[] = [
  { value: "all", label: "Toutes" },
  { value: "active", label: "Active" },
  { value: "trial", label: "Essai" },
  { value: "expiring", label: "Expire bientôt" },
  { value: "expired", label: "Expirée" },
  { value: "unpaid", label: "Impayée" },
  { value: "suspended", label: "Suspendue" },
  { value: "none", label: "Aucune offre" },
];

const STATUS_ICONS: Record<OrganizationStatus, React.ElementType> = {
  pending_approval: AlertCircle,
  trial: Clock,
  active: CheckCircle,
  expiring: Clock,
  expired: Ban,
  suspended: PauseCircle,
  cancelled: Ban,
  archived: AlertCircle,
};

export default function PlatformClientsPage() {
  return (
    <Suspense>
      <PlatformClientsContent />
    </Suspense>
  );
}

function PlatformClientsContent() {
  // ?q= : recherche lancée depuis l'en-tête du back-office
  const urlQuery = useSearchParams().get("q") ?? "";
  const [clients, setClients] = useState<ClientOrg[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState(urlQuery);
  const [prevUrlQuery, setPrevUrlQuery] = useState(urlQuery);
  if (urlQuery !== prevUrlQuery) {
    setPrevUrlQuery(urlQuery);
    setSearch(urlQuery);
  }
  const [clientFilter, setClientFilter] = useState("all");
  const [offerFilter, setOfferFilter] = useState("all");
  const [counts, setCounts] = useState<ClientCounts | null>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [actionOrgId, setActionOrgId] = useState<string | null>(null);

  useEffect(() => {
    async function fetchClients() {
      setLoading(true);
      try {
        const params = new URLSearchParams({
          search,
          client: clientFilter === "all" ? "" : clientFilter,
          offer: offerFilter === "all" ? "" : offerFilter,
          limit: "100",
          counts: "1",
        });
        const res = await fetch(`/api/platform/clients?${params}`);
        const result = await res.json();
        if (res.ok) {
          setClients(result.data || []);
          if (result.counts) setCounts(result.counts);
        }
      } catch (err) {
        console.warn("Clients fetch error:", err);
      } finally {
        setLoading(false);
      }
    }

    fetchClients();
  }, [search, clientFilter, offerFilter]);

  const handleStatusAction = async (
    orgId: string,
    action: string,
    orgName: string,
  ) => {
    const actionLabels: Record<string, string> = {
      approve: "valider",
      activate: "activer l'espace de",
      suspend: "suspendre l'espace de",
      reactivate: "réactiver l'espace de",
      cancel: "refuser",
      archive: "supprimer",
    };
    const label = actionLabels[action] || action;
    const consequence: Record<string, string> = {
      suspend:
        "\n\nTous ses membres perdent immédiatement l'accès. Vous pourrez le réactiver.",
      archive:
        "\n\nTous ses membres perdent immédiatement l'accès. Les données sont conservées et l'organisation peut être réactivée.",
    };

    const danger = ["suspend", "archive", "cancel"].includes(action);
    if (
      !(await confirmAction(
        `Voulez-vous vraiment ${label} « ${orgName} » ?${consequence[action] || ""}`,
        { danger },
      ))
    ) {
      return;
    }

    setActionLoading(action);
    setActionOrgId(orgId);

    try {
      const res = await fetch("/api/platform/clients/action", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizationId: orgId,
          action,
          reason: "Super admin action",
        }),
      });

      const result = await res.json();
      if (res.ok) {
        setClients((prev) =>
          prev.map((c: ClientOrg) =>
            c.id === orgId
              ? {
                  ...c,
                  status: result.new_status,
                  client_status: toClientStatus(result.new_status),
                }
              : c,
          ),
        );
      }
    } catch (err) {
      console.warn("Action error:", err);
    } finally {
      setActionLoading(null);
      setActionOrgId(null);
    }
  };

  const clientBadge = (st: ClientStatus) => (
    <Badge
      variant={CLIENT_TONES[st] || "neutral"}
      className="text-xs font-medium"
    >
      {CLIENT_STATUS_LABELS[st] || st}
    </Badge>
  );
  const offerBadge = (st: OfferStatus) => (
    <Badge
      variant={OFFER_TONES[st] || "neutral"}
      className="text-xs font-medium"
    >
      {OFFER_STATUS_LABELS[st] || st}
    </Badge>
  );
  const c = counts;

  return (
    <div className="space-y-5 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Clients
          </h1>
          <p className="text-xs text-muted">
            Gérez tous les comptes clients de la plateforme SaaS.
          </p>
        </div>
        <Button
          variant="outline"
          icon={Download}
          onClick={() => setExportOpen(true)}
        >
          Exporter
        </Button>
      </div>

      {/* Chiffres clés : statut du client puis statut de l'offre (tous les clients, hors supprimés) */}
      <KpiGrid cols={{ base: 2, lg: 4 }}>
        <StatTile
          label="Total clients"
          value={c?.total ?? "—"}
          icon={Building2}
          accent="indigo"
          hint={
            c
              ? `${c.new_7d} nouveau${c.new_7d > 1 ? "x" : ""} cette semaine`
              : "Clients inscrits"
          }
        />
        <StatTile
          label="Clients actifs"
          value={c?.client_active ?? "—"}
          icon={CheckCircle}
          accent="emerald"
          hint="Compte validé"
        />
        <StatTile
          label="En attente"
          value={c?.client_pending ?? "—"}
          icon={AlertCircle}
          accent="amber"
          hint="Inscriptions à valider"
          href="/platform/registrations"
        />
        <StatTile
          label="Suspendus"
          value={c?.client_suspended ?? "—"}
          icon={PauseCircle}
          accent="red"
          hint="Accès coupé"
        />
        <StatTile
          label="Offre active"
          value={c?.offer_active ?? "—"}
          icon={BadgeCheck}
          accent="emerald"
          hint="Licence payée en cours"
        />
        <StatTile
          label="En essai"
          value={c?.offer_trial ?? "—"}
          icon={Hourglass}
          accent="blue"
          hint="Période d'essai en cours"
        />
        <StatTile
          label="Expire bientôt"
          value={c?.offer_expiring ?? "—"}
          icon={Clock}
          accent="amber"
          hint="Dans les 7 jours"
        />
        <StatTile
          label="Offre expirée"
          value={c?.offer_expired ?? "—"}
          icon={CalendarX}
          accent="red"
          hint="Essai ou licence terminés"
        />
      </KpiGrid>

      {/* Search + Filter */}
      <Card>
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-muted" />
          <input
            type="text"
            placeholder="Rechercher par nom, email, téléphone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input input--primary w-full pl-10 pr-3"
          />
        </div>
        <div className="mt-3 space-y-2">
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            <span className="text-xs font-semibold text-muted whitespace-nowrap w-28 shrink-0">
              Statut du client
            </span>
            {CLIENT_FILTERS.map((f: { value: string; label: string }) => (
              <button
                key={f.value}
                onClick={() => setClientFilter(f.value)}
                className={`px-3 py-1.5 rounded-xl text-xs font-medium transition whitespace-nowrap ${
                  clientFilter === f.value
                    ? "bg-accent text-accent-foreground font-medium"
                    : "bg-default text-muted hover:bg-default-hover hover:text-foreground"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            <span className="text-xs font-semibold text-muted whitespace-nowrap w-28 shrink-0">
              Statut de l&apos;offre
            </span>
            {OFFER_FILTERS.map((f: { value: string; label: string }) => (
              <button
                key={f.value}
                onClick={() => setOfferFilter(f.value)}
                className={`px-3 py-1.5 rounded-xl text-xs font-medium transition whitespace-nowrap ${
                  offerFilter === f.value
                    ? "bg-accent text-accent-foreground font-medium"
                    : "bg-default text-muted hover:bg-default-hover hover:text-foreground"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
      </Card>

      {/* Table */}
      {loading ? (
        <div className="py-10 flex justify-center items-center gap-2 text-muted text-sm font-medium">
          <Loader2 className="w-5 h-5 animate-spin text-accent" />
          <span>Chargement des clients...</span>
        </div>
      ) : clients.length === 0 ? (
        <Card className="text-center space-y-3 py-8">
          <Building2 className="w-12 h-12 text-muted mx-auto" />
          <h3 className="text-base font-semibold text-foreground">
            Aucun client trouvé
          </h3>
          <p className="text-xs text-muted max-w-sm mx-auto">
            {search || clientFilter !== "all" || offerFilter !== "all"
              ? "Aucun résultat pour cette recherche."
              : "La plateforme ne comporte pas encore de clients."}
          </p>
        </Card>
      ) : (
        <Card className="p-0 overflow-hidden">
          <ResponsiveTable>
            <table className="w-full text-left text-xs whitespace-nowrap">
              <thead className="bg-default text-muted font-semibold">
                <tr>
                  <th className="px-4 py-3">Client</th>
                  <th className="px-4 py-3">Téléphone</th>
                  <th className="px-4 py-3">Email</th>
                  <th className="px-4 py-3">Responsable</th>
                  <th className="px-4 py-3">Offre</th>
                  <th className="px-4 py-3">Statut</th>
                  <th className="px-4 py-3">Statut de l&apos;offre</th>
                  <th className="px-4 py-3">Création</th>
                  <th className="px-4 py-3">Expiration</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-separator font-medium">
                {clients.map((client: ClientOrg) => {
                  const Icon =
                    STATUS_ICONS[client.status as OrganizationStatus] ||
                    Building2;
                  const isActionDisabled = actionLoading === client.id;
                  return (
                    <tr
                      key={client.id}
                      className="hover:bg-surface-secondary transition"
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-accent-soft text-accent flex items-center justify-center">
                            <Icon className="w-4 h-4" />
                          </div>
                          <p className="font-semibold text-foreground">
                            {client.name}
                          </p>
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {client.phone ? (
                          <a
                            href={`tel:${client.phone.replace(/\s/g, "")}`}
                            className="font-semibold text-foreground hover:text-accent tabular-nums"
                            title="Appeler"
                          >
                            {client.phone}
                          </a>
                        ) : (
                          <span className="text-muted">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {client.email ? (
                          <a
                            href={`mailto:${client.email}`}
                            className="text-foreground hover:text-accent"
                          >
                            {client.email}
                          </a>
                        ) : (
                          <span className="text-muted">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-muted">
                        {client.contact_name || "—"}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant="info" className="text-xs">
                          {client.plan_name || "Aucune offre"}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {clientBadge(client.client_status)}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {offerBadge(client.offer_status)}
                      </td>
                      <td className="px-4 py-3 text-muted">
                        {formatDateFR(client.created_at)}
                      </td>
                      <td className="px-4 py-3 text-muted">
                        {client.offer_end_date
                          ? formatDateFR(client.offer_end_date)
                          : "—"}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {client.status === "pending_approval" && (
                            <Button
                              variant="primary"
                              size="sm"
                              className="bg-success hover:bg-success-hover text-success-foreground flex items-center shadow-xs"
                              onClick={() =>
                                handleStatusAction(
                                  client.id,
                                  "approve",
                                  client.name,
                                )
                              }
                              disabled={!!isActionDisabled}
                              title="Valider et approuver ce client"
                            >
                              {isActionDisabled ? (
                                <Loader2 className="w-3 h-3 animate-spin" />
                              ) : (
                                <CheckCircle className="w-3.5 h-3.5" />
                              )}
                              <span>Valider</span>
                            </Button>
                          )}
                          {(client.status === "suspended" ||
                            client.status === "cancelled" ||
                            client.status === "archived") && (
                            <Button
                              isIconOnly
                              variant="ghost"
                              size="sm"
                              className="text-success-soft-foreground hover:text-success-soft-foreground"
                              onClick={() =>
                                handleStatusAction(
                                  client.id,
                                  "reactivate",
                                  client.name,
                                )
                              }
                              disabled={!!isActionDisabled}
                              title="Réactiver l'espace"
                            >
                              {isActionDisabled ? (
                                <Loader2 className="w-3 h-3 animate-spin" />
                              ) : (
                                <CheckCircle className="w-3.5 h-3.5" />
                              )}
                            </Button>
                          )}
                          {client.status !== "suspended" &&
                            client.status !== "cancelled" &&
                            client.status !== "archived" &&
                            client.status !== "pending_approval" && (
                              <Button
                                isIconOnly
                                variant="ghost"
                                size="sm"
                                onClick={() =>
                                  handleStatusAction(
                                    client.id,
                                    "suspend",
                                    client.name,
                                  )
                                }
                                disabled={!!isActionDisabled}
                                title="Suspendre l'espace"
                              >
                                {isActionDisabled ? (
                                  <Loader2 className="w-3 h-3 animate-spin" />
                                ) : (
                                  <PauseCircle className="w-3.5 h-3.5" />
                                )}
                              </Button>
                            )}
                          {client.status !== "archived" &&
                            client.status !== "pending_approval" && (
                              <Button
                                isIconOnly
                                variant="ghost"
                                size="sm"
                                onClick={() =>
                                  handleStatusAction(
                                    client.id,
                                    "archive",
                                    client.name,
                                  )
                                }
                                disabled={!!isActionDisabled}
                                title="Supprimer l'organisation"
                              >
                                {isActionDisabled ? (
                                  <Loader2 className="w-3 h-3 animate-spin" />
                                ) : (
                                  <Trash2 className="w-3.5 h-3.5" />
                                )}
                              </Button>
                            )}
                          <Link
                            href={`/platform/clients/${client.id}`}
                            className={buttonClassName({
                              variant: "ghost",
                              size: "sm",
                              className: "text-muted hover:text-foreground",
                              isIconOnly: true,
                            })}
                          >
                            <MoreHorizontal className="w-3.5 h-3.5" />
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </ResponsiveTable>
        </Card>
      )}

      <ExportClientsModal
        isOpen={exportOpen}
        onClose={() => setExportOpen(false)}
        initialClient={clientFilter}
        initialOffer={offerFilter}
        search={search}
      />
    </div>
  );
}

/** Statut du client correspondant au statut du compte renvoyé après une action. */
function toClientStatus(orgStatus: string): ClientStatus {
  if (orgStatus === "pending_approval") return "pending";
  if (orgStatus === "suspended") return "suspended";
  if (orgStatus === "cancelled") return "refused";
  if (orgStatus === "archived") return "deleted";
  return "active";
}
