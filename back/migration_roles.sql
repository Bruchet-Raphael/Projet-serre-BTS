-- ========================================
-- MIGRATION: CORRECTION DES RÔLES
-- ========================================
-- Exécuter ce script pour corriger les problèmes de rôles
-- dans la base de données existante
-- ========================================

-- 1. Vérifier l'état actuel
SELECT 
    '--- RÔLES ACTUELS ---' AS info,
    COUNT(*) as total,
    SUM(CASE WHEN role IS NULL THEN 1 ELSE 0 END) as null_roles,
    SUM(CASE WHEN role = 'admin' THEN 1 ELSE 0 END) as admin_count,
    SUM(CASE WHEN role = 'user' THEN 1 ELSE 0 END) as user_count
FROM Utilisateur;

-- 2. Voir les rôles distincts actuels (peut avoir des doublons)
SELECT DISTINCT role, COUNT(*) as count
FROM Utilisateur
GROUP BY role;

-- 3. Normaliser les rôles en minuscules et sans espaces
UPDATE Utilisateur 
SET role = LOWER(TRIM(COALESCE(role, 'user')))
WHERE role IS NULL OR role != LOWER(TRIM(role));

-- 4. S'assurer que le rôle n'est jamais vide
UPDATE Utilisateur 
SET role = 'user' 
WHERE role IS NULL OR role = '' OR TRIM(role) = '';

-- 5. Vérifier que seuls 'admin' et 'user' existent
SELECT DISTINCT role FROM Utilisateur;

-- 6. Afficher un résumé de la migration
SELECT 
    '✅ MIGRATION COMPLÈTE' AS status,
    COUNT(*) as total_users,
    SUM(CASE WHEN role = 'admin' THEN 1 ELSE 0 END) as admin_users,
    SUM(CASE WHEN role = 'user' THEN 1 ELSE 0 END) as regular_users
FROM Utilisateur;

-- 7. (OPTIONNEL) Si vous connaissez l'ID de l'administrateur, promouvez-le:
-- UPDATE Utilisateur SET role = 'admin' WHERE id = 1;  -- Remplacer 1 par l'ID réel

-- 8. Après l'exécution, vérifier les détails:
SELECT id, login, mail, role FROM Utilisateur ORDER BY role DESC, login ASC;

-- ========================================
-- NOTES IMPORTANTES:
-- ========================================
-- 1. Faire une sauvegarde avant d'exécuter: 
--    mysqldump -u user -p dbname > backup.sql
--
-- 2. Après cette migration, redémarrer le serveur Node.js
--
-- 3. Les tokens JWT existants devront être regénérés 
--    (les utilisateurs devront se reconnecter)
--
-- 4. Si une erreur survient, restaurer depuis la sauvegarde
-- ========================================
