# SZ Inventory System with Invoice Generator

A comprehensive inventory management system designed for Small to Medium Enterprises (SMEs), featuring advanced invoice generation, user management, Redis caching, and full PostgREST API integration.

## Features

✨ **Core Features:**
- **Inventory Management** - Track products, stock levels, and warehouse locations
- **Invoice Generation** - Create, manage, and generate PDF invoices
- **Customer Management** - Manage customer details, credit limits, and contacts
- **Payment Tracking** - Record payments and track outstanding invoices
- **Multi-User Support** - Role-based access control (admin, manager, sales, accountant, viewer)
- **Audit Trail** - Complete audit logging of all transactions
- **Reporting** - Sales, inventory, and customer analytics
- **Redis Caching** - High-performance data caching
- **Stock Transactions** - Detailed tracking of inventory movements

## Tech Stack

- **Backend:** Node.js + Express
- **Database:** PostgreSQL (with PostgREST API)
- **Caching:** Redis
- **Authentication:** JWT + API Keys
- **PDF Generation:** PDFKit + jsPDF
- **API:** RESTful with PostgREST

## Prerequisites

- Node.js >= 18.0.0
- PostgreSQL database running
- Redis server running
- PostgREST API running
- npm or yarn

## Installation

### 1. Clone the repository
```bash
cd /home/ubuntu/sz/inventory
```

### 2. Install dependencies
```bash
npm install
```

### 3. Configure environment variables
```bash
cp .env.local .env.local
# Edit .env.local with your settings
```

**Key Environment Variables:**
```
POSTGREST_URL=http://localhost:8031
POSTGREST_API_KEY=W5kcjXoWfiZV3uW1c0MaIjfWHtql2gIrlGYR8bdtS8RQfyN9w0b2rHeaJy5PPW
DATABASE_URL=postgresql://szinventory:9PzbMFTqzZp2XmT@localhost:5433/szinventory
REDIS_HOST=localhost
REDIS_PORT=6379
JWT_SECRET=your-secret-key-here
```

### 4. Setup Database Schema

Load the database schema using psql:

```bash
psql $DATABASE_URL < 01_schema.sql
```

Or use an admin tool like pgAdmin or DBeaver to execute the SQL file.

### 5. Start the server

**Development:**
```bash
npm run dev
```

**Production:**
```bash
npm start
```

The server will start on `http://localhost:3000`

## API Documentation

### Authentication Endpoints

#### Login
```
POST /api/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "password123",
  "companyId": "uuid-here"
}

Response:
{
  "success": true,
  "data": {
    "user": { ... },
    "token": "jwt-token-here"
  }
}
```

#### Register
```
POST /api/auth/register
Content-Type: application/json

{
  "companyId": "uuid",
  "email": "newuser@example.com",
  "firstName": "John",
  "lastName": "Doe",
  "password": "password123",
  "phone": "+1-555-0100",
  "role": "sales"
}
```

### Product Endpoints

#### Get All Products
```
GET /api/products?companyId=uuid&limit=20&offset=0
Authorization: Bearer {token}
X-Api-Key: {api-key}
```

#### Create Product
```
POST /api/products
Authorization: Bearer {token}

{
  "companyId": "uuid",
  "sku": "PROD-001",
  "name": "Product Name",
  "description": "Product description",
  "categoryId": "uuid",
  "sellingPrice": 99.99,
  "costPrice": 50.00,
  "taxRate": 10,
  "reorderLevel": 10
}
```

### Invoice Endpoints

#### Get All Invoices
```
GET /api/invoices?companyId=uuid&status=draft&limit=20&offset=0
Authorization: Bearer {token}
```

#### Create Invoice
```
POST /api/invoices
Authorization: Bearer {token}

{
  "companyId": "uuid",
  "customerId": "uuid",
  "issueDate": "2024-01-15",
  "dueDate": "2024-02-15",
  "billingAddress": "123 Main St",
  "items": [
    {
      "productId": "uuid",
      "description": "Item description",
      "quantity": 2,
      "unitPrice": 99.99,
      "taxRate": 10
    }
  ]
}
```

#### Generate PDF Invoice
```
GET /api/invoices/{id}/pdf
Authorization: Bearer {token}

Response: PDF file
```

#### Record Payment
```
POST /api/payments
Authorization: Bearer {token}

{
  "companyId": "uuid",
  "invoiceId": "uuid",
  "amount": 500.00,
  "paymentMethod": "bank_transfer",
  "transactionReference": "TXN123456"
}
```

### Inventory Endpoints

#### Get Stock Levels
```
GET /api/inventory/stock?companyId=uuid
Authorization: Bearer {token}
```

#### Get Low Stock Products
```
GET /api/inventory/low-stock?companyId=uuid
Authorization: Bearer {token}
```

