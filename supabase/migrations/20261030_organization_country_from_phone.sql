-- Pays des organisations déduit du téléphone (KPI « Top 3 des pays »). Idempotent.
-- 1. Téléphone de l'organisation : celui de son gérant (profil administrateur) s'il manque.
UPDATE organizations o
   SET phone = p.telephone
  FROM (
    SELECT DISTINCT ON (organization_id) organization_id, telephone
      FROM profiles
     WHERE role = 'administrateur' AND telephone IS NOT NULL AND btrim(telephone) <> ''
     ORDER BY organization_id, created_at
  ) p
 WHERE p.organization_id = o.id AND (o.phone IS NULL OR btrim(o.phone) = '');

-- 2. Pays d'après l'indicatif international (+225…, 00225…), sans écraser un pays connu.
UPDATE organizations o
   SET country = x.code
  FROM (
    SELECT id,
           CASE
         WHEN d LIKE '225%' THEN 'CI'
         WHEN d LIKE '221%' THEN 'SN'
         WHEN d LIKE '223%' THEN 'ML'
         WHEN d LIKE '226%' THEN 'BF'
         WHEN d LIKE '227%' THEN 'NE'
         WHEN d LIKE '228%' THEN 'TG'
         WHEN d LIKE '229%' THEN 'BJ'
         WHEN d LIKE '224%' THEN 'GN'
         WHEN d LIKE '237%' THEN 'CM'
         WHEN d LIKE '241%' THEN 'GA'
         WHEN d LIKE '242%' THEN 'CG'
         WHEN d LIKE '243%' THEN 'CD'
         WHEN d LIKE '235%' THEN 'TD'
         WHEN d LIKE '236%' THEN 'CF'
         WHEN d LIKE '240%' THEN 'GQ'
         WHEN d LIKE '222%' THEN 'MR'
         WHEN d LIKE '245%' THEN 'GW'
         WHEN d LIKE '233%' THEN 'GH'
         WHEN d LIKE '234%' THEN 'NG'
         WHEN d LIKE '231%' THEN 'LR'
         WHEN d LIKE '232%' THEN 'SL'
         WHEN d LIKE '220%' THEN 'GM'
         WHEN d LIKE '238%' THEN 'CV'
         WHEN d LIKE '212%' THEN 'MA'
         WHEN d LIKE '213%' THEN 'DZ'
         WHEN d LIKE '216%' THEN 'TN'
         WHEN d LIKE '261%' THEN 'MG'
         WHEN d LIKE '230%' THEN 'MU'
         WHEN d LIKE '269%' THEN 'KM'
         WHEN d LIKE '253%' THEN 'DJ'
         WHEN d LIKE '250%' THEN 'RW'
         WHEN d LIKE '257%' THEN 'BI'
         WHEN d LIKE '254%' THEN 'KE'
         WHEN d LIKE '352%' THEN 'LU'
         WHEN d LIKE '351%' THEN 'PT'
         WHEN d LIKE '509%' THEN 'HT'
         WHEN d LIKE '971%' THEN 'AE'
         WHEN d LIKE '20%' THEN 'EG'
         WHEN d LIKE '27%' THEN 'ZA'
         WHEN d LIKE '33%' THEN 'FR'
         WHEN d LIKE '32%' THEN 'BE'
         WHEN d LIKE '41%' THEN 'CH'
         WHEN d LIKE '44%' THEN 'GB'
         WHEN d LIKE '49%' THEN 'DE'
         WHEN d LIKE '34%' THEN 'ES'
         WHEN d LIKE '39%' THEN 'IT'
         WHEN d LIKE '86%' THEN 'CN'
         WHEN d LIKE '1%' THEN 'US'
           END AS code
      FROM (
        SELECT id, regexp_replace(regexp_replace(phone, '[^0-9+]', '', 'g'), '^(\+|00)', '') AS d
          FROM organizations
         WHERE country IS NULL AND regexp_replace(phone, '[^0-9+]', '', 'g') ~ '^(\+|00)[0-9]'
      ) n
  ) x
 WHERE x.id = o.id AND x.code IS NOT NULL;
