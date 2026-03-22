import React, { useState, useEffect } from 'react';
import { useAuth } from "../../hooks/userAuth";
import { apiFetch } from "../../utils/api";
import { 
  PlusIcon, 
  ChartBarIcon, 
  BeakerIcon, 
  ShieldCheckIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  XMarkIcon,
  TrashIcon
} from '@heroicons/react/24/outline';
import Spinner from '../../components/Spinner';

const Scoring = () => {
  const { profile } = useAuth();
  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  
  const [formData, setFormData] = useState({
    rule_name: '',
    field: 'repayment_rate',
    operator: '>',
    value: '',
    score_impact: '',
    is_active: true
  });

  useEffect(() => {
    if (profile?.tenant_id) {
      fetchRules();
    }
  }, [profile]);

  const fetchRules = async () => {
    try {
      const res = await apiFetch(`/api/scoring/rules?tenant_id=${profile.tenant_id}`);
      const data = await res.json();
      if (data.success) {
        setRules(data.data);
      }
    } catch (err) {
      console.error("Error fetching rules:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateRule = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await apiFetch('/api/scoring/rules', {
        method: 'POST',
        body: JSON.stringify({
          rule_name: formData.rule_name,
          rule_type: formData.score_impact >= 0 ? 'positive' : 'negative',
          condition: {
            field: formData.field,
            operator: formData.operator,
            value: Number(formData.value)
          },
          score_impact: Number(formData.score_impact),
          is_active: formData.is_active
        })
      });
      const data = await res.json();
      if (data.success) {
        setRules([data.data, ...rules]);
        setIsModalOpen(false);
        setFormData({
          rule_name: '',
          field: 'repayment_rate',
          operator: '>',
          value: '',
          score_impact: '',
          is_active: true
        });
      }
    } catch (err) {
      console.error("Error creating rule:", err);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div className="flex justify-center p-12"><Spinner /></div>;

  return (
    <div className="p-8 space-y-6">
      {/* Scoring Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
            <ChartBarIcon className="w-8 h-8" />
          </div>
          <div>
            <p className="text-sm text-gray-500 font-medium">Active Rules</p>
            <p className="text-2xl font-bold text-gray-900">{rules.filter(r => r.is_active).length}</p>
          </div>
        </div>
        
        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-green-50 text-green-600 rounded-xl">
            <ShieldCheckIcon className="w-8 h-8" />
          </div>
          <div>
            <p className="text-sm text-gray-500 font-medium">Average Score</p>
            <p className="text-2xl font-bold text-gray-900">712</p>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-purple-50 text-purple-600 rounded-xl">
            <BeakerIcon className="w-8 h-8" />
          </div>
          <div>
            <p className="text-sm text-gray-500 font-medium">Calculation Model</p>
            <p className="text-2xl font-bold text-gray-900">V1 Dynamic</p>
          </div>
        </div>
      </div>

      {/* Rules Section */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-50 flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-900">Scoring Rules</h2>
          <button 
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-2 bg-brand-primary text-white px-4 py-2 rounded-xl hover:bg-brand-primary/90 transition-all font-semibold text-sm shadow-sm"
          >
            <PlusIcon className="w-5 h-5" />
            Add Rule
          </button>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-gray-50 text-gray-500 text-xs font-bold uppercase tracking-wider">
              <tr>
                <th className="px-6 py-3">Rule Name</th>
                <th className="px-6 py-3">Condition</th>
                <th className="px-6 py-3">Impact</th>
                <th className="px-6 py-3">Status</th>
                <th className="px-6 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {rules.map((rule) => (
                <tr key={rule.id} className="hover:bg-gray-50/50 transition-colors">
                  <td className="px-6 py-4">
                    <p className="font-semibold text-gray-900">{rule.rule_name}</p>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm text-gray-600 font-mono bg-gray-100 px-2 py-1 rounded">
                      {rule.condition.field} {rule.condition.operator} {rule.condition.value}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`font-bold ${rule.score_impact >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {rule.score_impact >= 0 ? '+' : ''}{rule.score_impact}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 rounded-full text-xs font-bold ${
                      rule.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                    }`}>
                      {rule.is_active ? 'ACTIVE' : 'INACTIVE'}
                    </span>
                  </td>
                  <td className="px-6 py-4 flex items-center gap-3">
                    <button className="text-gray-400 hover:text-brand-primary"><TrashIcon className="w-5 h-5" /></button>
                  </td>
                </tr>
              ))}
              {rules.length === 0 && (
                <tr>
                  <td colSpan="5" className="px-6 py-12 text-center text-gray-500">
                    No scoring rules defined yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Rule Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <h2 className="text-lg font-bold">New Scoring Rule</h2>
              <button onClick={() => setIsModalOpen(false)}><XMarkIcon className="w-6 h-6 text-gray-400" /></button>
            </div>
            <form onSubmit={handleCreateRule} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Rule Name</label>
                <input 
                  type="text"
                  required
                  value={formData.rule_name}
                  onChange={e => setFormData({...formData, rule_name: e.target.value})}
                  className="w-full px-4 py-2 rounded-xl border-gray-200 focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20 outline-none transition-all"
                  placeholder="e.g. High Completion Rate"
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Field</label>
                  <select 
                    value={formData.field}
                    onChange={e => setFormData({...formData, field: e.target.value})}
                    className="w-full px-4 py-2 rounded-xl border-gray-200 outline-none"
                  >
                    <option value="repayment_rate">Repayment Rate %</option>
                    <option value="missed_payments">Missed Payments</option>
                    <option value="totalLoans">Total Loans</option>
                    <option value="completionRate">Completion Rate %</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Operator</label>
                  <select 
                    value={formData.operator}
                    onChange={e => setFormData({...formData, operator: e.target.value})}
                    className="w-full px-4 py-2 rounded-xl border-gray-200 outline-none"
                  >
                    <option value=">">Greater than</option>
                    <option value="<">Less than</option>
                    <option value=">=">Greater or equal</option>
                    <option value="<=">Less or equal</option>
                    <option value="==">Equals</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Threshold Value</label>
                  <input 
                    type="number"
                    required
                    value={formData.value}
                    onChange={e => setFormData({...formData, value: e.target.value})}
                    className="w-full px-4 py-2 rounded-xl border-gray-200 focus:border-brand-primary outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Score Impact</label>
                  <input 
                    type="number"
                    required
                    value={formData.score_impact}
                    onChange={e => setFormData({...formData, score_impact: e.target.value})}
                    className="w-full px-4 py-2 rounded-xl border-gray-200 focus:border-brand-primary outline-none"
                    placeholder="+/- Points"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <button 
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-6 py-2 rounded-xl border border-gray-200 font-semibold hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  disabled={submitting}
                  className="bg-brand-primary text-white px-6 py-2 rounded-xl font-bold hover:bg-brand-primary/90 transition-all flex items-center gap-2"
                >
                  {submitting && <Spinner size="sm" />}
                  Create Rule
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Scoring;
