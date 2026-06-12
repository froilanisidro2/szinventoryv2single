import { NextRequest, NextResponse } from 'next/server';

interface BulkImportItem {
  productSKU: string;
  productName: string;
  quantity: number;
  type: 'inbound' | 'outbound';
  reference: string;
  reason: string;
  date: string;
  cost?: number;
}

// Mock database
const importedItems: any[] = [];

export async function POST(request: NextRequest) {
  try {
    const { items, type } = await request.json();

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { error: 'No items provided' },
        { status: 400 }
      );
    }

    if (type !== 'inbound' && type !== 'outbound') {
      return NextResponse.json(
        { error: 'Invalid import type' },
        { status: 400 }
      );
    }

    const validationErrors: string[] = [];
    const processedItems: any[] = [];

    // Validate and process each item
    items.forEach((item: BulkImportItem, index: number) => {
      try {
        // Validate required fields
        if (!item.productSKU) {
          validationErrors.push(`Row ${index + 2}: Product SKU is required`);
          return;
        }

        if (!item.quantity || item.quantity <= 0) {
          validationErrors.push(`Row ${index + 2}: Valid quantity is required`);
          return;
        }

        if (!item.reference) {
          validationErrors.push(`Row ${index + 2}: Reference number is required`);
          return;
        }

        if (!item.date) {
          validationErrors.push(`Row ${index + 2}: Date is required`);
          return;
        }

        // Additional validation for inbound
        if (type === 'inbound' && !item.cost) {
          validationErrors.push(`Row ${index + 2}: Unit cost is required for inbound`);
          return;
        }

        // Additional validation for outbound
        if (type === 'outbound' && !item.reason) {
          validationErrors.push(`Row ${index + 2}: Reason is required for outbound`);
          return;
        }

        // Create processed item
        const processedItem = {
          id: `${type === 'inbound' ? 'IN' : 'OUT'}-${Date.now()}-${index}`,
          type,
          productSKU: item.productSKU,
          productName: item.productName || `Product ${item.productSKU}`,
          quantity: item.quantity,
          reference: item.reference,
          date: item.date,
          reason: item.reason || 'Bulk Import',
          ...(type === 'inbound' && { unitCost: item.cost, totalCost: item.quantity * (item.cost || 0) }),
          status: 'imported',
          importedAt: new Date().toISOString(),
        };

        processedItems.push(processedItem);
      } catch (error) {
        validationErrors.push(`Row ${index + 2}: Error processing item`);
      }
    });

    // If validation errors exist, return them
    if (validationErrors.length > 0) {
      return NextResponse.json(
        {
          success: false,
          errors: validationErrors,
          processedCount: processedItems.length,
        },
        { status: 400 }
      );
    }

    // Save imported items (in real app, save to database)
    importedItems.push(...processedItems);

    return NextResponse.json(
      {
        success: true,
        message: `Successfully imported ${processedItems.length} ${type} items`,
        importedCount: processedItems.length,
        items: processedItems,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error processing bulk import:', error);
    return NextResponse.json(
      { error: 'Failed to process bulk import' },
      { status: 500 }
    );
  }
}

// GET imported items (for verification)
export async function GET(request: NextRequest) {
  try {
    const typeParam = request.nextUrl.searchParams.get('type');
    const filter = typeParam ? importedItems.filter(item => item.type === typeParam) : importedItems;

    return NextResponse.json(
      {
        success: true,
        data: filter,
        count: filter.length,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error fetching imported items:', error);
    return NextResponse.json(
      { error: 'Failed to fetch imported items' },
      { status: 500 }
    );
  }
}
