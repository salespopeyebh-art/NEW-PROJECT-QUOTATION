import React, { useMemo, useState } from 'react';
import {
  Building2,
  FileText,
  Mail,
  Pencil,
  Phone,
  Plus,
  Receipt,
  Search,
  Smartphone,
  Trash2,
  User,
  X,
} from 'lucide-react';
import { CustomerInfo, DocumentRecord, DocumentType, SavedCustomer } from '../types';

interface CustomersViewProps {
  customers: SavedCustomer[];
  documents: DocumentRecord[];
  onSaveCustomer: (customer: Omit<SavedCustomer, 'createdAt' | 'updatedAt'>) => void;
  onDeleteCustomer: (id: string) => void;
  onCreateDocumentForCustomer: (customer: CustomerInfo, type: DocumentType) => void;
}

const EMPTY_FORM = {
  id: '',
  company: '',
  attentionTo: '',
  mobile: '',
  telephone: '',
  email: '',
};

export const CustomersView: React.FC<CustomersViewProps> = ({
  customers,
  documents,
  onSaveCustomer,
  onDeleteCustomer,
  onCreateDocumentForCustomer,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formState, setFormState] = useState(EMPTY_FORM);
  const [formError, setFormError] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<SavedCustomer | null>(null);

  const filteredCustomers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const list = [...customers].sort((a, b) => a.company.localeCompare(b.company));
    if (!q) return list;
    return list.filter(
      (c) =>
        c.company.toLowerCase().includes(q) ||
        c.attentionTo.toLowerCase().includes(q) ||
        c.mobile.toLowerCase().includes(q) ||
        c.email.toLowerCase().includes(q)
    );
  }, [customers, searchQuery]);

  const docCountByCompany = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const d of documents) {
      const key = d.customer.company.trim().toLowerCase();
      if (key) counts[key] = (counts[key] || 0) + 1;
    }
    return counts;
  }, [documents]);

  const openAddModal = () => {
    setFormState({
      ...EMPTY_FORM,
      id: crypto.randomUUID ? crypto.randomUUID() : `cust-${Date.now()}`,
    });
    setFormError('');
    setIsModalOpen(true);
  };

  const openEditModal = (cust: SavedCustomer) => {
    setFormState({
      id: cust.id,
      company: cust.company,
      attentionTo: cust.attentionTo,
      mobile: cust.mobile,
      telephone: cust.telephone,
      email: cust.email,
    });
    setFormError('');
    setIsModalOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formState.company.trim()) {
      setFormError('Company name is required.');
      return;
    }
    onSaveCustomer({
      id: formState.id,
      company: formState.company.trim(),
      attentionTo: formState.attentionTo.trim(),
      mobile: formState.mobile.trim(),
      telephone: formState.telephone.trim(),
      email: formState.email.trim(),
    });
    setIsModalOpen(false);
  };

  return (
    <div className="space-y-6">
      {/* Header Row */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#1A1A2E] tracking-tight">Customer Directory</h1>
          <p className="text-sm text-slate-600 mt-1">
            Save regular companies and contacts for instant auto-fill on new quotations and invoices.
          </p>
        </div>

        <button
          type="button"
          onClick={openAddModal}
          className="inline-flex items-center justify-center gap-2 px-5 py-3 min-h-[44px] rounded-xl bg-[#1565C0] text-white font-semibold text-sm hover:bg-[#1254A1] transition-colors shadow-xs whitespace-nowrap shrink-0 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          Add Customer
        </button>
      </div>

      {/* Search Bar */}
      <div className="bg-white border border-slate-200 rounded-xl p-4">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by company name, contact person, mobile, or email..."
            className="w-full pl-10 pr-4 py-2.5 min-h-[44px] bg-slate-50 border border-slate-200 rounded-lg text-sm text-[#1A1A2E] focus:outline-none focus:ring-2 focus:ring-[#1565C0]/25 focus:border-[#1565C0]"
          />
        </div>
      </div>

      {/* Customers List */}
      {filteredCustomers.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-10 text-center">
          <Building2 className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <h3 className="text-base font-semibold text-[#1A1A2E]">
            {customers.length === 0 ? 'No customers saved yet' : 'No matching customers'}
          </h3>
          <p className="text-sm text-slate-500 mt-1 max-w-md mx-auto">
            {customers.length === 0
              ? 'Add your first customer here, or they will be remembered automatically when you save a quotation or invoice.'
              : 'Try a different search keyword.'}
          </p>
          {customers.length === 0 && (
            <button
              type="button"
              onClick={openAddModal}
              className="mt-5 inline-flex items-center gap-2 px-5 py-2.5 min-h-[44px] rounded-xl bg-[#1565C0] text-white text-sm font-semibold hover:bg-[#1254A1] transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              Add First Customer
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredCustomers.map((cust) => {
            const count = docCountByCompany[cust.company.trim().toLowerCase()] || 0;
            return (
              <div
                key={cust.id}
                className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col justify-between gap-4 hover:border-slate-300 transition-colors"
              >
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="text-base font-bold text-[#1A1A2E] truncate">
                        {cust.company}
                      </h3>
                      <div className="text-xs text-slate-500 mt-0.5 flex items-center gap-1.5">
                        <span className="tabular-nums">{count} {count === 1 ? 'document' : 'documents'}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => openEditModal(cust)}
                        title="Edit customer"
                        aria-label={`Edit ${cust.company}`}
                        className="p-2 rounded-lg text-slate-500 hover:text-[#1565C0] hover:bg-slate-100 transition-colors cursor-pointer"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleteTarget(cust)}
                        title="Delete customer"
                        aria-label={`Delete ${cust.company}`}
                        className="p-2 rounded-lg text-slate-500 hover:text-[#FF5722] hover:bg-orange-50 transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <div className="mt-4 space-y-2 text-sm text-slate-700">
                    <div className="flex items-center gap-2.5">
                      <User className="w-4 h-4 text-slate-400 shrink-0" />
                      <span className="truncate">{cust.attentionTo || 'No contact person'}</span>
                    </div>
                    <div className="flex items-center gap-2.5">
                      <Smartphone className="w-4 h-4 text-slate-400 shrink-0" />
                      <span className="font-mono-num text-xs">{cust.mobile || 'No mobile'}</span>
                    </div>
                    {cust.telephone && (
                      <div className="flex items-center gap-2.5">
                        <Phone className="w-4 h-4 text-slate-400 shrink-0" />
                        <span className="font-mono-num text-xs">{cust.telephone}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-2.5">
                      <Mail className="w-4 h-4 text-slate-400 shrink-0" />
                      <span className="truncate text-xs">{cust.email || 'No email'}</span>
                    </div>
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-100 grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => onCreateDocumentForCustomer(cust, 'quotation')}
                    className="inline-flex items-center justify-center gap-1.5 px-3 py-2 min-h-[40px] rounded-lg border border-[#1565C0]/30 text-[#1565C0] bg-[#1565C0]/5 hover:bg-[#1565C0]/10 text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer"
                  >
                    <FileText className="w-3.5 h-3.5" />
                    New Quotation
                  </button>
                  <button
                    type="button"
                    onClick={() => onCreateDocumentForCustomer(cust, 'invoice')}
                    className="inline-flex items-center justify-center gap-1.5 px-3 py-2 min-h-[40px] rounded-lg border border-[#FF5722]/30 text-[#FF5722] bg-[#FF5722]/5 hover:bg-[#FF5722]/10 text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer"
                  >
                    <Receipt className="w-3.5 h-3.5" />
                    New Invoice
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add / Edit Customer Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-[#1A1A2E]/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 w-full max-w-lg p-6 shadow-xl">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-[#1A1A2E]">
                {customers.some((c) => c.id === formState.id) ? 'Edit Customer' : 'Add New Customer'}
              </h2>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-2 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {formError && (
                <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700 font-medium">
                  {formError}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Company Name *
                </label>
                <input
                  type="text"
                  value={formState.company}
                  onChange={(e) => setFormState({ ...formState, company: e.target.value })}
                  placeholder="e.g. Gulf Horizon Trading Co. W.L.L"
                  className="w-full px-3.5 py-2.5 min-h-[44px] border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1565C0]/25 focus:border-[#1565C0]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Attention to (Contact Person)
                </label>
                <input
                  type="text"
                  value={formState.attentionTo}
                  onChange={(e) => setFormState({ ...formState, attentionTo: e.target.value })}
                  placeholder="e.g. Mr. Ahmed Al Khalifa"
                  className="w-full px-3.5 py-2.5 min-h-[44px] border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1565C0]/25 focus:border-[#1565C0]"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Mobile
                  </label>
                  <input
                    type="text"
                    value={formState.mobile}
                    onChange={(e) => setFormState({ ...formState, mobile: e.target.value })}
                    placeholder="e.g. 33123456"
                    className="w-full px-3.5 py-2.5 min-h-[44px] border border-slate-200 rounded-lg text-sm font-mono-num focus:outline-none focus:ring-2 focus:ring-[#1565C0]/25 focus:border-[#1565C0]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Telephone (Optional)
                  </label>
                  <input
                    type="text"
                    value={formState.telephone}
                    onChange={(e) => setFormState({ ...formState, telephone: e.target.value })}
                    placeholder="e.g. 17123456"
                    className="w-full px-3.5 py-2.5 min-h-[44px] border border-slate-200 rounded-lg text-sm font-mono-num focus:outline-none focus:ring-2 focus:ring-[#1565C0]/25 focus:border-[#1565C0]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Email
                </label>
                <input
                  type="email"
                  value={formState.email}
                  onChange={(e) => setFormState({ ...formState, email: e.target.value })}
                  placeholder="e.g. purchasing@company.bh"
                  className="w-full px-3.5 py-2.5 min-h-[44px] border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1565C0]/25 focus:border-[#1565C0]"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2.5 min-h-[44px] rounded-xl border border-slate-200 text-sm font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 min-h-[44px] rounded-xl bg-[#4CAF50] text-white text-sm font-semibold hover:bg-[#43A047] transition-colors cursor-pointer"
                >
                  Save Customer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 bg-[#1A1A2E]/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 w-full max-w-md p-6 shadow-xl">
            <h3 className="text-lg font-bold text-[#1A1A2E]">Delete Customer?</h3>
            <p className="text-sm text-slate-600 mt-2">
              Are you sure you want to delete <strong>{deleteTarget.company}</strong>? Saved quotations and invoices for this customer will remain in History.
            </p>
            <div className="flex items-center justify-end gap-3 mt-6">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="px-4 py-2.5 min-h-[44px] rounded-xl border border-slate-200 text-sm font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  onDeleteCustomer(deleteTarget.id);
                  setDeleteTarget(null);
                }}
                className="px-5 py-2.5 min-h-[44px] rounded-xl bg-[#FF5722] text-white text-sm font-semibold hover:bg-[#E64A19] transition-colors cursor-pointer"
              >
                Delete Customer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
