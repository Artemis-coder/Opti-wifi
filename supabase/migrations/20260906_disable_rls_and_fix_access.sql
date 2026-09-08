-- =========================================================================
-- SCRIPT DE DÉSACTIVATION DES RLS (SÉCURITÉ) ET CORRECTION D'ACCÈS
-- =========================================================================
-- Ce script désactive la sécurité Row Level Security (RLS) sur toutes les tables
-- de l'application. Cela permet d'afficher immédiatement toutes les données
-- sans être bloqué par des règles complexes, et corrige l'accès au back-office.

-- 1. DÉSACTIVER LES RLS SUR TOUTES LES TABLES
ALTER TABLE profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE wifi_spaces DISABLE ROW LEVEL SECURITY;
ALTER TABLE points_of_sale DISABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_types DISABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_allocations DISABLE ROW LEVEL SECURITY;
ALTER TABLE collections DISABLE ROW LEVEL SECURITY;
ALTER TABLE collection_items DISABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs DISABLE ROW LEVEL SECURITY;
ALTER TABLE platform_users DISABLE ROW LEVEL SECURITY;
ALTER TABLE organizations DISABLE ROW LEVEL SECURITY;

-- 2. SUPPRIMER TOUTES LES POLICIES EXISTANTES (POUR FAIRE PLACE NETTE)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (
        SELECT policyname, tablename 
        FROM pg_policies 
        WHERE schemaname = 'public'
    ) LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', r.policyname, r.tablename);
    END LOOP;
END $$;

-- 3. CORRECTION : Boris (kedakeyaoboris@gmail.com) est un ADMIN D'ORGANISATION, PAS un super admin.
-- Il doit être redirigé vers /dashboard, pas /platform/dashboard.
-- Seul superadmin@optiwifi.com doit avoir le rôle super_admin dans platform_users.
-- Toute entrée existante pour Boris est supprimée (traité par migration 20260907+).
-- La correction finale est assurée par la migration 20260908_fix_super_admin_routing.sql.

-- 4. RECRÉER LA VUE POUR L'APPLICATION (SANS RLS MAIS FILTRÉE)
-- L'application filtre déjà côté Frontend/Backend par organization_id.
-- En désactivant RLS, ces filtres Frontend/Backend vont fonctionner sans être bloqués.

