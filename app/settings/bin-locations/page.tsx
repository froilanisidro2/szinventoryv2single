'use client';

import { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, Search, Box, ArrowLeft, Upload, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  getBinLocationsByWarehouse,
  createBinLocation,
  updateBinLocation,
  deleteBinLocation,
  getWarehouseUtilization,
  BinLocation,
  getWarehouses
} from '@/app/actions/index';
import { toast } from 'sonner';
import { BulkUploadModal } from '@/components/bulk-upload-modal';
import { useWarehouse } from '@/contexts/warehouse-context';
import { fmtWarehouse } from '@/lib/warehouse-utils';

interface Warehouse {
  id: string;
  name: string;
}

export default function BinLocationsPage() {
  const { selectedWarehouseId } = useWarehouse();
  const [bins, setBins] = useState<BinLocation[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [showBulkUpload, setShowBulkUpload] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterWarehouse, setFilterWarehouse] = useState('');
  const [filterZone, setFilterZone] = useState('all');
  const [createMode, setCreateMode] = useState<'auto' | 'custom'>('auto');
  const [formData, setFormData] = useState({
    warehouse_id: '',
    location_name: '',
    zone: '',
    aisle: '',
    shelf: '',
    bin_number: '',
    capacity: 100 as number | '',
    status: 'available' as 'available' | 'reserved' | 'maintenance' | 'archived',
    description: '',
  });
  const [autoData, setAutoData] = useState({
    warehouse_id: '',
    zones: 'A',
    aisle_from: 1,
    aisle_to: 1,
    shelf_from: 1,
    shelf_to: 1,
    bin_from: 1,
    bin_to: 5,
    capacity: 100,
    status: 'available' as 'available' | 'reserved' | 'maintenance' | 'archived',
  });

  // Load warehouses on mount, pre-select from global context
  useEffect(() => {
    const loadWarehouses = async () => {
      try {
        const result = await getWarehouses();
        if (!result.error && result.data) {
          setWarehouses(result.data);
          // Use global warehouse context if set, otherwise fall back to first warehouse
          if (selectedWarehouseId) {
            setFilterWarehouse(selectedWarehouseId);
          } else if (result.data.length > 0 && !filterWarehouse) {
            setFilterWarehouse(result.data[0].id);
          }
        }
      } catch (error) {
        console.error('Failed to load warehouses:', error);
      }
    };
    loadWarehouses();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedWarehouseId]);

  // Load bins and utilization when warehouse changes
  useEffect(() => {
    if (!filterWarehouse) return;
    setAutoData(prev => ({ ...prev, warehouse_id: filterWarehouse }));
    loadBins();
    loadWarehouseUtilization();
  }, [filterWarehouse]);

  async function loadBins() {
    setIsLoading(true);
    try {
      const result = await getBinLocationsByWarehouse(filterWarehouse);
      if (!result.error && result.data) {
        setBins(result.data);
      } else {
        toast.error('Failed to load bin locations');
      }
    } catch (error) {
      console.error('Error loading bins:', error);
      toast.error('Error loading bin locations');
    } finally {
      setIsLoading(false);
    }
  }

  async function loadWarehouseUtilization() {
    try {
      await getWarehouseUtilization(filterWarehouse);
    } catch (error) {
      console.error('Error loading warehouse utilization:', error);
    }
  }

  const autoPreviewCount =
    autoData.zones.split(',').filter(z => z.trim()).length *
    Math.max(0, autoData.aisle_to - autoData.aisle_from + 1) *
    Math.max(0, autoData.shelf_to - autoData.shelf_from + 1) *
    Math.max(0, autoData.bin_to - autoData.bin_from + 1);

  const handleAutoCreate = async () => {
    if (!autoData.zones.trim()) { toast.error('Enter at least one zone'); return; }
    const zones = autoData.zones.split(',').map(z => z.trim()).filter(Boolean);
    const entries: any[] = [];
    for (const zone of zones) {
      for (let a = autoData.aisle_from; a <= autoData.aisle_to; a++) {
        for (let s = autoData.shelf_from; s <= autoData.shelf_to; s++) {
          for (let b = autoData.bin_from; b <= autoData.bin_to; b++) {
            entries.push({
              warehouse_id: autoData.warehouse_id || filterWarehouse,
              zone,
              aisle: String(a),
              shelf: String(s),
              bin_number: String(b).padStart(2, '0'),
              capacity: autoData.capacity,
              status: autoData.status,
              description: '',
            });
          }
        }
      }
    }
    let ok = 0, fail = 0;
    for (const entry of entries) {
      const result = await createBinLocation(entry as any);
      result.error ? fail++ : ok++;
    }
    if (ok > 0) { toast.success(`${ok} bin locations created`); loadBins(); }
    if (fail > 0) toast.error(`${fail} bins failed to create`);
    resetForm();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.warehouse_id) {
      toast.error('Please select a warehouse');
      return;
    }
    if (!formData.location_name && !formData.bin_number) {
      toast.error('Provide either a Location Name or a Bin Number');
      return;
    }

    try {
      if (editingId) {
        const result = await updateBinLocation(editingId, formData as any);
        if (!result.error) {
          toast.success('Bin location updated successfully');
          loadBins();
        } else {
          toast.error(result.error?.message || 'Failed to update bin location');
        }
      } else {
        const result = await createBinLocation(formData as any);
        if (!result.error) {
          toast.success('Bin location created successfully');
          loadBins();
        } else {
          toast.error(result.error?.message || 'Failed to create bin location');
        }
      }
      
      resetForm();
    } catch (error) {
      console.error('Error submitting form:', error);
      toast.error('Error submitting form');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this bin location?')) return;

    try {
      const result = await deleteBinLocation(id);
      if (!result.error) {
        toast.success('Bin location deleted successfully');
        loadBins();
      } else {
        toast.error(result.error?.message || 'Failed to delete bin location');
      }
    } catch (error) {
      console.error('Error deleting bin:', error);
      toast.error('Error deleting bin location');
    }
  };

  const handleEdit = (bin: BinLocation) => {
    setFormData({
      warehouse_id: bin.warehouse_id,
      location_name: bin.location_name || '',
      zone: bin.zone || '',
      aisle: bin.aisle || '',
      shelf: bin.shelf || '',
      bin_number: bin.bin_number || '',
      capacity: bin.capacity ?? 100,
      status: bin.status,
      description: bin.description || '',
    });
    setEditingId(bin.id);
    setShowForm(true);
  };

  const resetForm = () => {
    setFormData({
      warehouse_id: filterWarehouse,
      location_name: '',
      zone: '',
      aisle: '',
      shelf: '',
      bin_number: '',
      capacity: 100,
      status: 'available',
      description: '',
    });
    setAutoData(prev => ({ ...prev, warehouse_id: filterWarehouse }));
    setEditingId(null);
    setShowForm(false);
  };

  // Filter and search bins
  const filteredBins = bins.filter(bin => {
    const searchMatch =
      bin.location_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      bin.zone?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      bin.bin_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      bin.description?.toLowerCase().includes(searchTerm.toLowerCase());

    const zoneMatch = filterZone === 'all' || bin.zone === filterZone;

    return searchMatch && zoneMatch;
  });

  const uniqueZones = [...new Set(bins.map(b => b.zone).filter(Boolean))].sort() as string[];

  const handleBulkUpload = async (rows: any[]) => {
    let successCount = 0;
    let failCount = 0;
    for (const row of rows) {
      try {
        const result = await createBinLocation({
          warehouse_id: filterWarehouse,
          zone: row.zone || null,
          aisle: row.aisle || null,
          shelf: row.shelf || null,
          bin_number: row.bin_number || null,
          capacity: parseInt(row.capacity) || 100,
          status: (row.status as any) || 'available',
          description: row.description || '',
        } as any);
        if (!result.error) successCount++;
        else failCount++;
      } catch {
        failCount++;
      }
    }
    if (failCount > 0) toast.error(`${failCount} rows failed to import`);
    if (successCount > 0) {
      toast.success(`${successCount} bin locations imported`);
      loadBins();
    }
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          
            <Button href="/settings" variant="secondary" size="sm">
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <Box className="h-6 w-6 text-primary-600" />
              Bin Locations
            </h1>
            <p className="text-gray-600 dark:text-gray-400">Manage warehouse bin locations and organize inventory by zone, aisle, shelf, and bin</p>
          </div>
        </div>
      </div>

      {/* Warehouse Selection */}
      <div className="flex gap-2 items-center">
        <label className="text-sm font-medium text-gray-600 dark:text-gray-400">Warehouse:</label>
        <div className="relative">
          <select
            value={filterWarehouse}
            onChange={(e) => setFilterWarehouse(e.target.value)}
            className="appearance-none pl-3 pr-8 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm font-medium text-gray-900 dark:text-white shadow-sm hover:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors cursor-pointer"
          >
            {warehouses.map(w => (
              <option key={w.id} value={w.id}>{fmtWarehouse(w)}</option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        </div>
      </div>

      {/* Controls */}
      <div className="flex flex-col sm:flex-row gap-3 justify-between items-start sm:items-center">
        <div className="flex gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:flex-none">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              placeholder="Search bins..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <select
            value={filterZone}
            onChange={(e) => setFilterZone(e.target.value)}
            className="px-3 py-2 border rounded-lg dark:bg-gray-900 dark:border-gray-700"
          >
            <option value="all">All Zones</option>
            {uniqueZones.map(zone => (
              <option key={zone} value={zone}>Zone {zone}</option>
            ))}
          </select>
        </div>

        <div className="flex gap-2">
          <Button
            onClick={() => setShowBulkUpload(true)}
            variant="secondary"
            size="sm"
            className="gap-2"
          >
            <Upload className="w-4 h-4" />
            Bulk Upload
          </Button>
          <Button
            onClick={() => {
              resetForm();
              setShowForm(true);
            }}
            size="sm"
            className="gap-2"
          >
            <Plus className="w-4 h-4" />
            New Bin
          </Button>
        </div>
      </div>

      {/* Form */}
      {showForm && (
        <div className="bg-white dark:bg-gray-950 border dark:border-gray-800 rounded-lg p-4 space-y-4">
          {/* Mode toggle — hide when editing */}
          {!editingId && (
            <div className="flex gap-1 p-1 bg-gray-100 dark:bg-gray-900 rounded-lg w-fit">
              <button
                type="button"
                onClick={() => setCreateMode('auto')}
                className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  createMode === 'auto'
                    ? 'bg-white dark:bg-gray-700 shadow text-gray-900 dark:text-white'
                    : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                }`}
              >
                Auto Create
              </button>
              <button
                type="button"
                onClick={() => setCreateMode('custom')}
                className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  createMode === 'custom'
                    ? 'bg-white dark:bg-gray-700 shadow text-gray-900 dark:text-white'
                    : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                }`}
              >
                Custom Name
              </button>
            </div>
          )}

          {/* Auto Create Form */}
          {!editingId && createMode === 'auto' && (
            <div className="space-y-4">
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Generate multiple bins at once by specifying zones and numeric ranges.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Warehouse *</label>
                  <select
                    value={autoData.warehouse_id || filterWarehouse}
                    onChange={(e) => setAutoData({ ...autoData, warehouse_id: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg dark:bg-gray-900 dark:border-gray-700"
                  >
                    {warehouses.map(w => (
                      <option key={w.id} value={w.id}>{fmtWarehouse(w)}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Zones *</label>
                  <Input
                    value={autoData.zones}
                    onChange={(e) => setAutoData({ ...autoData, zones: e.target.value })}
                    placeholder="e.g., A or A,B,C"
                  />
                  <p className="text-xs text-gray-400 mt-1">Comma-separated</p>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Capacity (units)</label>
                  <Input
                    type="number"
                    value={autoData.capacity}
                    onChange={(e) => setAutoData({ ...autoData, capacity: parseInt(e.target.value) || 100 })}
                    min="1"
                  />
                </div>
                {/* Aisle range */}
                <div>
                  <label className="block text-sm font-medium mb-1">Aisles</label>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      value={autoData.aisle_from}
                      onChange={(e) => setAutoData({ ...autoData, aisle_from: parseInt(e.target.value) || 1 })}
                      min="1"
                      className="w-20"
                    />
                    <span className="text-sm text-gray-500">to</span>
                    <Input
                      type="number"
                      value={autoData.aisle_to}
                      onChange={(e) => setAutoData({ ...autoData, aisle_to: parseInt(e.target.value) || 1 })}
                      min={autoData.aisle_from}
                      className="w-20"
                    />
                  </div>
                </div>
                {/* Shelf range */}
                <div>
                  <label className="block text-sm font-medium mb-1">Shelves</label>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      value={autoData.shelf_from}
                      onChange={(e) => setAutoData({ ...autoData, shelf_from: parseInt(e.target.value) || 1 })}
                      min="1"
                      className="w-20"
                    />
                    <span className="text-sm text-gray-500">to</span>
                    <Input
                      type="number"
                      value={autoData.shelf_to}
                      onChange={(e) => setAutoData({ ...autoData, shelf_to: parseInt(e.target.value) || 1 })}
                      min={autoData.shelf_from}
                      className="w-20"
                    />
                  </div>
                </div>
                {/* Bin range */}
                <div>
                  <label className="block text-sm font-medium mb-1">Bins</label>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      value={autoData.bin_from}
                      onChange={(e) => setAutoData({ ...autoData, bin_from: parseInt(e.target.value) || 1 })}
                      min="1"
                      className="w-20"
                    />
                    <span className="text-sm text-gray-500">to</span>
                    <Input
                      type="number"
                      value={autoData.bin_to}
                      onChange={(e) => setAutoData({ ...autoData, bin_to: parseInt(e.target.value) || 1 })}
                      min={autoData.bin_from}
                      className="w-20"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Status</label>
                  <select
                    value={autoData.status}
                    onChange={(e) => setAutoData({ ...autoData, status: e.target.value as any })}
                    className="w-full px-3 py-2 border rounded-lg dark:bg-gray-900 dark:border-gray-700"
                  >
                    <option value="available">Available</option>
                    <option value="reserved">Reserved</option>
                    <option value="maintenance">Maintenance</option>
                    <option value="archived">Archived</option>
                  </select>
                </div>
              </div>
              {/* Preview */}
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-50 dark:bg-blue-900/20 text-sm text-blue-700 dark:text-blue-300">
                <span>Preview:</span>
                <span className="font-semibold">{autoPreviewCount} bins</span>
                <span className="text-blue-500 dark:text-blue-400">
                  ({autoData.zones.split(',').filter(z => z.trim()).length} zone{autoData.zones.split(',').filter(z => z.trim()).length !== 1 ? 's' : ''}
                  {' '}× {Math.max(0, autoData.aisle_to - autoData.aisle_from + 1)} aisle{autoData.aisle_to - autoData.aisle_from + 1 !== 1 ? 's' : ''}
                  {' '}× {Math.max(0, autoData.shelf_to - autoData.shelf_from + 1)} shelf/shelves
                  {' '}× {Math.max(0, autoData.bin_to - autoData.bin_from + 1)} bin{autoData.bin_to - autoData.bin_from + 1 !== 1 ? 's' : ''})
                </span>
              </div>
              <div className="flex gap-2 justify-end">
                <Button onClick={resetForm} variant="secondary" size="sm">Cancel</Button>
                <Button type="button" size="sm" onClick={handleAutoCreate} disabled={autoPreviewCount === 0}>
                  Create {autoPreviewCount > 0 ? autoPreviewCount : ''} Bins
                </Button>
              </div>
            </div>
          )}

          {/* Custom Name Form */}
          {(editingId || createMode === 'custom') && (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Warehouse *</label>
                  <select
                    value={formData.warehouse_id}
                    onChange={(e) => setFormData({ ...formData, warehouse_id: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg dark:bg-gray-900 dark:border-gray-700"
                    required
                  >
                    <option value="">Select warehouse</option>
                    {warehouses.map(w => (
                      <option key={w.id} value={w.id}>{fmtWarehouse(w)}</option>
                    ))}
                  </select>
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium mb-1">Location Name</label>
                  <Input
                    value={formData.location_name}
                    onChange={(e) => setFormData({ ...formData, location_name: e.target.value })}
                    placeholder="e.g., Rack-1, Overflow Area, Cold Storage"
                  />
                  <p className="text-xs text-gray-400 mt-1">Free-form label. Required if Zone / Bin Number are not filled.</p>
                </div>
              </div>

              <div className="border-t dark:border-gray-800 pt-3">
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">Structured fields (optional)</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">Zone</label>
                    <Input
                      value={formData.zone}
                      onChange={(e) => setFormData({ ...formData, zone: e.target.value })}
                      placeholder="e.g., A"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Aisle</label>
                    <Input
                      value={formData.aisle}
                      onChange={(e) => setFormData({ ...formData, aisle: e.target.value })}
                      placeholder="e.g., 1"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Shelf</label>
                    <Input
                      value={formData.shelf}
                      onChange={(e) => setFormData({ ...formData, shelf: e.target.value })}
                      placeholder="e.g., 1"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Bin Number</label>
                    <Input
                      value={formData.bin_number}
                      onChange={(e) => setFormData({ ...formData, bin_number: e.target.value })}
                      placeholder="e.g., 01"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Capacity (units)</label>
                    <Input
                      type="number"
                      value={formData.capacity}
                      onChange={(e) => setFormData({ ...formData, capacity: e.target.value === '' ? '' : parseInt(e.target.value) })}
                      placeholder="e.g., 100"
                      min="1"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Status</label>
                    <select
                      value={formData.status}
                      onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                      className="w-full px-3 py-2 border rounded-lg dark:bg-gray-900 dark:border-gray-700"
                    >
                      <option value="available">Available</option>
                      <option value="reserved">Reserved</option>
                      <option value="maintenance">Maintenance</option>
                      <option value="archived">Archived</option>
                    </select>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Description</label>
                <Input
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Add notes or special instructions"
                />
              </div>
              <div className="flex gap-2 justify-end">
                <Button onClick={resetForm} variant="secondary" size="sm">
                  Cancel
                </Button>
                <Button type="submit" size="sm">
                  {editingId ? 'Update' : 'Create'} Bin
                </Button>
              </div>
            </form>
          )}
        </div>
      )}

      <BulkUploadModal
        isOpen={showBulkUpload}
        onClose={() => setShowBulkUpload(false)}
        entityType="bin_locations"
        onUpload={handleBulkUpload}
        defaultWarehouseId={selectedWarehouseId || ''}
      />

      {/* Bins Table */}
      <div className="bg-white dark:bg-gray-950 border dark:border-gray-800 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="border-b dark:border-gray-800 bg-gray-50 dark:bg-gray-900">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-semibold">Location</th>
                <th className="px-4 py-3 text-left text-sm font-semibold">Capacity</th>
                <th className="px-4 py-3 text-left text-sm font-semibold">Current</th>
                <th className="px-4 py-3 text-left text-sm font-semibold">Utilization</th>
                <th className="px-4 py-3 text-left text-sm font-semibold">Status</th>
                <th className="px-4 py-3 text-left text-sm font-semibold">Description</th>
                <th className="px-4 py-3 text-left text-sm font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                    Loading bin locations...
                  </td>
                </tr>
              ) : filteredBins.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                    No bin locations found
                  </td>
                </tr>
              ) : (
                filteredBins.map(bin => {
                  const utilization = bin.capacity ? Math.round((bin.current_quantity / bin.capacity) * 100) : 0;
                  const utilizationColor =
                    utilization >= 90 ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
                    utilization >= 70 ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' :
                    'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400';

                  return (
                    <tr key={bin.id} className="border-b dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-900">
                      <td className="px-4 py-3 text-sm font-medium">
                        {bin.location_name
                          ? bin.location_name
                          : `Z${bin.zone ?? ''}-A${bin.aisle ?? ''}-S${bin.shelf ?? ''}-B${bin.bin_number ?? ''}`}
                        {bin.location_name && (bin.zone || bin.bin_number) && (
                          <span className="ml-1 text-xs text-gray-400 font-normal">
                            (Z{bin.zone ?? ''}-A{bin.aisle ?? ''}-S{bin.shelf ?? ''}-B{bin.bin_number ?? ''})
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm">{bin.capacity ?? '—'}</td>
                      <td className="px-4 py-3 text-sm">{bin.current_quantity}</td>
                      <td className="px-4 py-3 text-sm">
                        <div className="flex items-center gap-2">
                          <div className="w-16 bg-gray-200 dark:bg-gray-800 rounded-full h-2">
                            <div
                              className="bg-blue-500 h-2 rounded-full transition-all"
                              style={{ width: `${utilization}%` }}
                            />
                          </div>
                          <span className={`text-xs px-2 py-1 rounded ${utilizationColor}`}>
                            {utilization}%
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${
                          bin.status === 'available' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                          bin.status === 'reserved' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' :
                          bin.status === 'maintenance' ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' :
                          'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400'
                        }`}>
                          {bin.status.charAt(0).toUpperCase() + bin.status.slice(1)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                        {bin.description}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleEdit(bin)}
                            className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(bin.id)}
                            className="p-1 hover:bg-red-100 dark:hover:bg-red-900/30 text-red-600 dark:text-red-400 rounded"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
