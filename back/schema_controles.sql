-- ========================================
-- TABLE CONTROLES
-- Enregistre tous les paramètres de contrôle appliqués par les admins
-- ========================================

CREATE TABLE IF NOT EXISTS `controles` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `irrigation_mode` VARCHAR(20) NOT NULL DEFAULT 'inactive' COMMENT 'inactive, active, auto',
  `irrigation_threshold` INT COMMENT 'Seuil en %',
  `misting_mode` VARCHAR(20) NOT NULL DEFAULT 'inactive' COMMENT 'inactive, active, auto',
  `misting_intensity` INT COMMENT 'Intensité en %',
  `ventilation_mode` VARCHAR(20) NOT NULL DEFAULT 'inactive' COMMENT 'inactive, active, auto',
  `ventilation_duration` INT COMMENT 'Durée en heures (max 6)',
  `heating_mode` VARCHAR(20) NOT NULL DEFAULT 'inactive' COMMENT 'inactive, active, auto',
  `heating_target` INT COMMENT 'Température cible en °C',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_by` INT,
  FOREIGN KEY (`updated_by`) REFERENCES `Utilisateur`(`id`) ON DELETE SET NULL,
  INDEX `idx_created_at` (`created_at`),
  INDEX `idx_updated_by` (`updated_by`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='Historique des contrôles appliqués';
