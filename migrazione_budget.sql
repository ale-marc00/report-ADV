-- Esegui sul database report_adv gia' esistente (phpMyAdmin > SQL).
-- Salta i blocchi che hai gia' eseguito.

-- 1. budget mensile e residuo
ALTER TABLE campaigns
  ADD COLUMN budget_mensile DECIMAL(10, 2) NULL AFTER budget,
  ADD COLUMN residuo DECIMAL(10, 2) NULL AFTER budget_mensile;

-- 2. campagna unica per cliente, nome, piattaforma e mese
ALTER TABLE campaigns
  ADD UNIQUE KEY uq_campagna_periodo (cliente_id, campagna, piattaforma, periodo);

-- 3. attivo e fonte su campaigns
ALTER TABLE campaigns
  ADD COLUMN attivo TINYINT(1) NOT NULL DEFAULT 1,
  ADD COLUMN fonte ENUM('manuale', 'csv') NOT NULL DEFAULT 'manuale';

-- 4. campi extra su clienti
ALTER TABLE clienti
  ADD COLUMN referente VARCHAR(120) NULL,
  ADD COLUMN email VARCHAR(160) NULL,
  ADD COLUMN attivo TINYINT(1) NOT NULL DEFAULT 1;
