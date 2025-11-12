-- Jewelry Store Database Schema for XAMPP MySQL
-- Import via phpMyAdmin: http://localhost/phpmyadmin/

CREATE DATABASE IF NOT EXISTS gdlux_store CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE gdlux_store;

-- Users (with role)
CREATE TABLE IF NOT EXISTS users (
  user_id INT AUTO_INCREMENT PRIMARY KEY,
  fullname VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,
  role ENUM('user','admin') NOT NULL DEFAULT 'user',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_email (email)
) ENGINE=InnoDB;

-- Seed default admin (bcrypt hash of 'admin123')
INSERT INTO users (fullname, email, password, role)
VALUES (
  'Site Admin',
  'admin@gdlux.com',
  '$2a$10$D7F8k6Vq8K1oZ4Y2WbQy0u4WmQ5W7wKQn1S3zG6gq3B3tF1bJ4jwy',
  'admin'
)
ON DUPLICATE KEY UPDATE email = email;

-- Categories
CREATE TABLE IF NOT EXISTS categories (
  category_id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- Products
CREATE TABLE IF NOT EXISTS products (
  product_id INT AUTO_INCREMENT PRIMARY KEY,
  category_id INT,
  product_code VARCHAR(50) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  metal_type ENUM('Gold','White Gold','Rose Gold','Platinum','Silver') NOT NULL,
  metal_purity DECIMAL(5,2) NOT NULL,
  weight_grams DECIMAL(10,3) NOT NULL,
  has_diamonds BOOLEAN DEFAULT FALSE,
  diamond_weight DECIMAL(5,3),
  diamond_count INT,
  making_charges DECIMAL(10,2),
  current_gold_rate_per_gram DECIMAL(10,2) NOT NULL,
  price DECIMAL(15,2) NOT NULL,
  image_url VARCHAR(255),
  stock_quantity INT NOT NULL DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (category_id) REFERENCES categories(category_id)
) ENGINE=InnoDB;

-- Customers
CREATE TABLE IF NOT EXISTS customers (
  customer_id INT AUTO_INCREMENT PRIMARY KEY,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  email VARCHAR(255) UNIQUE,
  phone VARCHAR(20) NOT NULL,
  address TEXT,
  city VARCHAR(100),
  state VARCHAR(100),
  pincode VARCHAR(20),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- Sales (Orders)
CREATE TABLE IF NOT EXISTS sales (
  sale_id INT AUTO_INCREMENT PRIMARY KEY,
  customer_id INT,
  invoice_number VARCHAR(50) UNIQUE NOT NULL,
  sale_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  subtotal DECIMAL(15,2) NOT NULL,
  discount_amount DECIMAL(15,2) DEFAULT 0.00,
  tax_amount DECIMAL(15,2) DEFAULT 0.00,
  total_amount DECIMAL(15,2) NOT NULL,
  payment_method ENUM('Cash','Credit Card','Debit Card','UPI','Bank Transfer') NOT NULL,
  payment_status ENUM('Pending','Partial','Paid') DEFAULT 'Pending',
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (customer_id) REFERENCES customers(customer_id)
) ENGINE=InnoDB;

-- Sale items
CREATE TABLE IF NOT EXISTS sale_items (
  sale_item_id INT AUTO_INCREMENT PRIMARY KEY,
  sale_id INT,
  product_id INT,
  quantity INT NOT NULL,
  unit_price DECIMAL(15,2) NOT NULL,
  total_price DECIMAL(15,2) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (sale_id) REFERENCES sales(sale_id) ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products(product_id)
) ENGINE=InnoDB;

-- Inventory transactions
CREATE TABLE IF NOT EXISTS inventory_transactions (
  transaction_id INT AUTO_INCREMENT PRIMARY KEY,
  product_id INT,
  transaction_type ENUM('Purchase','Sale','Return','Adjustment') NOT NULL,
  quantity INT NOT NULL,
  reference_id INT,
  notes TEXT,
  created_by VARCHAR(100),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (product_id) REFERENCES products(product_id)
) ENGINE=InnoDB;

-- Gold rates
CREATE TABLE IF NOT EXISTS gold_rates (
  rate_id INT AUTO_INCREMENT PRIMARY KEY,
  rate_date DATE NOT NULL,
  rate_24k DECIMAL(10,2) NOT NULL,
  rate_22k DECIMAL(10,2) NOT NULL,
  rate_18k DECIMAL(10,2) NOT NULL,
  rate_14k DECIMAL(10,2) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY unique_date (rate_date)
) ENGINE=InnoDB;

-- Contact submissions
CREATE TABLE IF NOT EXISTS contact_submissions (
  submission_id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL,
  phone VARCHAR(20),
  subject VARCHAR(255),
  message TEXT NOT NULL,
  submission_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  status ENUM('New','In Progress','Resolved','Closed') DEFAULT 'New',
  INDEX idx_email (email),
  INDEX idx_status (status),
  INDEX idx_date (submission_date)
) ENGINE=InnoDB;

-- Seed base categories
INSERT IGNORE INTO categories (name) VALUES
('Rings'),('Necklaces'),('Earrings'),('Bracelets'),('Bangles'),
('Chains'),('Pendants'),('Nose Pins'),('Mangalsutras'),('Coins & Bars');
