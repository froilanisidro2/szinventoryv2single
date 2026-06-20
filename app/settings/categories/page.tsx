'use client';

import { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { 
  getProductCategories, 
  createProductCategory, 
  updateProductCategory, 
  deleteProductCategory,
  getUnitOfMeasurements,
  createUnitOfMeasurement,
  updateUnitOfMeasurement,
  deleteUnitOfMeasurement,
  getProductTypes,
  createProductType,
  updateProductType,
  deleteProductType,
  getWarrantyTypes,
  createWarrantyType,
  updateWarrantyType,
  deleteWarrantyType,
  getBrands,
  createBrand,
  updateBrand,
  deleteBrand,
  getHandlingInstructions,
  createHandlingInstruction,
  updateHandlingInstruction,
  deleteHandlingInstruction,
} from '@/app/actions';

type TabType = 'categories' | 'units' | 'types' | 'warranties' | 'brands' | 'handling';

export default function ProductPropertiesPage() {
  const [activeTab, setActiveTab] = useState<TabType>('categories');
  const [categories, setCategories] = useState<any[]>([]);
  const [units, setUnits] = useState<any[]>([]);
  const [types, setTypes] = useState<any[]>([]);
  const [warranties, setWarranties] = useState<any[]>([]);
  const [brands, setBrands] = useState<any[]>([]);
  const [handling, setHandling] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    sort_order: 0,
    abbreviation: '',
    duration_months: 0,
    days_min: 0,
    days_max: 0,
    symbol_code: '',
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setIsLoading(true);
      const [catResult, unitResult, typeResult, warResult, brandResult, handResult] = await Promise.all([
        getProductCategories(),
        getUnitOfMeasurements(),
        getProductTypes(),
        getWarrantyTypes(),
        getBrands(),
        getHandlingInstructions(),
      ]);
      
      if (catResult && !catResult.error && Array.isArray(catResult.data)) setCategories(catResult.data);
      if (unitResult && !unitResult.error && Array.isArray(unitResult.data)) setUnits(unitResult.data);
      if (typeResult && !typeResult.error && Array.isArray(typeResult.data)) setTypes(typeResult.data);
      if (warResult && !warResult.error && Array.isArray(warResult.data)) setWarranties(warResult.data);
      if (brandResult && !brandResult.error && Array.isArray(brandResult.data)) setBrands(brandResult.data);
      if (handResult && !handResult.error && Array.isArray(handResult.data)) setHandling(handResult.data);
    } catch (error) {
      console.error('Error loading data:', error);
      toast.error('Failed to load data');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      toast.error('Name is required');
      return;
    }

    try {
      let dataToSubmit: any = { name: formData.name, description: formData.description };

      if (activeTab === 'categories') {
        dataToSubmit = { ...dataToSubmit, sort_order: formData.sort_order };
      } else if (activeTab === 'units') {
        dataToSubmit = { ...dataToSubmit, abbreviation: formData.abbreviation };
      } else if (activeTab === 'types') {
        dataToSubmit = { ...dataToSubmit, sort_order: formData.sort_order };
      } else if (activeTab === 'warranties') {
        dataToSubmit = { ...dataToSubmit, duration_months: formData.duration_months };
      } else if (activeTab === 'brands') {
        dataToSubmit = { ...dataToSubmit, sort_order: formData.sort_order };
      } else if (activeTab === 'handling') {
        dataToSubmit = { ...dataToSubmit, symbol_code: formData.symbol_code, sort_order: formData.sort_order };
      }

      let result;
      if (activeTab === 'categories') {
        result = editingId
          ? await updateProductCategory(editingId, dataToSubmit)
          : await createProductCategory(dataToSubmit);
      } else if (activeTab === 'units') {
        result = editingId
          ? await updateUnitOfMeasurement(editingId, dataToSubmit)
          : await createUnitOfMeasurement(dataToSubmit);
      } else if (activeTab === 'types') {
        result = editingId
          ? await updateProductType(editingId, dataToSubmit)
          : await createProductType(dataToSubmit);
      } else if (activeTab === 'warranties') {
        result = editingId
          ? await updateWarrantyType(editingId, dataToSubmit)
          : await createWarrantyType(dataToSubmit);
      } else if (activeTab === 'brands') {
        result = editingId
          ? await updateBrand(editingId, dataToSubmit)
          : await createBrand(dataToSubmit);
      } else if (activeTab === 'handling') {
        result = editingId
          ? await updateHandlingInstruction(editingId, dataToSubmit)
          : await createHandlingInstruction(dataToSubmit);
      }

      if (result?.error) {
        toast.error(`Failed to ${editingId ? 'update' : 'create'}`);
        return;
      }
      toast.success(`${editingId ? 'Updated' : 'Created'} successfully`);
      resetForm();
      loadData();
    } catch (error) {
      toast.error('An error occurred');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure?')) return;
    try {
      let result;
      if (activeTab === 'categories') result = await deleteProductCategory(id);
      else if (activeTab === 'units') result = await deleteUnitOfMeasurement(id);
      else if (activeTab === 'types') result = await deleteProductType(id);
      else if (activeTab === 'warranties') result = await deleteWarrantyType(id);
      else if (activeTab === 'brands') result = await deleteBrand(id);
      else if (activeTab === 'handling') result = await deleteHandlingInstruction(id);

      if (result?.error) {
        toast.error('Failed to delete');
        return;
      }
      toast.success('Deleted successfully');
      loadData();
    } catch (error) {
      toast.error('An error occurred');
    }
  };

  const handleEdit = (item: any) => {
    setFormData({
      name: item.name,
      description: item.description || '',
      sort_order: item.sort_order || 0,
      abbreviation: item.abbreviation || '',
      duration_months: item.duration_months || 0,
      days_min: item.days_min || 0,
      days_max: item.days_max || 0,
      symbol_code: item.symbol_code || '',
    });
    setEditingId(item.id);
    setShowForm(true);
  };

  const resetForm = () => {
    setFormData({ name: '', description: '', sort_order: 0, abbreviation: '', duration_months: 0, days_min: 0, days_max: 0, symbol_code: '' });
    setEditingId(null);
    setShowForm(false);
  };

  const getCurrentItems = () => {
    if (activeTab === 'categories') return categories;
    if (activeTab === 'units') return units;
    if (activeTab === 'types') return types;
    if (activeTab === 'warranties') return warranties;
    if (activeTab === 'brands') return brands;
    if (activeTab === 'handling') return handling;
    return [];
  };

  const currentItems = getCurrentItems();

  const tabLabels: Record<TabType, string> = {
    categories: 'Categories',
    units: 'Units',
    types: 'Product Types',
    warranties: 'Warranties',
    brands: 'Brands',
    handling: 'Handling',
  };

  return (
    <div className="space-y-6 p-4 md:p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          
            <Button href="/settings" variant="secondary" size="sm">
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Product Properties</h1>
            <p className="text-gray-600 dark:text-gray-400">Manage product reference data and classifications</p>
          </div>
        </div>
        <Button onClick={() => setShowForm(!showForm)}>
          <Plus className="h-4 w-4 mr-2" />
          {showForm ? 'Cancel' : 'Add'}
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-1 border-b border-gray-200 dark:border-gray-700">
        {(['categories', 'units', 'types', 'warranties', 'brands', 'handling'] as TabType[]).map((tab) => (
          <button
            key={tab}
            onClick={() => {
              setActiveTab(tab);
              resetForm();
            }}
            className={`px-4 py-2 font-medium border-b-2 transition-colors text-sm whitespace-nowrap ${
              activeTab === tab
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-300'
            }`}
          >
            {tabLabels[tab]}
          </button>
        ))}
      </div>

      {/* Form */}
      {showForm && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
          <h2 className="text-lg font-semibold mb-4">
            {editingId ? `Edit` : `Add New`} {tabLabels[activeTab]}
          </h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Name *</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
                required
              />
            </div>

            {(activeTab === 'units' || activeTab === 'handling') && (
              <div>
                <label className="block text-sm font-medium mb-1">
                  {activeTab === 'units' ? 'Abbreviation' : 'Symbol Code'}
                </label>
                <input
                  type="text"
                  value={activeTab === 'units' ? formData.abbreviation : formData.symbol_code}
                  onChange={(e) => activeTab === 'units' 
                    ? setFormData({ ...formData, abbreviation: e.target.value })
                    : setFormData({ ...formData, symbol_code: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
                  placeholder={activeTab === 'units' ? 'e.g., kg, pcs' : 'e.g., GRV (Fragile)'}
                />
              </div>
            )}

            {activeTab === 'warranties' && (
              <div>
                <label className="block text-sm font-medium mb-1">Duration (Months) *</label>
                <input
                  type="number"
                  value={formData.duration_months}
                  onChange={(e) => setFormData({ ...formData, duration_months: parseInt(e.target.value) })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
                  required
                />
              </div>
            )}

            <div>
              <label className="block text-sm font-medium mb-1">Description</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
                rows={3}
                placeholder="Optional description"
              />
            </div>

            {(activeTab === 'categories' || activeTab === 'types' || activeTab === 'brands' || activeTab === 'handling') && (
              <div>
                <label className="block text-sm font-medium mb-1">Sort Order</label>
                <input
                  type="number"
                  value={formData.sort_order}
                  onChange={(e) => setFormData({ ...formData, sort_order: parseInt(e.target.value) })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
                />
              </div>
            )}

            <div className="flex gap-2">
              <Button type="submit" variant="primary">
                {editingId ? 'Update' : 'Create'}
              </Button>
              <Button type="button" variant="secondary" onClick={resetForm}>
                Cancel
              </Button>
            </div>
          </form>
        </div>
      )}

      {/* Table */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center">Loading...</div>
        ) : currentItems.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            No items found
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-700">
                <tr>
                  <th className="px-6 py-3 text-left text-sm font-semibold">Name</th>
                  {activeTab === 'units' && <th className="px-6 py-3 text-left text-sm font-semibold">Abbreviation</th>}
                  {activeTab === 'warranties' && <th className="px-6 py-3 text-left text-sm font-semibold">Duration (Months)</th>}
                  {activeTab === 'handling' && <th className="px-6 py-3 text-left text-sm font-semibold">Symbol</th>}
                  <th className="px-6 py-3 text-left text-sm font-semibold">Description</th>
                  {(activeTab === 'categories' || activeTab === 'types' || activeTab === 'brands' || activeTab === 'handling') && (
                    <th className="px-6 py-3 text-left text-sm font-semibold">Sort Order</th>
                  )}
                  <th className="px-6 py-3 text-right text-sm font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {currentItems.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                    <td className="px-6 py-4 text-sm font-medium">{item.name}</td>
                    {activeTab === 'units' && (
                      <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">{item.abbreviation || '-'}</td>
                    )}
                    {activeTab === 'warranties' && (
                      <td className="px-6 py-4 text-sm">{item.duration_months} months</td>
                    )}
                    {activeTab === 'handling' && (
                      <td className="px-6 py-4 text-sm">{item.symbol_code || '-'}</td>
                    )}
                    <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">{item.description || '-'}</td>
                    {(activeTab === 'categories' || activeTab === 'types' || activeTab === 'brands' || activeTab === 'handling') && (
                      <td className="px-6 py-4 text-sm">{item.sort_order || 0}</td>
                    )}
                    <td className="px-6 py-4 text-right space-x-2">
                      <button
                        onClick={() => handleEdit(item)}
                        className="inline-flex items-center gap-1 px-2 py-1 text-sm text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded"
                      >
                        <Edit2 className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(item.id)}
                        className="inline-flex items-center gap-1 px-2 py-1 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
