CREATE DATABASE IF NOT EXISTS report_adv;
USE report_adv;

CREATE TABLE users (
  id INT PRIMARY KEY AUTO_INCREMENT,
  nome VARCHAR(100) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  ruolo ENUM('admin', 'operatore') NOT NULL,
  attivo BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE clienti (
  id INT PRIMARY KEY AUTO_INCREMENT,
  nome VARCHAR(100) UNIQUE NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE campaigns (
  id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  cliente_id INT NOT NULL,
  campagna VARCHAR(255) NOT NULL,
  piattaforma VARCHAR(50) NOT NULL,
  periodo VARCHAR(7) NOT NULL,
  obiettivo VARCHAR(50),
  budget DECIMAL(10, 2) DEFAULT 0,
  spesa DECIMAL(10, 2) DEFAULT 0,
  impression BIGINT DEFAULT 0,
  copertura BIGINT DEFAULT 0,
  click BIGINT DEFAULT 0,
  lead BIGINT DEFAULT 0,
  conversioni DECIMAL(10, 2) DEFAULT 0,
  ricavi DECIMAL(10, 2) DEFAULT 0,
  extra LONGTEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_cliente_periodo (cliente_id, periodo),
  CONSTRAINT fk_campaigns_cliente FOREIGN KEY (cliente_id) REFERENCES clienti(id)
);

CREATE TABLE format_memory (
  id INT PRIMARY KEY AUTO_INCREMENT,
  piattaforma VARCHAR(50) UNIQUE NOT NULL,
  format_config LONGTEXT NOT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

INSERT INTO users (nome, password, ruolo, attivo) VALUES
('admin', '$2y$10$abcdefghijklmnopqrstuvwxyz', 'admin', TRUE),
('operatore1', '$2y$10$abcdefghijklmnopqrstuvwxyz', 'operatore', TRUE),
('operatore2', '$2y$10$abcdefghijklmnopqrstuvwxyz', 'operatore', TRUE);
