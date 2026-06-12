#!/usr/bin/env node

/**
 * Database Seed Script
 * Populates initial demo data
 */

import { postRequest, getRequest } from '../utils/postgrest.js';
import logger from '../utils/logger.js';
import dotenv from 'dotenv';
import { v4 as uuidv4 } from 'uuid';

dotenv.config({ path: '.env.local' });

async function seed() {
  try {
    logger.info('Starting database seed...');

    // Create sample company
    logger.info('Creating sample company...');
    const company = await postRequest('/companies', {
      name: 'Demo Company Inc.',
      email: 'info@democompany.com',
      phone: '+1-555-0100',
      address: '123 Business Ave',
      city: 'New York',
      state: 'NY',
      country: 'USA',
      postal_code: '10001',
      tax_id: 'TAX123456',
      currency_code: 'USD',
      website: 'https://democompany.com'
    });

    logger.info(`✓ Company created: ${company[0].id}`);
    const companyId = company[0].id;

    // Get admin role
    const roles = await getRequest('/roles', { name: 'eq.admin' });
    const adminRoleId = roles[0].id;

    // Create sample user
    logger.info('Creating sample user...');
    const users = await postRequest('/users', {
      company_id: companyId,
      email: 'admin@democompany.com',
      first_name: 'Admin',
      last_name: 'User',
      password_hash: '$2a$10$example_hash', // This should be a real bcrypt hash
      role_id: adminRoleId,
      status: 'active'
    });

    logger.info(`✓ User created: ${users[0].id}`);

    // Create sample product category
    logger.info('Creating sample categories...');
    const category = await postRequest('/product_categories', {
      company_id: companyId,
      name: 'Electronics',
      description: 'Electronic products and accessories',
      sort_order: 1
    });

    logger.info(`✓ Category created: ${category[0].id}`);

    // Create sample products
    logger.info('Creating sample products...');
    const products = await Promise.all([
      postRequest('/products', {
        company_id: companyId,
        sku: 'LAPTOP-001',
        name: 'Pro Laptop',
        description: 'High performance laptop',
        category_id: category[0].id,
        unit_of_measure: 'piece',
        purchase_price: 800,
        selling_price: 1200,
        cost_price: 800,
        tax_rate: 10,
        reorder_level: 5,
        reorder_quantity: 10,
        status: 'active'
      }),
      postRequest('/products', {
        company_id: companyId,
        sku: 'MOUSE-001',
        name: 'Wireless Mouse',
        description: 'Ergonomic wireless mouse',
        category_id: category[0].id,
        unit_of_measure: 'piece',
        purchase_price: 15,
        selling_price: 30,
        cost_price: 15,
        tax_rate: 10,
        reorder_level: 50,
        reorder_quantity: 100,
        status: 'active'
      })
    ]);

    logger.info(`✓ ${products.length} products created`);

    // Create stock levels
    logger.info('Creating stock levels...');
    await Promise.all([
      postRequest('/stock_levels', {
        company_id: companyId,
        product_id: products[0][0].id,
        quantity_on_hand: 20,
        quantity_reserved: 0
      }),
      postRequest('/stock_levels', {
        company_id: companyId,
        product_id: products[1][0].id,
        quantity_on_hand: 150,
        quantity_reserved: 0
      })
    ]);

    logger.info('✓ Stock levels created');

    // Create sample customer
    logger.info('Creating sample customer...');
    const customer = await postRequest('/customers', {
      company_id: companyId,
      customer_code: 'CUST-001',
      name: 'Acme Corporation',
      email: 'sales@acmecorp.com',
      phone: '+1-555-0200',
      billing_address: '456 Commerce Street',
      billing_city: 'Los Angeles',
      billing_state: 'CA',
      billing_country: 'USA',
      billing_postal_code: '90001',
      tax_id: 'TAXC123456',
      status: 'active'
    });

    logger.info(`✓ Customer created: ${customer[0].id}`);

    logger.info('');
    logger.info('✅ Database seed completed successfully!');
    logger.info('');
    logger.info('Demo Credentials:');
    logger.info('  Email: admin@democompany.com');
    logger.info('  Password: (set during initial setup)');
    logger.info('');
    logger.info('Sample Data Created:');
    logger.info(`  Company ID: ${companyId}`);
    logger.info('  Products: Pro Laptop, Wireless Mouse');
    logger.info('  Customer: Acme Corporation');

  } catch (error) {
    logger.error('❌ Seed failed:', error);
    process.exit(1);
  }
}

// Run seed
seed();