#### Create Stock Transaction
```
POST /api/inventory/transaction
Authorization: Bearer {token}

{
  "companyId": "uuid",
  "productId": "uuid",
  "transactionType": "in|out|adjustment|return",
  "quantity": 10,
  "referenceType": "invoice|purchase_order",
  "referenceId": "uuid",
  "notes": "Transaction notes"
}
```

### Customer Endpoints

#### Get All Customers
```
GET /api/customers?companyId=uuid&limit=20&offset=0
Authorization: Bearer {token}
```

#### Create Customer
```
POST /api/customers
Authorization: Bearer {token}

{
  "companyId": "uuid",
  "name": "Customer Name",
  "email": "customer@example.com",
  "phone": "+1-555-0100",
  "billingAddress": "456 Oak Ave",
  "taxId": "TAX123456"
}
```

### Report Endpoints

#### Sales Report
```
GET /api/reports/sales?companyId=uuid&startDate=2024-01-01&endDate=2024-12-31
Authorization: Bearer {token}
```

#### Inventory Report
```
GET /api/reports/inventory?companyId=uuid
Authorization: Bearer {token}
```

#### Outstanding Invoices Report
```
GET /api/reports/outstanding-invoices?companyId=uuid
Authorization: Bearer {token}
```

## Database Schema Overview

### Core Tables

**companies** - Business entities
**users** - System users with roles
**roles** - User roles with permissions
**products** - Product catalog
**product_categories** - Product categorization
**stock_levels** - Current inventory levels
**stock_transactions** - Audit trail of stock movements
**customers** - Customer information
**invoices** - Invoice records
**invoice_items** - Line items in invoices
**payments** - Payment records
**tax_rates** - Tax rate configurations
**user_sessions** - User session tracking
**audit_logs** - System audit trail
**notifications** - User notifications

### Views

**invoice_summary** - Quick invoice overview
**low_stock_products** - Products below reorder level
**outstanding_invoices** - Unpaid invoices with aging

## Redis Caching

The system uses Redis for high-performance caching:

- **Product Cache:** 30 minutes
- **Stock Levels:** 30 minutes
- **Customer Data:** 30 minutes
- **Invoice Details:** 60 minutes
- **User Data:** 60 minutes

Clear cache strategy is implemented to invalidate data on updates.

## User Roles & Permissions

| Role | Inventory | Invoices | Users | Payments | Reports |
|------|-----------|----------|-------|----------|---------|
| Admin | Read/Write | Read/Write | Read/Write | Read/Write | Read |
| Manager | Read/Write | Read/Write | Read | Read/Write | Read |
| Sales | Read | Read/Write | - | - | - |
| Accountant | Read | Read | - | Read/Write | Read |
| Viewer | Read | Read | - | - | Read |

## Invoice Features

### PDF Generation
- Professional invoice layout
- Company branding
- Item details and calculations
- Payment terms and notes
- QR code support (extensible)

### Invoice Status Workflow
- **Draft** → **Issued** → **Sent** → **Partially Paid** / **Paid**
- Support for **Credit Notes** and **Debit Notes**
- Automatic status updates on payment

## Development

### Run Tests
```bash
npm test
```

### Linting
```bash
npm run lint
```

### Build for Production
```bash
npm run build
```

## Troubleshooting

### Redis Connection Issues
```bash
# Check Redis status
redis-cli ping

# Should return: PONG
```

### PostgREST Connection Issues
```bash
# Test PostgREST endpoint
curl -H "X-Api-Key: YOUR_API_KEY" http://localhost:8031/companies
```

### Database Connection Issues
```bash
# Test database connection
psql $DATABASE_URL -c "SELECT 1;"
```

## API Key Authentication

For non-user API access, use:
```bash
curl -H "X-Api-Key: W5kcjXoWfiZV3uW1c0MaIjfWHtql2gIrlGYR8bdtS8RQfyN9w0b2rHeaJy5PPW" http://localhost:3000/api/health
```

## Performance Optimization

- **Indexing:** Database indexes on frequently queried columns
- **Pagination:** Default 20 items per page, max 100
- **Caching:** Redis caching with intelligent invalidation
- **Connection Pooling:** PostgREST connection pool size: 10

## Security Features

- ✅ JWT Token Authentication
- ✅ API Key Authentication
- ✅ Role-Based Access Control (RBAC)
- ✅ Rate Limiting (100 requests per 15 minutes)
- ✅ CORS Support
- ✅ Helmet.js for HTTP headers
- ✅ Password Hashing with bcryptjs
- ✅ Audit Logging of all changes

## Support & Documentation

For detailed API documentation, visit:
- PostgREST Swagger UI: http://localhost:8021 (if available)
- Health Check: http://localhost:3000/health

## License

ISC

## Contact

For support or inquiries:
- Email: support@szinventory.com
- Website: https://szinventory.com

---

**Version:** 1.0.0  
**Last Updated:** March 2026
