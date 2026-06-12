'use client';

import { useEffect, useState } from 'react';
import { PackagePlus, ArrowLeft, Save, Warehouse } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { getWarehouses, getBinLocationsByWarehouse, createProduct, getSuppliers } from '@/app/actions';
import { toast } from 'sonner';
import { fmtWarehouse, fmtSupplier } from '@/lib/warehouse-utils';
import { useWarehouse } from '@/contexts/warehouse-context';

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

interface Supplier {
  id: string;
  name: string;
  supplier_code: string;
}

interface ProductFormData {
  sku: string;
  name: string;
  description: string;
  category: string;
  price: string;
  costPrice: string;
  taxRate: string;
  reorderLevel: string;
  supplier_id: string;
  barcode: string;
  warehouse: string;
  binLocation: string;
  trackBatches: boolean;
  allocationMethod: 'FIFO' | 'FEFO' | 'LIFO';
  // Duration fields
  leadTimeDays: string;
  shelfLifeDays: string;
  warrantyMonths: string;
  // Attributes fields
  weight: string;
  dimension: string;
  color: string;
  size: string;
  brand: string;
  // Classification fields
  productType: string;
  // Handling fields
  shippingInstruction: string;
}

export default function AddProductPage() {
  const { selectedWarehouseId } = useWarehouse();
  const [formData, setFormData] = useState<ProductFormData>({
    sku: '',
    name: '',
    description: '',
    category: '',
    price: '',
    costPrice: '',
    taxRate: '',
    reorderLevel: '',
    supplier_id: '',
    barcode: '',
    warehouse: '',
    binLocation: '',
    trackBatches: true,
    allocationMethod: 'FIFO',
    leadTimeDays: '',
    shelfLifeDays: '',
    warrantyMonths: '',
    weight: '',
    dimension: '',
    color: '',
    size: '',
    brand: '',
    productType: '',
    shippingInstruction: '',
  });
  const [activeTab, setActiveTab] = useState<'basic' | 'duration' | 'attributes' | 'classification' | 'handling'>('basic');
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [binLocations, setBinLocations] = useState<Record<string, BinLocation[]>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Load warehouses and bin locations; re-default when global warehouse changes
  useEffect(() => {
    loadWarehouseData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedWarehouseId]);

  const loadWarehouseData = async () => {
    try {
      setIsLoadingData(true);
      const [warehousesResponse, suppliersResponse] = await Promise.all([
        getWarehouses(),
        getSuppliers(),
      ]);
      const warehousesData = Array.isArray(warehousesResponse.data) ? warehousesResponse.data : [];
      setWarehouses(warehousesData);
      setSuppliers(Array.isArray(suppliersResponse.data) ? suppliersResponse.data : []);

      // Load bin locations for each warehouse
      const binLocationsByWarehouse: Record<string, BinLocation[]> = {};
      for (const warehouse of warehousesData) {
        const binsResponse = await getBinLocationsByWarehouse(warehouse.id);
        if (!binsResponse.error && binsResponse.data) {
          binLocationsByWarehouse[warehouse.id] = Array.isArray(binsResponse.data) ? binsResponse.data : [];
        }
      }
      setBinLocations(binLocationsByWarehouse);

      // Auto-select: prefer the globally selected warehouse, fall back to first
      if (warehousesData.length > 0) {
        const preferredId =
          selectedWarehouseId && warehousesData.find((w) => w.id === selectedWarehouseId)
            ? selectedWarehouseId
            : warehousesData[0].id;
        setFormData((prev) => ({
          ...prev,
          warehouse: preferredId,
          binLocation: binLocationsByWarehouse[preferredId]?.[0]?.id || '',
        }));
      }
    } catch (error) {
      console.error('Error loading warehouse data:', error);
      toast.error('Failed to load warehouse data');
    } finally {
      setIsLoadingData(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    // Clear error for this field
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.sku) newErrors.sku = 'SKU is required';
    if (!formData.name) newErrors.name = 'Product name is required';
    if (!formData.category) newErrors.category = 'Category is required';
    if (formData.price && isNaN(parseFloat(formData.price))) {
      newErrors.price = 'Price must be a number';
    }
    if (!formData.reorderLevel) {
      newErrors.reorderLevel = 'Reorder level is required';
    } else if (!Number.isInteger(parseFloat(formData.reorderLevel))) {
      newErrors.reorderLevel = 'Reorder level must be a whole number';
    }
    if (!formData.warehouse) newErrors.warehouse = 'Default warehouse is required';
    if (!formData.binLocation) newErrors.binLocation = 'Default bin location is required';

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    try {
      setIsLoading(true);
      const defaultCompanyId = process.env.NEXT_PUBLIC_DEFAULT_COMPANY_ID || 'f0185bde-94c5-4efd-9c62-249fa165d32a';
      
      const payload = {
        name: formData.name,
        sku: formData.sku,
        description: formData.description,
        category_id: formData.category,
        selling_price: formData.price ? parseFloat(formData.price) : 0,
        cost_price: formData.costPrice ? parseFloat(formData.costPrice) : 0,
        reorder_level: parseInt(formData.reorderLevel),
        unit_of_measure: 'pieces',
        tax_rate: 0,
        track_batches: formData.trackBatches,
        allocation_method: formData.trackBatches ? formData.allocationMethod : 'FIFO',
        warehouse_id: formData.warehouse,
        bin_location_id: formData.binLocation,
        status: 'active' as const,
        company_id: defaultCompanyId,
        // Duration fields
        lead_time_days: formData.leadTimeDays ? parseInt(formData.leadTimeDays) : undefined,
        shelf_life_days: formData.shelfLifeDays ? parseInt(formData.shelfLifeDays) : undefined,
        warranty_months: formData.warrantyMonths ? parseInt(formData.warrantyMonths) : undefined,
        // Attributes fields
        weight: formData.weight || undefined,
        dimension: formData.dimension || undefined,
        color: formData.color || undefined,
        size: formData.size || undefined,
        brand: formData.brand || undefined,
        // Supplier link
        supplier_id: formData.supplier_id || undefined,
        // Classification fields
        product_type: formData.productType || undefined,
        // Handling fields
        shipping_instruction: formData.shippingInstruction || undefined,
      };

      const response = await createProduct(payload);
      if (response.error) {
        toast.error(`Failed to create product: ${response.error.message}`);
        return;
      }

      toast.success('Product created successfully');
      // Redirect to products page
      window.location.href = '/products';
    } catch (error) {
      console.error('Submit error:', error);
      toast.error('Error creating product');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6 p-4 md:p-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/products">
          <Button variant="secondary" icon={<ArrowLeft className="h-4 w-4" />}>
            Back
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white">
            Add New Product
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Fill in the product details to add it to your inventory
          </p>
        </div>
      </div>

      {/* Form Card */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Form */}
        <div className="lg:col-span-2">
          {isLoadingData ? (
            <div className="card p-6 flex items-center justify-center py-12">
              <div className="text-center">
                <div className="inline-block animate-spin">
                  <div className="h-8 w-8 border-4 border-primary-600 border-t-transparent rounded-full"></div>
                </div>
                <p className="mt-3 text-gray-600 dark:text-gray-400">Loading warehouse data...</p>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Tab Navigation */}
              <div className="card overflow-hidden">
                <div className="flex overflow-x-auto border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
                  <button
                    type="button"
                    onClick={() => setActiveTab('basic')}
                    className={`flex-1 px-6 py-3 font-semibold text-sm whitespace-nowrap transition-all ${
                      activeTab === 'basic'
                        ? 'border-b-2 border-primary-600 text-primary-600 bg-primary-50 dark:bg-primary-900/20'
                        : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50'
                    }`}
                  >
                    Basic Info
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('duration')}
                    className={`flex-1 px-6 py-3 font-semibold text-sm whitespace-nowrap transition-all ${
                      activeTab === 'duration'
                        ? 'border-b-2 border-primary-600 text-primary-600 bg-primary-50 dark:bg-primary-900/20'
                        : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50'
                    }`}
                  >
                    Duration
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('attributes')}
                    className={`flex-1 px-6 py-3 font-semibold text-sm whitespace-nowrap transition-all ${
                      activeTab === 'attributes'
                        ? 'border-b-2 border-primary-600 text-primary-600 bg-primary-50 dark:bg-primary-900/20'
                        : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50'
                    }`}
                  >
                    Attributes
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('classification')}
                    className={`flex-1 px-6 py-3 font-semibold text-sm whitespace-nowrap transition-all ${
                      activeTab === 'classification'
                        ? 'border-b-2 border-primary-600 text-primary-600 bg-primary-50 dark:bg-primary-900/20'
                        : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50'
                    }`}
                  >
                    Classification
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('handling')}
                    className={`flex-1 px-6 py-3 font-semibold text-sm whitespace-nowrap transition-all ${
                      activeTab === 'handling'
                        ? 'border-b-2 border-primary-600 text-primary-600 bg-primary-50 dark:bg-primary-900/20'
                        : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50'
                    }`}
                  >
                    Handling
                  </button>
                </div>

                {/* Tab Content */}
                <div className="p-8 bg-white dark:bg-gray-800">
                  <div className="space-y-6">
                {/* BASIC INFO TAB */}
                {activeTab === 'basic' && (
                  <>
                    {/* Basic Information */}
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                        <PackagePlus className="h-5 w-5 text-primary-600" />
                        Basic Information
                      </h3>
                      <div className="space-y-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Product Name *
                          </label>
                          <input
                            type="text"
                            name="name"
                            value={formData.name}
                            onChange={handleChange}
                            placeholder="Enter product name"
                            className={`w-full px-4 py-2 border rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent ${
                              errors.name ? 'border-red-500 dark:border-red-500' : 'border-gray-300 dark:border-gray-600'
                            }`}
                          />
                          {errors.name && <p className="text-red-500 text-sm mt-1">{errors.name}</p>}
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                              SKU *
                            </label>
                            <input
                              type="text"
                              name="sku"
                              value={formData.sku}
                              onChange={handleChange}
                              placeholder="PROD-001"
                              className={`w-full px-4 py-2 border rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent ${
                                errors.sku ? 'border-red-500 dark:border-red-500' : 'border-gray-300 dark:border-gray-600'
                              }`}
                            />
                            {errors.sku && <p className="text-red-500 text-sm mt-1">{errors.sku}</p>}
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                              Barcode
                            </label>
                            <input
                              type="text"
                              name="barcode"
                              value={formData.barcode}
                              onChange={handleChange}
                              placeholder="1234567890"
                              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                            />
                          </div>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Description
                          </label>
                          <textarea
                            name="description"
                            value={formData.description}
                            onChange={handleChange}
                            placeholder="Enter product description"
                            rows={4}
                            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none"
                          />
                        </div>
                      </div>
                    </div>


                    {/* Category, Supplier & Pricing */}
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                        Category & Pricing
                      </h3>
                      <div className="space-y-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                              Category *
                            </label>
                            <select
                              name="category"
                              value={formData.category}
                              onChange={handleChange}
                              className={`w-full px-4 py-2 border rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent ${
                                errors.category ? 'border-red-500 dark:border-red-500' : 'border-gray-300 dark:border-gray-600'
                              }`}
                            >
                              <option value="">Select a category</option>
                              <option value="electronics">Electronics</option>
                              <option value="accessories">Accessories</option>
                              <option value="software">Software</option>
                              <option value="hardware">Hardware</option>
                            </select>
                            {errors.category && <p className="text-red-500 text-sm mt-1">{errors.category}</p>}
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                              Supplier
                            </label>
                            <select
                              name="supplier_id"
                              value={formData.supplier_id}
                              onChange={handleChange}
                              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                            >
                              <option value="">— None —</option>
                              {suppliers.map((s) => (
                                <option key={s.id} value={s.id}>{fmtSupplier(s)}</option>
                              ))}
                            </select>
                          </div>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                              Cost Price
                            </label>
                            <div className="relative">
                              <span className="absolute left-4 top-2 text-gray-500 dark:text-gray-400">₱</span>
                              <input
                                type="number"
                                name="costPrice"
                                value={formData.costPrice}
                                onChange={handleChange}
                                placeholder="0.00"
                                step="0.01"
                                min="0"
                                className="w-full pl-8 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                              />
                            </div>
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                              Reorder Level *
                            </label>
                            <input
                              type="number"
                              name="reorderLevel"
                              value={formData.reorderLevel}
                              onChange={handleChange}
                              placeholder="10"
                              min="0"
                              step="1"
                              className={`w-full px-4 py-2 border rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent ${
                                errors.reorderLevel ? 'border-red-500 dark:border-red-500' : 'border-gray-300 dark:border-gray-600'
                              }`}
                            />
                            {errors.reorderLevel && <p className="text-red-500 text-sm mt-1">{errors.reorderLevel}</p>}
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                              Unit of Measure
                            </label>
                            <input
                              type="text"
                              name="unitOfMeasure"
                              placeholder="e.g. pcs, kg, box"
                              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                            />
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Warehouse & Inventory Settings */}
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                        Warehouse & Inventory
                      </h3>
                      <div className="space-y-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                              Default Warehouse *
                            </label>
                            <select
                              name="warehouse"
                              value={formData.warehouse}
                              onChange={(e) => {
                                const warehouseId = e.target.value;
                                const firstBin = binLocations[warehouseId]?.[0]?.id || '';
                                setFormData((prev) => ({
                                  ...prev,
                                  warehouse: warehouseId,
                                  binLocation: firstBin,
                                }));
                                if (errors.warehouse) {
                                  setErrors((prev) => ({ ...prev, warehouse: '' }));
                                }
                              }}
                              disabled={isLoadingData}
                              className={`w-full px-4 py-2 border rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent ${
                                errors.warehouse ? 'border-red-500 dark:border-red-500' : 'border-gray-300 dark:border-gray-600'
                              }`}
                            >
                              <option value="">Select warehouse</option>
                              {warehouses.map((w) => (
                                <option key={w.id} value={w.id}>
                                  {fmtWarehouse(w)}
                                </option>
                              ))}
                            </select>
                            {errors.warehouse && <p className="text-red-500 text-sm mt-1">{errors.warehouse}</p>}
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                              Default Bin Location *
                            </label>
                            <select
                              name="binLocation"
                              value={formData.binLocation}
                              onChange={(e) => {
                                setFormData((prev) => ({
                                  ...prev,
                                  binLocation: e.target.value,
                                }));
                                if (errors.binLocation) {
                                  setErrors((prev) => ({ ...prev, binLocation: '' }));
                                }
                              }}
                              disabled={isLoadingData || !formData.warehouse}
                              className={`w-full px-4 py-2 border rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent ${
                                errors.binLocation ? 'border-red-500 dark:border-red-500' : 'border-gray-300 dark:border-gray-600'
                              }`}
                            >
                              <option value="">Select location</option>
                              {(formData.warehouse ? binLocations[formData.warehouse] || [] : []).map((bin) => (
                                <option key={bin.id} value={bin.id}>
                                  {bin.zone}-{bin.aisle}-{bin.shelf}-{bin.bin_number}
                                </option>
                              ))}
                            </select>
                            {errors.binLocation && <p className="text-red-500 text-sm mt-1">{errors.binLocation}</p>}
                          </div>

                          <div className="flex items-end rounded-lg bg-blue-50 p-4 dark:bg-blue-900/20 h-auto">
                            <label className="flex items-center gap-3 cursor-pointer w-full">
                              <input
                                type="checkbox"
                                id="track_batches"
                                checked={formData.trackBatches}
                                onChange={(e) => setFormData({ ...formData, trackBatches: e.target.checked })}
                                className="h-5 w-5 rounded border-gray-300 text-blue-600"
                              />
                              <span>
                                <span className="block font-medium text-gray-900 dark:text-white text-sm">Track Batches/Lots</span>
                                <span className="block text-xs text-gray-600 dark:text-gray-400">Enable to enforce FIFO — stock received first will be issued first.</span>
                              </span>
                            </label>
                          </div>
                        </div>

                        {/* Batch Allocation Method - Only show if batch tracking enabled */}
                        {formData.trackBatches && (
                          <div className="space-y-4">
                            <div>
                              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                Batch Allocation Method *
                              </label>
                              <select
                                value={formData.allocationMethod}
                                onChange={(e) => setFormData({ ...formData, allocationMethod: e.target.value as 'FIFO' | 'FEFO' | 'LIFO' })}
                                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                              >
                                <option value="FIFO">FIFO - First In, First Out (oldest first)</option>
                                <option value="FEFO">FEFO - First Expired, First Out (expires soonest)</option>
                                <option value="LIFO">LIFO - Last In, First Out (newest first)</option>
                              </select>
                              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                Method for allocating batches when picking inventory
                              </p>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </>
                )}

                {/* DURATION TAB */}
                {activeTab === 'duration' && (
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Lead Time (Days)
                        </label>
                        <input
                          type="number"
                          name="leadTimeDays"
                          value={formData.leadTimeDays}
                          onChange={handleChange}
                          placeholder="0"
                          min="0"
                          step="1"
                          className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                        />
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Days for procurement from supplier</p>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Shelf Life (Days)
                        </label>
                        <input
                          type="number"
                          name="shelfLifeDays"
                          value={formData.shelfLifeDays}
                          onChange={handleChange}
                          placeholder="0"
                          min="0"
                          step="1"
                          className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                        />
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">From manufacture date</p>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Warranty (Months)
                        </label>
                        <input
                          type="number"
                          name="warrantyMonths"
                          value={formData.warrantyMonths}
                          onChange={handleChange}
                          placeholder="0"
                          min="0"
                          step="1"
                          className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                        />
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Product warranty period</p>
                      </div>
                    </div>
                  </>
                )}

                {/* ATTRIBUTES TAB */}
                {activeTab === 'attributes' && (
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Weight
                        </label>
                        <input
                          type="text"
                          name="weight"
                          value={formData.weight}
                          onChange={handleChange}
                          placeholder="e.g., 5kg, 250g"
                          className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Dimension
                        </label>
                        <input
                          type="text"
                          name="dimension"
                          value={formData.dimension}
                          onChange={handleChange}
                          placeholder="e.g., 10x20x30cm"
                          className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                        />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Color
                      </label>
                      <input
                        type="text"
                        name="color"
                        value={formData.color}
                        onChange={handleChange}
                        placeholder="e.g., Red, Blue, Black"
                        className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Size
                      </label>
                      <input
                        type="text"
                        name="size"
                        value={formData.size}
                        onChange={handleChange}
                        placeholder="e.g., Small, Medium, Large"
                        className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Brand
                      </label>
                      <input
                        type="text"
                        name="brand"
                        value={formData.brand}
                        onChange={handleChange}
                        placeholder="Brand/Manufacturer name"
                        className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      />
                    </div>
                  </div>
                  </>
                )}

                {/* CLASSIFICATION TAB */}
                {activeTab === 'classification' && (
                  <>
                    <div className="max-w-md">
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Product Type
                      </label>
                      <select
                        name="productType"
                        value={formData.productType}
                        onChange={handleChange}
                        className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      >
                        <option value="">Select a product type</option>
                        <option value="Consumable">Consumable</option>
                        <option value="Equipment">Equipment</option>
                        <option value="Raw Material">Raw Material</option>
                        <option value="Finished Good">Finished Good</option>
                        <option value="Service">Service</option>
                        <option value="Tool">Tool</option>
                      </select>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">Choose the category this product falls into</p>
                    </div>
                  </>
                )}

                {/* HANDLING TAB */}
                {activeTab === 'handling' && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Shipping Instruction
                      </label>
                      <textarea
                        name="shippingInstruction"
                        value={formData.shippingInstruction}
                        onChange={handleChange}
                        placeholder="e.g., Hazard, Fragile, Liquid, Keep Dry, Handle with Care"
                        rows={5}
                        className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none"
                      />
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">Special handling instructions for shipping and storage</p>
                    </div>
                  </>
                )}
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-3 p-6 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
                  <Link href="/products" className="flex-1">
                    <Button variant="secondary" className="w-full py-2.5">
                      Cancel
                    </Button>
                  </Link>
                  <Button
                    type="submit"
                    variant="primary"
                    className="flex-1 py-2.5"
                    icon={<Save className="h-4 w-4" />}
                    disabled={isLoading}
                  >
                    {isLoading ? 'Adding Product...' : 'Save Product'}
                  </Button>
                </div>
              </div>
            </form>
          )}
        </div>

        {/* Info Sidebar */}
        <div className="space-y-4">
          <div className="card p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
            <h4 className="font-semibold text-blue-900 dark:text-blue-200 mb-2">Tips</h4>
            <ul className="text-sm text-blue-800 dark:text-blue-300 space-y-1">
              <li>• Use clear, descriptive product names</li>
              <li>• Unique SKUs help track inventory</li>
              <li>• Set appropriate reorder levels</li>
              <li>• Include tax rates for accurate pricing</li>
              <li>• Set default putaway location for PO receiving</li>
            </ul>
          </div>

          <div className="card p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
            <h4 className="font-semibold text-green-900 dark:text-green-200 mb-2">Video Tutorial</h4>
            <p className="text-sm text-green-800 dark:text-green-300 mb-3">
              Watch our guide on adding products to your system.
            </p>
            <Button variant="secondary" className="w-full text-sm">
              Watch Now
            </Button>
          </div>

          <div className="card p-4">
            <h4 className="font-semibold text-gray-900 dark:text-white mb-2">Need Help?</h4>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
              Contact our support team if you need assistance.
            </p>
            <a href="mailto:support@example.com" className="text-primary-600 dark:text-primary-400 text-sm hover:underline">
              support@example.com
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
