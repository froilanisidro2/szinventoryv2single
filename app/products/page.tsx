'use client';

import { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, Search, Loader, Upload, Warehouse, Download, CheckSquare, Eye, X, Copy, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { FormModal } from '@/components/forms/form-modal';
import { FormInput, FormSelect } from '@/components/forms/form-fields';
import { BulkUploadModal } from '@/components/forms/bulk-upload-modal';
import { getProducts, createProduct, upsertProduct, updateProduct, deleteProduct, getProductCategories, getUnitOfMeasurements, getWarehouses, getBinLocationsByWarehouse, getProductTypes, getWarrantyTypes, getBrands, getHandlingInstructions, getSuppliers } from '@/app/actions';
import { useWarehouse } from '@/contexts/warehouse-context';
import { fmtWarehouse, fmtSupplier } from '@/lib/warehouse-utils';
import { Product } from '@/types';
import { toast } from 'sonner';

interface Warehouse {
  id: string;
  name: string;
}

interface BinLocation {
  id: string;
  warehouse_id: string;
  zone: string;
  aisle: string;
  shelf: string;
  bin_number: string;
  available_quantity?: number;
}

export default function ProductsPage() {
  const { selectedWarehouseId, warehouses: contextWarehouses } = useWarehouse();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [units, setUnits] = useState<any[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [binLocations, setBinLocations] = useState<Record<string, BinLocation[]>>({});
  const [productTypes, setProductTypes] = useState<any[]>([]);
  const [warrantyTypes, setWarrantyTypes] = useState<any[]>([]);
  const [brands, setBrands] = useState<any[]>([]);
  const [handlingInstructions, setHandlingInstructions] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [uomFilter, setUomFilter] = useState('');
  const [supplierFilter, setSupplierFilter] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isBulkUploadOpen, setIsBulkUploadOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'basic' | 'duration' | 'attributes' | 'classification' | 'handling'>('basic');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploadingBulk, setIsUploadingBulk] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  const [viewingProduct, setViewingProduct] = useState<Product | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const copyField = (value: string, key: string) => {
    navigator.clipboard.writeText(value);
    setCopiedField(key);
    setTimeout(() => setCopiedField(null), 2000);
  };
  const [formData, setFormData] = useState({
    name: '',
    sku: '',
    description: '',
    category_id: '',
    selling_price: '',
    cost_price: '',
    reorder_level: '10',
    unit_of_measure: '',
    track_batches: true,
    allocation_method: 'FIFO' as 'FIFO' | 'FEFO' | 'LIFO',
    warehouse_id: '',
    bin_location_id: '',
    // Duration fields
    lead_time_days: '',
    shelf_life_days: '',
    warranty_months: '',
    // Attributes fields
    weight: '',
    dimension: '',
    color: '',
    size: '',
    brand: '',
    // Classification fields
    product_type: '',
    // Handling fields
    shipping_instruction: '',
    // Supplier
    supplier_id: '',
  });

  useEffect(() => {
    loadData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedWarehouseId]);

  // When the modal opens for a new product, ensure warehouse/bin are defaulted
  // (handles race between loadData finishing and modal opening)
  useEffect(() => {
    if (isModalOpen && !editingProduct && !formData.warehouse_id && warehouses.length > 0) {
      const defaultWarehouse = (selectedWarehouseId && warehouses.find(w => w.id === selectedWarehouseId))
        ? selectedWarehouseId
        : warehouses[0]!.id;
      const defaultBin = binLocations[defaultWarehouse]?.[0]?.id || '';
      setFormData(prev => ({ ...prev, warehouse_id: defaultWarehouse, bin_location_id: defaultBin }));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isModalOpen, warehouses, binLocations]);

  const loadData = async () => {
    try {
      setIsLoading(true);
      const wh = selectedWarehouseId || undefined;
      const [productsResult, categoriesResult, unitsResult, warehousesResult, typesResult, warrantiesResult, brandsResult, handlingResult, suppliersResult] = await Promise.all([
        getProducts(100, 0, wh),
        getProductCategories(),
        getUnitOfMeasurements(),
        getWarehouses(),
        getProductTypes(),
        getWarrantyTypes(),
        getBrands(),
        getHandlingInstructions(),
        getSuppliers(500),
      ]);
      
      if (productsResult.error) {
        toast.error('Failed to load products');
      } else {
        setProducts(Array.isArray(productsResult.data) ? productsResult.data : []);
      }
      
      if (!categoriesResult.error && Array.isArray(categoriesResult.data)) {
        setCategories(categoriesResult.data);
      }
      
      if (!unitsResult.error && Array.isArray(unitsResult.data)) {
        setUnits(unitsResult.data);
      }
      
      if (!typesResult.error && Array.isArray(typesResult.data)) {
        setProductTypes(typesResult.data);
      }
      
      if (!warrantiesResult.error && Array.isArray(warrantiesResult.data)) {
        setWarrantyTypes(warrantiesResult.data);
      }
      
      if (!brandsResult.error && Array.isArray(brandsResult.data)) {
        setBrands(brandsResult.data);
      }
      
      if (!handlingResult.error && Array.isArray(handlingResult.data)) {
        setHandlingInstructions(handlingResult.data);
      }

      if (!suppliersResult.error && Array.isArray(suppliersResult.data)) {
        setSuppliers(suppliersResult.data);
      }

      // Load warehouses and bin locations
      if (!warehousesResult.error) {
        const warehousesData = Array.isArray(warehousesResult.data) ? warehousesResult.data : [];
        setWarehouses(warehousesData);

        // Load bin locations for each warehouse
        const binLocationsByWarehouse: Record<string, BinLocation[]> = {};
        for (const warehouse of warehousesData) {
          const binsResponse = await getBinLocationsByWarehouse(warehouse.id);
          if (!binsResponse.error && binsResponse.data) {
            binLocationsByWarehouse[warehouse.id] = (Array.isArray(binsResponse.data) ? binsResponse.data : []).map((b: any) => ({
              ...b,
              zone: b.zone ?? '',
              aisle: b.aisle ?? '',
              shelf: b.shelf ?? '',
              bin_number: b.bin_number ?? '',
            }));
          }
        }
        setBinLocations(binLocationsByWarehouse);
      }
    } catch (error) {
      toast.error('Error loading data');
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenModal = (product?: Product) => {
    if (product) {
      setEditingProduct(product);
      
      // Find warranty type ID by matching duration_months (only if data exists)
      const productWarrantyMonths = (product as any).warranty_months;
      const warrantyId = productWarrantyMonths && warrantyTypes.length > 0
        ? warrantyTypes.find(w => w.duration_months === productWarrantyMonths)?.id || ''
        : '';
      
      // Find brand ID by matching name (only if data exists)
      const productBrand = (product as any).brand;
      const brandId = productBrand && brands.length > 0
        ? brands.find(b => b.name === productBrand)?.id || ''
        : '';
      
      // Find product type ID by matching name (only if data exists)
      const productTypeData = (product as any).product_type;
      const typeId = productTypeData && productTypes.length > 0
        ? productTypes.find(pt => pt.name === productTypeData)?.id || ''
        : '';
      
      // Find handling instruction ID by matching name (only if data exists)
      const productHandling = (product as any).shipping_instruction;
      const handlingId = productHandling && handlingInstructions.length > 0
        ? handlingInstructions.find(h => h.name === productHandling)?.id || ''
        : '';
      
      setFormData({
        name: product.name,
        sku: product.sku,
        description: product.description || '',
        category_id: product.category_id || '',
        selling_price: String(product.selling_price),
        cost_price: String(product.cost_price || 0),
        reorder_level: String(product.reorder_level || 10),
        unit_of_measure: product.unit_of_measure || '',
        track_batches: (product as any).track_batches || false,
        allocation_method: (product as any).allocation_method || 'FIFO',
        warehouse_id: product.warehouse_id || '',
        bin_location_id: product.bin_location_id || '',
        lead_time_days: String((product as any).lead_time_days || ''),
        shelf_life_days: String((product as any).shelf_life_days || ''),
        warranty_months: warrantyId,
        weight: (product as any).weight || '',
        dimension: (product as any).dimension || '',
        color: (product as any).color || '',
        size: (product as any).size || '',
        brand: brandId,
        product_type: typeId,
        shipping_instruction: handlingId,
        supplier_id: (product as any).supplier_id || '',
      });
    } else {
      setEditingProduct(null);
      // Prefer the globally selected warehouse; fall back to first available
      const defaultWarehouse =
        (selectedWarehouseId && warehouses.find((w) => w.id === selectedWarehouseId))
          ? selectedWarehouseId
          : warehouses[0]?.id || '';
      const defaultBin = binLocations[defaultWarehouse]?.[0]?.id || '';
      setFormData({
        name: '',
        sku: '',
        description: '',
        category_id: '',
        selling_price: '',
        cost_price: '',
        reorder_level: '10',
        unit_of_measure: '',
        track_batches: true,
        allocation_method: 'FIFO',
        warehouse_id: defaultWarehouse,
        bin_location_id: defaultBin,
        lead_time_days: '',
        shelf_life_days: '',
        warranty_months: '',
        weight: '',
        dimension: '',
        color: '',
        size: '',
        brand: '',
        product_type: '',
        shipping_instruction: '',
        supplier_id: '',
      });
    }
    setActiveTab('basic');
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingProduct(null);
  };

  const handleSubmit = async () => {
    if (!formData.name || !formData.sku) {
      toast.error('Please fill in all required fields');
      return;
    }

    if (!formData.warehouse_id || !formData.bin_location_id) {
      toast.error('Please select a default warehouse and bin location');
      return;
    }

    try {
      setIsSubmitting(true);
      const defaultCompanyId = process.env.NEXT_PUBLIC_DEFAULT_COMPANY_ID || 'f0185bde-94c5-4efd-9c62-249fa165d32a';
      
      // Map warranty ID to duration_months (only if warranty_months is set and types exist)
      let warrantyMonths: number | undefined = undefined;
      if (formData.warranty_months && warrantyTypes.length > 0) {
        const warranty = warrantyTypes.find(w => w.id === formData.warranty_months);
        warrantyMonths = warranty?.duration_months;
      }
      
      // Map brand ID to brand name (only if brand is set and brands exist)
      let brandName: string | undefined = undefined;
      if (formData.brand && brands.length > 0) {
        const brand = brands.find(b => b.id === formData.brand);
        brandName = brand?.name;
      }
      
      // Map product_type ID to type name (only if product_type is set and types exist)
      let productTypeName: string | undefined = undefined;
      if (formData.product_type && productTypes.length > 0) {
        const ptype = productTypes.find(pt => pt.id === formData.product_type);
        productTypeName = ptype?.name;
      }
      
      // Map handling instruction ID to name (only if shipping_instruction is set and exists)
      let handlingName: string | undefined = undefined;
      if (formData.shipping_instruction && handlingInstructions.length > 0) {
        const handling = handlingInstructions.find(h => h.id === formData.shipping_instruction);
        handlingName = handling?.name;
      }
      
      // When editing, preserve original values if lookup failed
      if (editingProduct) {
        if (formData.warranty_months && !warrantyMonths) {
          warrantyMonths = (editingProduct as any).warranty_months;
        }
        if (formData.brand && !brandName) {
          brandName = (editingProduct as any).brand;
        }
        if (formData.product_type && !productTypeName) {
          productTypeName = (editingProduct as any).product_type;
        }
        if (formData.shipping_instruction && !handlingName) {
          handlingName = (editingProduct as any).shipping_instruction;
        }
      }
      
      const basePayload = {
        name: formData.name,
        sku: formData.sku,
        description: formData.description,
        category_id: formData.category_id || null,
        selling_price: formData.selling_price ? parseFloat(formData.selling_price) : 0,
        cost_price: parseFloat(formData.cost_price) || 0,
        reorder_level: parseInt(formData.reorder_level) || 10,
        unit_of_measure: formData.unit_of_measure,
        tax_rate: 0,
        track_batches: formData.track_batches,
        allocation_method: !formData.track_batches && formData.allocation_method === 'FEFO' ? 'FIFO' : formData.allocation_method,
        warehouse_id: formData.warehouse_id,
        bin_location_id: formData.bin_location_id,
        status: 'active' as const,
        // Duration fields
        lead_time_days: formData.lead_time_days ? parseInt(formData.lead_time_days) : undefined,
        shelf_life_days: formData.shelf_life_days ? parseInt(formData.shelf_life_days) : undefined,
        warranty_months: warrantyMonths,
        // Attributes fields
        weight: formData.weight || undefined,
        dimension: formData.dimension || undefined,
        color: formData.color || undefined,
        size: formData.size || undefined,
        brand: brandName,
        // Classification fields
        product_type: productTypeName,
        // Handling fields
        shipping_instruction: handlingName,
        // Supplier
        supplier_id: formData.supplier_id || undefined,
      };

      // For create operations, include company_id. For updates, omit it since it's in the filter
      const payload = editingProduct ? basePayload : { ...basePayload, company_id: defaultCompanyId };

      console.log('Submitting payload:', JSON.stringify(payload, null, 2));

      if (editingProduct) {
        const response = await updateProduct(editingProduct.id, payload as any);
        if (!response || response.error) {
          toast.error(`Failed to update product: ${response?.error?.message || 'Unknown error'}`);
          return;
        }
        toast.success('Product updated successfully');
      } else {
        const createPayload = { ...payload, company_id: defaultCompanyId };
        const response = await createProduct(createPayload as any);
        console.log('Create response:', response);
        if (!response || response.error) {
          toast.error(`Failed to create product: ${response?.error?.message || 'Unknown error'}`);
          return;
        }
        toast.success('Product created successfully');
      }

      handleCloseModal();
      await loadData();
    } catch (error) {
      console.error('Submit error:', error);
      toast.error('Error saving product');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this product?')) return;

    try {
      const response = await deleteProduct(id);
      if (response.error) {
        toast.error('Failed to delete product');
        return;
      }
      toast.success('Product deleted successfully');
      await loadData();
    } catch (error) {
      toast.error('Error deleting product');
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    if (!confirm(`Delete ${selectedIds.size} product${selectedIds.size !== 1 ? 's' : ''}? This cannot be undone.`)) return;

    setIsBulkDeleting(true);
    let ok = 0, fail = 0;
    for (const id of selectedIds) {
      try {
        const res = await deleteProduct(id);
        res.error ? fail++ : ok++;
      } catch {
        fail++;
      }
    }
    setIsBulkDeleting(false);
    setSelectedIds(new Set());
    if (ok > 0) { toast.success(`${ok} product${ok !== 1 ? 's' : ''} deleted`); await loadData(); }
    if (fail > 0) toast.error(`${fail} product${fail !== 1 ? 's' : ''} failed to delete`);
  };

  const toggleSelect = (id: string) =>
    setSelectedIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const toggleSelectAll = () =>
    setSelectedIds(prev => prev.size === filteredProducts.length ? new Set() : new Set(filteredProducts.map(p => p.id)));

const handleBulkUpload = async (products: Array<Record<string, unknown>>) => {
    setIsUploadingBulk(true);
    const results: Array<{ sku: string; name: string; success: boolean; error?: string }> = [];

    try {
      // Get companyId from client storage as fallback when cookie is stale
      let clientCompanyId = '';
      try {
        const raw = sessionStorage.getItem('user') ?? localStorage.getItem('user');
        if (raw) clientCompanyId = JSON.parse(raw)?.companyId ?? '';
      } catch {}

      // Category fallback: use the first real category for this company
      const firstCategory = categories[0]?.id || '';

      for (const product of products) {
        const sku = String(product.sku || '');
        const name = String(product.name || '');
        try {
          const trackBatches = String(product.track_batches).toLowerCase() === 'true';
          const defaultWarehouseId = selectedWarehouseId || warehouses[0]?.id || '';
          const defaultBinId = binLocations[defaultWarehouseId]?.[0]?.id || '';

          const isUuid = (v: unknown) => typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);

          // Normalize a string for loose matching: lowercase, collapse spaces/hyphens/underscores
          const norm = (s: string) => s.toLowerCase().replace(/[-_\s]+/g, ' ').trim();

          // Resolve a CSV value (UUID, name, or code) to an ID
          const resolveByNameOrUuid = (
            val: unknown,
            list: Array<{ id: string; name: string; code?: number | null }>,
            fallback?: string
          ): string | undefined => {
            const v = String(val || '').trim();
            if (!v) return fallback || undefined;
            if (isUuid(v)) return v;
            // exact name match first, then normalized (handles "Supplier-1" ↔ "Supplier 1")
            const nv = norm(v);
            const byName = list.find(item => norm(item.name) === nv);
            if (byName) return byName.id;
            const byCode = list.find(item => item.code != null && String(item.code).padStart(4, '0') === v);
            if (byCode) return byCode.id;
            return fallback || undefined;
          };

          // Resolve category: prefer CSV value (name or UUID), then first real category
          const resolvedCategoryId = resolveByNameOrUuid(product.category_id, categories, firstCategory || undefined);

          // Resolve warehouse: accept name, code (0001), or UUID — fallback to selected warehouse
          // supports both old 'warehouse_id' and new 'warehouse_name' column headers
          const resolvedWarehouseId = resolveByNameOrUuid(product.warehouse_name ?? product.warehouse_id, warehouses, defaultWarehouseId || undefined);

          // Resolve supplier: accept name, code (0001), or UUID
          // supports both old 'supplier_id' and new 'supplier_name' column headers
          const resolvedSupplierId = resolveByNameOrUuid(product.supplier_name ?? product.supplier_id, suppliers);

          // Resolve bin location: UUID, location_name, or formatted code (ZA-A1-S1-B01)
          // Use all bin locations across all loaded warehouses
          const allBins = Object.values(binLocations).flat();
          const resolvedBinId = (() => {
            const v = String(product.bin_location_id || '').trim();
            if (!v) return defaultBinId || undefined;
            if (isUuid(v)) return v;
            const nv = norm(v);
            // match by location_name
            const byLocName = allBins.find(b => (b as any).location_name && norm((b as any).location_name) === nv);
            if (byLocName) return byLocName.id;
            // match by formatted code Z{zone}-A{aisle}-S{shelf}-B{bin_number}
            const byCode = allBins.find(b => {
              const code = `Z${b.zone ?? ''}-A${b.aisle ?? ''}-S${b.shelf ?? ''}-B${b.bin_number ?? ''}`;
              return norm(code) === nv;
            });
            if (byCode) return byCode.id;
            return defaultBinId || undefined;
          })();

          const payload: any = {
            name,
            sku,
            description: String(product.description || ''),
            ...(resolvedCategoryId ? { category_id: resolvedCategoryId } : {}),
            selling_price: parseFloat(String(product.selling_price || 0)) || 0,
            cost_price: parseFloat(String(product.cost_price || 0)) || 0,
            reorder_level: parseInt(String(product.reorder_level || 10)) || 10,
            unit_of_measure: String(product.unit_of_measure || 'pieces'),
            tax_rate: 0,
            status: 'active' as const,
            warehouse_id: resolvedWarehouseId,
            bin_location_id: resolvedBinId,
            track_batches: trackBatches,
            allocation_method: (String(product.allocation_method || 'FIFO') as 'FIFO' | 'FEFO' | 'LIFO'),
            lead_time_days: product.lead_time_days ? parseInt(String(product.lead_time_days)) : undefined,
            shelf_life_days: product.shelf_life_days ? parseInt(String(product.shelf_life_days)) : undefined,
            warranty_months: product.warranty_months ? parseInt(String(product.warranty_months)) : undefined,
            weight: product.weight ? String(product.weight) : undefined,
            dimension: product.dimension ? String(product.dimension) : undefined,
            color: product.color ? String(product.color) : undefined,
            size: product.size ? String(product.size) : undefined,
            brand: product.brand ? String(product.brand) : undefined,
            product_type: product.product_type ? String(product.product_type) : undefined,
            shipping_instruction: product.shipping_instruction ? String(product.shipping_instruction) : undefined,
            supplier_id: resolvedSupplierId,
            // Pass client company_id so the server action can use it as a fallback
            // if the session cookie is stale (server action always prefers its own cookie)
            company_id: clientCompanyId || undefined,
          };

          // upsertProduct: inserts new SKUs, updates existing ones — no duplicate errors
          const response = await upsertProduct(payload);
          if (response.error) {
            results.push({ sku, name, success: false, error: response.error.message });
          } else {
            results.push({ sku, name, success: true });
          }
        } catch (err: any) {
          results.push({ sku, name, success: false, error: err?.message || 'Unknown error' });
        }
      }

      await loadData();

      const successCount = results.filter((r) => r.success).length;
      const failureCount = results.filter((r) => !r.success).length;

      if (failureCount === 0) {
        toast.success(`Successfully imported all ${successCount} products`);
        setIsBulkUploadOpen(false);
      } else if (successCount === 0) {
        // All failed — show first error clearly so user knows what to fix
        const firstError = results.find((r) => !r.success)?.error || 'Unknown error';
        toast.error(`Import failed: ${firstError}`);
        // Don't close modal so user can see the issue
      } else {
        toast.warning(`Imported ${successCount} products. ${failureCount} failed.`);
        setIsBulkUploadOpen(false);
      }
    } catch (error: any) {
      toast.error(`Error uploading products: ${error?.message || 'Unknown error'}`);
    } finally {
      setIsUploadingBulk(false);
    }
  };

  const downloadCSV = () => {
    const headers = ['SKU', 'Name', 'Category', 'Supplier', 'UOM', 'Cost Price', 'Selling Price', 'Reorder Level', 'Status', 'Description'];
    const rows = filteredProducts.map((p) => [
      p.sku,
      p.name,
      categoryMap[p.category_id || ''] || '',
      supplierMap[(p as any).supplier_id || ''] || '',
      uomMap[p.unit_of_measure || ''] || p.unit_of_measure || '',
      parseFloat(String(p.cost_price || 0)).toFixed(2),
      parseFloat(String(p.selling_price || 0)).toFixed(2),
      p.reorder_level ?? '',
      p.status || '',
      p.description || '',
    ]);
    const csv = [headers, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const supplierSuffix = supplierFilter ? `-${supplierMap[supplierFilter]?.replace(/\s+/g, '_') || supplierFilter}` : '';
    a.download = `products${supplierSuffix}-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const filteredProducts = products.filter((p) => {
    const q = searchTerm.toLowerCase();
    if (q && !p.name.toLowerCase().includes(q) && !p.sku.toLowerCase().includes(q)) return false;
    if (categoryFilter && p.category_id !== categoryFilter) return false;
    if (statusFilter && p.status !== statusFilter) return false;
    if (uomFilter && p.unit_of_measure !== uomFilter) return false;
    if (supplierFilter && (p as any).supplier_id !== supplierFilter) return false;
    return true;
  });

  const allSelected = filteredProducts.length > 0 && selectedIds.size === filteredProducts.length;
  const someSelected = selectedIds.size > 0 && !allSelected;

  // Lookup maps for display
  const categoryMap = Object.fromEntries(categories.map(c => [c.id, c.name]));
  const uomMap = Object.fromEntries(units.map(u => [u.id, u.abbreviation || u.name]));
  const supplierMap = Object.fromEntries(suppliers.map(s => [s.id, s.name]));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Products</h1>
          <p className="mt-1 text-gray-600 dark:text-gray-400">
            {selectedWarehouseId !== 'all' && contextWarehouses.length > 0
              ? `📦 ${fmtWarehouse(contextWarehouses.find(w => w.id === selectedWarehouseId)) || 'Selected Warehouse'} · ${products.length} products`
              : 'Manage your product inventory'}
          </p>
        </div>
        <div className="flex gap-3">
          <Button onClick={downloadCSV} variant="secondary" className="gap-2">
            <Download className="h-5 w-5" />
            CSV
          </Button>
          <Button onClick={() => setIsBulkUploadOpen(true)} variant="secondary" className="gap-2">
            <Upload className="h-5 w-5" />
            Bulk Import
          </Button>
          <Button onClick={() => handleOpenModal()} className="gap-2">
            <Plus className="h-5 w-5" />
            Add Product
          </Button>
        </div>
      </div>

      {/* Search + Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="flex-1 min-w-[200px] relative">
          <Search className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search by name or SKU..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full rounded-lg border border-gray-300 pl-10 pr-4 py-2 outline-none transition-all focus:border-primary-500 focus:ring-2 focus:ring-primary-200 dark:border-gray-600 dark:bg-gray-800 dark:text-white dark:focus:ring-primary-900"
          />
        </div>
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm min-w-[140px]"
        >
          <option value="">All Categories</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        <select
          value={uomFilter}
          onChange={(e) => setUomFilter(e.target.value)}
          className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm min-w-[120px]"
        >
          <option value="">All UOM</option>
          {units.map((u) => (
            <option key={u.id} value={u.id}>{u.name} ({u.abbreviation})</option>
          ))}
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm min-w-[120px]"
        >
          <option value="">All Status</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
        <select
          value={supplierFilter}
          onChange={(e) => setSupplierFilter(e.target.value)}
          className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm min-w-[140px]"
        >
          <option value="">All Suppliers</option>
          {suppliers.map((s) => (
            <option key={s.id} value={s.id}>{fmtSupplier(s)}</option>
          ))}
        </select>
        {(categoryFilter || uomFilter || statusFilter || supplierFilter) && (
          <button
            onClick={() => { setCategoryFilter(''); setUomFilter(''); setStatusFilter(''); setSupplierFilter(''); }}
            className="text-xs text-gray-400 hover:text-red-500 dark:hover:text-red-400 px-2 py-2"
          >
            Clear filters
          </button>
        )}
      </div>

      {/* Bulk delete action bar */}
      {selectedIds.size > 0 && (
        <div className="flex items-center justify-between px-4 py-2.5 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
          <span className="text-sm font-medium text-red-700 dark:text-red-300 flex items-center gap-2">
            <CheckSquare className="h-4 w-4" />
            {selectedIds.size} product{selectedIds.size !== 1 ? 's' : ''} selected
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSelectedIds(new Set())}
              className="text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 px-2 py-1"
            >
              Clear
            </button>
            <button
              onClick={handleBulkDelete}
              disabled={isBulkDeleting}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white rounded-lg"
            >
              <Trash2 className="h-3.5 w-3.5" />
              {isBulkDeleting ? 'Deleting…' : `Delete ${selectedIds.size}`}
            </button>
          </div>
        </div>
      )}

      {/* Products Table */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader className="h-8 w-8 animate-spin text-primary-600" />
        </div>
      ) : filteredProducts.length === 0 ? (
        <div className="rounded-lg border border-gray-200 bg-gray-50 py-12 text-center dark:border-gray-700 dark:bg-gray-900">
          <p className="text-gray-600 dark:text-gray-400">No products found</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800">
              <tr>
                <th className="w-10 px-4 py-3">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    ref={el => { if (el) el.indeterminate = someSelected; }}
                    onChange={toggleSelectAll}
                    className="h-4 w-4 rounded border-gray-300 text-primary-600 cursor-pointer"
                  />
                </th>
                <th className="px-4 py-3 font-semibold text-gray-900 dark:text-white">SKU</th>
                <th className="px-4 py-3 font-semibold text-gray-900 dark:text-white">Name</th>
                <th className="px-4 py-3 font-semibold text-gray-900 dark:text-white">Category</th>
                <th className="px-4 py-3 font-semibold text-gray-900 dark:text-white">Supplier</th>
                <th className="px-4 py-3 font-semibold text-gray-900 dark:text-white">UOM</th>
                <th className="px-4 py-3 text-right font-semibold text-gray-900 dark:text-white">Cost Price</th>
                <th className="px-4 py-3 text-center font-semibold text-gray-900 dark:text-white">Reorder Lvl</th>
                <th className="px-4 py-3 font-semibold text-gray-900 dark:text-white">Status</th>
                <th className="px-4 py-3 font-semibold text-gray-900 dark:text-white">Allocation</th>
                <th className="px-4 py-3 font-semibold text-gray-900 dark:text-white">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {filteredProducts.map((product) => {
                const categoryName = categoryMap[product.category_id || ''] || '—';
                const supplierName = supplierMap[(product as any).supplier_id || ''] || '—';
                const uomLabel = uomMap[product.unit_of_measure || ''] || product.unit_of_measure || '—';
                return (
                <tr key={product.id} className={`hover:bg-gray-50 dark:hover:bg-gray-900/50 ${selectedIds.has(product.id) ? 'bg-red-50/50 dark:bg-red-900/10' : ''}`}>
                  <td className="w-10 px-4 py-3">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(product.id)}
                      onChange={() => toggleSelect(product.id)}
                      className="h-4 w-4 rounded border-gray-300 text-primary-600 cursor-pointer"
                    />
                  </td>
                  <td className="px-4 py-3 font-mono text-sm text-gray-900 dark:text-gray-100">
                    {product.sku}
                  </td>
                  <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-gray-100">{product.name}</td>
                  <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                    {categoryName}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                    {supplierName}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <span className="inline-block px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-xs font-medium text-gray-600 dark:text-gray-300">
                      {uomLabel}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right text-sm text-gray-600 dark:text-gray-400">
                    ₱{parseFloat(String(product.cost_price || 0)).toFixed(2)}
                  </td>
                  <td className="px-4 py-3 text-center text-sm text-gray-600 dark:text-gray-400">
                    {product.reorder_level ?? '—'}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${
                        product.status === 'active'
                          ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                          : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
                      }`}
                    >
                      {product.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {(product as any).track_batches ? (() => {
                      const method = (product as any).allocation_method || 'FIFO';
                      const styles: Record<string, string> = {
                        FIFO: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
                        FEFO: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
                        LIFO: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
                      };
                      return (
                        <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${styles[method] ?? styles.FIFO}`}>
                          {method}
                        </span>
                      );
                    })() : (
                      <span className="inline-flex rounded-full px-2.5 py-1 text-xs font-medium bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400">
                        Pool
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <button
                        onClick={() => setViewingProduct(product)}
                        className="rounded-lg bg-gray-50 p-2 text-gray-500 hover:bg-gray-100 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700"
                        title="View details"
                      >
                        <Eye className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleOpenModal(product)}
                        className="rounded-lg bg-primary-50 p-2 text-primary-600 hover:bg-primary-100 dark:bg-primary-900/20 dark:text-primary-400 dark:hover:bg-primary-900/30"
                      >
                        <Edit2 className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(product.id)}
                        className="rounded-lg bg-red-50 p-2 text-red-600 hover:bg-red-100 dark:bg-red-900/20 dark:text-red-400 dark:hover:bg-red-900/30"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Product View Modal */}
      {viewingProduct && (() => {
        const p = viewingProduct as any;
        const wh = warehouses.find(w => w.id === p.warehouse_id);
        const sup = suppliers.find(s => s.id === p.supplier_id);
        const cat = categories.find(c => c.id === p.category_id);

        const idRow = (label: string, value: string | null | undefined, key: string) => (
          <div className="flex items-center justify-between gap-3 py-2 border-b dark:border-gray-700 last:border-0">
            <span className="text-xs text-gray-500 dark:text-gray-400 w-28 flex-shrink-0">{label}</span>
            {value ? (
              <button
                onClick={() => copyField(value, key)}
                className="flex items-center gap-1.5 group flex-1 min-w-0"
              >
                <span className="font-mono text-xs text-gray-700 dark:text-gray-300 truncate">{value}</span>
                {copiedField === key
                  ? <Check className="h-3.5 w-3.5 text-green-500 flex-shrink-0" />
                  : <Copy className="h-3.5 w-3.5 text-gray-400 opacity-0 group-hover:opacity-100 flex-shrink-0 transition-opacity" />}
              </button>
            ) : (
              <span className="text-xs text-gray-400 flex-1">—</span>
            )}
          </div>
        );

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
            <div className="bg-white dark:bg-gray-900 rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
              {/* Header */}
              <div className="flex items-start justify-between px-5 py-4 border-b dark:border-gray-700 sticky top-0 bg-white dark:bg-gray-900">
                <div>
                  <h2 className="text-base font-semibold text-gray-900 dark:text-white">{p.name}</h2>
                  <p className="text-xs text-gray-500 dark:text-gray-400 font-mono mt-0.5">{p.sku}</p>
                </div>
                <button onClick={() => setViewingProduct(null)} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500">
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="p-5 space-y-5">
                {/* Basic info */}
                <div>
                  <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">Details</p>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                    <span className="text-gray-500 dark:text-gray-400">Category</span><span className="text-gray-900 dark:text-white">{cat?.name || '—'}</span>
                    <span className="text-gray-500 dark:text-gray-400">Supplier</span><span className="text-gray-900 dark:text-white">{sup ? fmtSupplier(sup) : '—'}</span>
                    <span className="text-gray-500 dark:text-gray-400">Warehouse</span><span className="text-gray-900 dark:text-white">{wh ? fmtWarehouse(wh) : '—'}</span>
                    <span className="text-gray-500 dark:text-gray-400">UOM</span><span className="text-gray-900 dark:text-white">{p.unit_of_measure || '—'}</span>
                    <span className="text-gray-500 dark:text-gray-400">Cost Price</span><span className="text-gray-900 dark:text-white">₱{parseFloat(p.cost_price || 0).toFixed(2)}</span>
                    <span className="text-gray-500 dark:text-gray-400">Selling Price</span><span className="text-gray-900 dark:text-white">₱{parseFloat(p.selling_price || 0).toFixed(2)}</span>
                    <span className="text-gray-500 dark:text-gray-400">Reorder Level</span><span className="text-gray-900 dark:text-white">{p.reorder_level ?? '—'}</span>
                    <span className="text-gray-500 dark:text-gray-400">Status</span><span className="text-gray-900 dark:text-white capitalize">{p.status}</span>
                  </div>
                </div>

                {/* CSV column values */}
                <div>
                  <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">Bulk Upload CSV Values</p>
                  <p className="text-xs text-gray-400 dark:text-gray-500 mb-2">Click any value to copy. Paste into the matching CSV column.</p>
                  <div className="bg-gray-50 dark:bg-gray-800 rounded-lg px-3 py-1">
                    {idRow('warehouse_name', wh?.name, 'warehouse_name')}
                    {idRow('supplier_name', sup?.name, 'supplier_name')}
                    {idRow('bin_location_id', p.bin_location_id, 'bin_location_id')}
                    {idRow('category_id', p.category_id, 'category_id')}
                  </div>
                </div>
              </div>

              <div className="px-5 pb-4">
                <button
                  onClick={() => { setViewingProduct(null); handleOpenModal(viewingProduct); }}
                  className="w-full px-4 py-2 text-sm font-medium bg-primary-600 hover:bg-primary-700 text-white rounded-lg"
                >
                  Edit Product
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Add/Edit Product Modal */}
      <FormModal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        title={editingProduct ? 'Edit Product' : 'Add New Product'}
        isLoading={isSubmitting}
        onSubmit={handleSubmit}
      >
        {/* Tab Navigation */}
        <div className="mb-6 flex flex-wrap gap-1 border-b border-gray-200 dark:border-gray-700">
          <button
            type="button"
            onClick={() => setActiveTab('basic')}
            className={`px-3 py-2 font-medium text-sm whitespace-nowrap ${
              activeTab === 'basic'
                ? 'border-b-2 border-primary-600 text-primary-600'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-300'
            }`}
          >
            Basic
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('duration')}
            className={`px-3 py-2 font-medium text-sm whitespace-nowrap ${
              activeTab === 'duration'
                ? 'border-b-2 border-primary-600 text-primary-600'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-300'
            }`}
          >
            Duration
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('attributes')}
            className={`px-3 py-2 font-medium text-sm whitespace-nowrap ${
              activeTab === 'attributes'
                ? 'border-b-2 border-primary-600 text-primary-600'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-300'
            }`}
          >
            Attr.
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('classification')}
            className={`px-3 py-2 font-medium text-sm whitespace-nowrap ${
              activeTab === 'classification'
                ? 'border-b-2 border-primary-600 text-primary-600'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-300'
            }`}
          >
            Class.
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('handling')}
            className={`px-3 py-2 font-medium text-sm whitespace-nowrap ${
              activeTab === 'handling'
                ? 'border-b-2 border-primary-600 text-primary-600'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-300'
            }`}
          >
            Handle
          </button>
        </div>

        <div className="space-y-3">
          {/* BASIC INFO TAB */}
          {activeTab === 'basic' && (
            <>
              <FormInput
                label="Product Name"
                name="name"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
              
              <div className="grid grid-cols-3 gap-3">
                <FormInput
                  label="SKU"
                  name="sku"
                  required
                  value={formData.sku}
                  onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                />
                <FormSelect
                  label="Category"
                  name="category_id"
                  value={formData.category_id}
                  onChange={(e) => setFormData({ ...formData, category_id: e.target.value })}
                  options={categories.map(cat => ({ value: cat.id, label: cat.name }))}
                />
                <FormSelect
                  label="Supplier"
                  name="supplier_id"
                  value={formData.supplier_id}
                  onChange={(e) => setFormData({ ...formData, supplier_id: e.target.value })}
                  options={[{ value: '', label: '— None —' }, ...suppliers.map(s => ({ value: s.id, label: fmtSupplier(s) }))]}
                />
              </div>

              <FormInput
                label="Description"
                name="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              />

              <div className="grid grid-cols-3 gap-3">
                <FormSelect
                  label="Unit of Measure"
                  name="unit_of_measure"
                  value={(formData.unit_of_measure || '').toLowerCase()}
                  onChange={(e) => setFormData({ ...formData, unit_of_measure: e.target.value })}
                  options={units.map(unit => ({ value: unit.name.toLowerCase(), label: unit.abbreviation ? `${unit.name} (${unit.abbreviation})` : unit.name }))}
                />
                <FormInput
                  label="Cost Price"
                  name="cost_price"
                  type="number"
                  step="0.01"
                  value={formData.cost_price}
                  onChange={(e) => setFormData({ ...formData, cost_price: e.target.value })}
                />
                <FormInput
                  label="Reorder Level"
                  name="reorder_level"
                  type="number"
                  value={formData.reorder_level}
                  onChange={(e) => setFormData({ ...formData, reorder_level: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <FormSelect
                  label="Default Warehouse"
                  name="warehouse_id"
                  required
                  value={formData.warehouse_id}
                  onChange={(e) => {
                    const warehouseId = e.target.value;
                    const firstBin = binLocations[warehouseId]?.[0]?.id || '';
                    setFormData({ ...formData, warehouse_id: warehouseId, bin_location_id: firstBin });
                  }}
                  options={warehouses.map(w => ({ value: w.id, label: fmtWarehouse(w) }))}
                />
                <FormSelect
                  label="Default Bin Location"
                  name="bin_location_id"
                  required
                  value={formData.bin_location_id}
                  onChange={(e) => setFormData({ ...formData, bin_location_id: e.target.value })}
                  options={(formData.warehouse_id ? binLocations[formData.warehouse_id] || [] : []).map(bin => ({
                    value: bin.id,
                    label: (bin as any).location_name || `${bin.zone}-${bin.aisle}-${bin.shelf}-${bin.bin_number}`
                  }))}
                />
              </div>
              
              {/* Batch Tracking Toggle */}
              <div className="flex items-center gap-3 rounded-lg bg-blue-50 p-3 dark:bg-blue-900/20">
                <input
                  type="checkbox"
                  id="track_batches"
                  checked={formData.track_batches}
                  onChange={(e) => {
                    const tracked = e.target.checked;
                    setFormData({
                      ...formData,
                      track_batches: tracked,
                      // FEFO requires batch tracking — reset to FIFO if disabling
                      allocation_method: !tracked && formData.allocation_method === 'FEFO' ? 'FIFO' : formData.allocation_method,
                    });
                  }}
                  className="h-5 w-5 cursor-pointer rounded border-gray-300 text-blue-600"
                />
                <label htmlFor="track_batches" className="cursor-pointer">
                  <span className="block font-medium text-gray-900 dark:text-white">Track Batches/Lots</span>
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    Enable to enforce FIFO — stock received first will be issued first. Required for batch-level traceability.
                  </span>
                </label>
              </div>

              {/* Allocation Method - only shown when batch tracking is enabled */}
              {formData.track_batches && (
                <FormSelect
                  label="Allocation Method"
                  name="allocation_method"
                  value={formData.allocation_method}
                  onChange={(e) => setFormData({ ...formData, allocation_method: e.target.value as 'FIFO' | 'FEFO' | 'LIFO' })}
                  options={[
                    { value: 'FIFO', label: 'FIFO – First In, First Out (oldest received first)' },
                    { value: 'FEFO', label: 'FEFO – First Expired, First Out (soonest expiry first)' },
                    { value: 'LIFO', label: 'LIFO – Last In, First Out (newest received first)' },
                  ]}
                />
              )}
            </>
          )}

          {/* DURATION TAB */}
          {activeTab === 'duration' && (
            <>
              <div className="grid grid-cols-3 gap-3">
                <FormInput
                  label="Lead Time (Days)"
                  name="lead_time_days"
                  type="number"
                  value={formData.lead_time_days}
                  onChange={(e) => setFormData({ ...formData, lead_time_days: e.target.value })}
                />
                <FormInput
                  label="Shelf Life (Days)"
                  name="shelf_life_days"
                  type="number"
                  value={formData.shelf_life_days}
                  onChange={(e) => setFormData({ ...formData, shelf_life_days: e.target.value })}
                />
                <FormSelect
                  label="Warranty (Months)"
                  name="warranty_months"
                  value={formData.warranty_months}
                  onChange={(e) => setFormData({ ...formData, warranty_months: e.target.value })}
                  options={[
                    { value: '', label: 'Select warranty...' },
                    ...warrantyTypes.map(w => ({ value: String(w.id), label: `${w.name} (${w.duration_months}m)` }))
                  ]}
                />
              </div>
            </>
          )}

          {/* ATTRIBUTES TAB */}
          {activeTab === 'attributes' && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <FormInput
                  label="Weight"
                  name="weight"
                  placeholder="e.g., 5kg, 250g"
                  value={formData.weight}
                  onChange={(e) => setFormData({ ...formData, weight: e.target.value })}
                />
                <FormInput
                  label="Dimension"
                  name="dimension"
                  placeholder="e.g., 10x20x30cm"
                  value={formData.dimension}
                  onChange={(e) => setFormData({ ...formData, dimension: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <FormInput
                  label="Color"
                  name="color"
                  value={formData.color}
                  onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                />
                <FormInput
                  label="Size"
                  name="size"
                  value={formData.size}
                  onChange={(e) => setFormData({ ...formData, size: e.target.value })}
                />
              </div>
              <FormSelect
                label="Brand"
                name="brand"
                value={formData.brand}
                onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
                options={[
                  { value: '', label: 'Select brand...' },
                  ...brands.map(b => ({ value: b.id, label: b.name }))
                ]}
              />
            </>
          )}

          {/* CLASSIFICATION TAB */}
          {activeTab === 'classification' && (
            <>
              <FormSelect
                label="Product Type"
                name="product_type"
                value={formData.product_type}
                onChange={(e) => setFormData({ ...formData, product_type: e.target.value })}
                options={[
                  { value: '', label: 'Select a product type' },
                  ...productTypes.map(pt => ({ value: pt.id, label: pt.name }))
                ]}
              />
            </>
          )}

          {/* HANDLING TAB */}
          {activeTab === 'handling' && (
            <>
              <FormSelect
                label="Shipping Instruction"
                name="shipping_instruction"
                value={formData.shipping_instruction}
                onChange={(e) => setFormData({ ...formData, shipping_instruction: e.target.value })}
                options={[
                  { value: '', label: 'Select handling instruction...' },
                  ...handlingInstructions.map(h => ({ value: h.id, label: h.symbol_code ? `${h.name} (${h.symbol_code})` : h.name }))
                ]}
              />
            </>
          )}
        </div>
      </FormModal>

      {/* Bulk Upload Modal */}
      <BulkUploadModal
        isOpen={isBulkUploadOpen}
        onClose={() => setIsBulkUploadOpen(false)}
        onUpload={handleBulkUpload}
        isLoading={isUploadingBulk}
        defaultWarehouseId={selectedWarehouseId || warehouses[0]?.id || ''}
        defaultWarehouseName={warehouses.find(w => w.id === (selectedWarehouseId || warehouses[0]?.id))?.name || ''}
        defaultBinLocationId={
          binLocations[selectedWarehouseId || warehouses[0]?.id || '']?.[0]?.id || ''
        }
        defaultSupplierName={''}
      />
    </div>
  );
}
