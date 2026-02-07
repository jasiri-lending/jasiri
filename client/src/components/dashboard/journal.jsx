Now, Let Me Design the UI Components for React/Tailwind
Here's a comprehensive UI design for your accounting system:

A. Manual Journal Entry Component (JournalEntryForm.jsx)
jsx
import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { Plus, Trash2, Save, Check, X } from 'lucide-react';

const JournalEntryForm = ({ tenantId, onSuccess }) => {
  const [entryLines, setEntryLines] = useState([
    { id: 1, accountId: '', lineType: 'debit', amount: '', description: '' },
    { id: 2, accountId: '', lineType: 'credit', amount: '', description: '' }
  ]);
  const [accounts, setAccounts] = useState([]);
  const [totalDebit, setTotalDebit] = useState(0);
  const [totalCredit, setTotalCredit] = useState(0);
  const [isBalanced, setIsBalanced] = useState(false);

  const { register, handleSubmit, watch, formState: { errors } } = useForm();

  // Fetch accounts on mount
  useEffect(() => {
    fetchAccounts();
  }, []);

  // Calculate totals when entryLines change
  useEffect(() => {
    const debitTotal = entryLines
      .filter(line => line.lineType === 'debit')
      .reduce((sum, line) => sum + (parseFloat(line.amount) || 0), 0);
    
    const creditTotal = entryLines
      .filter(line => line.lineType === 'credit')
      .reduce((sum, line) => sum + (parseFloat(line.amount) || 0), 0);
    
    setTotalDebit(debitTotal);
    setTotalCredit(creditTotal);
    setIsBalanced(Math.abs(debitTotal - creditTotal) < 0.01);
  }, [entryLines]);

  const fetchAccounts = async () => {
    try {
      const response = await fetch(`/api/accounts?tenantId=${tenantId}`);
      const data = await response.json();
      setAccounts(data);
    } catch (error) {
      console.error('Error fetching accounts:', error);
    }
  };

  const addEntryLine = () => {
    const newId = entryLines.length > 0 ? Math.max(...entryLines.map(l => l.id)) + 1 : 1;
    setEntryLines([
      ...entryLines,
      { id: newId, accountId: '', lineType: 'debit', amount: '', description: '' }
    ]);
  };

  const removeEntryLine = (id) => {
    if (entryLines.length > 2) {
      setEntryLines(entryLines.filter(line => line.id !== id));
    }
  };

  const updateEntryLine = (id, field, value) => {
    setEntryLines(entryLines.map(line => 
      line.id === id ? { ...line, [field]: value } : line
    ));
  };

  const onSubmit = async (data) => {
    if (!isBalanced) {
      alert('Journal entry must balance! Debits must equal Credits.');
      return;
    }

    const payload = {
      ...data,
      tenantId,
      entryLines: entryLines.map(line => ({
        accountId: line.accountId,
        lineType: line.lineType,
        amount: parseFloat(line.amount),
        description: line.description
      }))
    };

    try {
      const response = await fetch('/api/journal-entries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        const result = await response.json();
        onSuccess(result);
        alert('Journal entry saved successfully!');
      } else {
        throw new Error('Failed to save journal entry');
      }
    } catch (error) {
      console.error('Error:', error);
      alert('Error saving journal entry');
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <h2 className="text-2xl font-bold text-gray-800 mb-6">Create Journal Entry</h2>
      
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Header Information */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Entry Date *
            </label>
            <input
              type="date"
              {...register('entryDate', { required: true })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Entry Number *
            </label>
            <input
              type="text"
              {...register('entryNumber', { required: true })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="JE-2024-001"
            />
          </div>
          
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description *
            </label>
            <input
              type="text"
              {...register('description', { required: true })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Enter transaction description"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Transaction Type *
            </label>
            <select
              {...register('transactionType', { required: true })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select type</option>
              <option value="expense">Expense</option>
              <option value="income">Income</option>
              <option value="liability">Liability</option>
              <option value="equity">Equity</option>
              <option value="asset">Asset</option>
              <option value="transfer">Transfer</option>
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Notes
            </label>
            <textarea
              {...register('notes')}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              rows="2"
              placeholder="Additional notes..."
            />
          </div>
        </div>

        {/* Entry Lines */}
        <div className="border-t border-gray-200 pt-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold text-gray-700">Entry Lines</h3>
            <button
              type="button"
              onClick={addEntryLine}
              className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Line
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Account</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Amount</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Description</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {entryLines.map((line) => (
                  <tr key={line.id}>
                    <td className="px-4 py-3">
                      <select
                        value={line.lineType}
                        onChange={(e) => updateEntryLine(line.id, 'lineType', e.target.value)}
                        className="w-full px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                      >
                        <option value="debit">Debit</option>
                        <option value="credit">Credit</option>
                      </select>
                    </td>
                    <td className="px-4 py-3">
                      <select
                        value={line.accountId}
                        onChange={(e) => updateEntryLine(line.id, 'accountId', e.target.value)}
                        className="w-full px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                      >
                        <option value="">Select Account</option>
                        {accounts.map(account => (
                          <option key={account.id} value={account.id}>
                            {account.code} - {account.account_name} ({account.account_type})
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-3">
                      <input
                        type="number"
                        step="0.01"
                        value={line.amount}
                        onChange={(e) => updateEntryLine(line.id, 'amount', e.target.value)}
                        className="w-full px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                        placeholder="0.00"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <input
                        type="text"
                        value={line.description}
                        onChange={(e) => updateEntryLine(line.id, 'description', e.target.value)}
                        className="w-full px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                        placeholder="Line description"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => removeEntryLine(line.id)}
                        className="p-1 text-red-600 hover:text-red-800"
                        disabled={entryLines.length <= 2}
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Totals */}
          <div className="mt-6 flex justify-end space-x-8">
            <div className="text-right">
              <div className="text-sm text-gray-500">Total Debit</div>
              <div className="text-lg font-semibold text-gray-800">
                {totalDebit.toLocaleString('en-KE', { style: 'currency', currency: 'KES' })}
              </div>
            </div>
            <div className="text-right">
              <div className="text-sm text-gray-500">Total Credit</div>
              <div className="text-lg font-semibold text-gray-800">
                {totalCredit.toLocaleString('en-KE', { style: 'currency', currency: 'KES' })}
              </div>
            </div>
            <div className="text-right">
              <div className="text-sm text-gray-500">Balance</div>
              <div className={`text-lg font-semibold ${isBalanced ? 'text-green-600' : 'text-red-600'}`}>
                {Math.abs(totalDebit - totalCredit).toLocaleString('en-KE', { style: 'currency', currency: 'KES' })}
                <span className="ml-2">
                  {isBalanced ? <Check className="inline w-5 h-5" /> : <X className="inline w-5 h-5" />}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Form Actions */}
        <div className="flex justify-end space-x-4 pt-6 border-t border-gray-200">
          <button
            type="button"
            className="px-6 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
            onClick={() => window.history.back()}
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!isBalanced}
            className={`px-6 py-2 rounded-md flex items-center ${
              isBalanced 
                ? 'bg-green-600 text-white hover:bg-green-700' 
                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
            }`}
          >
            <Save className="w-4 h-4 mr-2" />
            Save Journal Entry
          </button>
        </div>
      </form>
    </div>
  );
};

export default JournalEntryForm;
B. Expense Claim Form (ExpenseClaimForm.jsx)
jsx
import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Upload, Receipt, DollarSign } from 'lucide-react';

const ExpenseClaimForm = ({ tenantId, userId, onSuccess }) => {
  const [receiptFile, setReceiptFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState('');
  
  const { register, handleSubmit, watch, formState: { errors } } = useForm();

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setReceiptFile(file);
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
    }
  };

  const onSubmit = async (data) => {
    const formData = new FormData();
    
    // Add form data
    Object.keys(data).forEach(key => {
      formData.append(key, data[key]);
    });
    
    formData.append('tenantId', tenantId);
    formData.append('createdBy', userId);
    
    // Add receipt file if exists
    if (receiptFile) {
      formData.append('receipt', receiptFile);
    }

    try {
      const response = await fetch('/api/expense-claims', {
        method: 'POST',
        body: formData,
      });

      if (response.ok) {
        const result = await response.json();
        onSuccess(result);
        alert('Expense claim submitted successfully!');
      } else {
        throw new Error('Failed to submit expense claim');
      }
    } catch (error) {
      console.error('Error:', error);
      alert('Error submitting expense claim');
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <h2 className="text-2xl font-bold text-gray-800 mb-6">New Expense Claim</h2>
      
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Basic Information */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Expense Date *
            </label>
            <input
              type="date"
              {...register('expenseDate', { required: true })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Category *
            </label>
            <select
              {...register('category', { required: true })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select Category</option>
              <option value="travel">Travel</option>
              <option value="office_supplies">Office Supplies</option>
              <option value="rent">Rent</option>
              <option value="utilities">Utilities</option>
              <option value="marketing">Marketing</option>
              <option value="other">Other</option>
            </select>
          </div>
          
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description *
            </label>
            <input
              type="text"
              {...register('description', { required: true })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Describe the expense"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Amount (KES) *
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <DollarSign className="h-5 w-5 text-gray-400" />
              </div>
              <input
                type="number"
                step="0.01"
                {...register('totalAmount', { required: true, min: 0.01 })}
                className="pl-10 w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="0.00"
              />
            </div>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Payment Method *
            </label>
            <select
              {...register('paymentMethod', { required: true })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select Method</option>
              <option value="cash">Cash</option>
              <option value="bank_transfer">Bank Transfer</option>
              <option value="mpesa">M-Pesa</option>
              <option value="cheque">Cheque</option>
              <option value="other">Other</option>
            </select>
          </div>
        </div>

        {/* Receipt Upload */}
        <div className="border-t border-gray-200 pt-6">
          <h3 className="text-lg font-semibold text-gray-700 mb-4">Receipt Attachment</h3>
          
          <div className="flex items-center justify-center w-full">
            <label className="flex flex-col items-center justify-center w-full h-64 border-2 border-gray-300 border-dashed rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100">
              {previewUrl ? (
                <div className="relative w-full h-full p-4">
                  <img
                    src={previewUrl}
                    alt="Receipt preview"
                    className="w-full h-full object-contain"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setReceiptFile(null);
                      setPreviewUrl('');
                    }}
                    className="absolute top-2 right-2 p-1 bg-red-600 text-white rounded-full hover:bg-red-700"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center pt-5 pb-6">
                  <Upload className="w-10 h-10 mb-3 text-gray-400" />
                  <p className="mb-2 text-sm text-gray-500">
                    <span className="font-semibold">Click to upload</span> or drag and drop
                  </p>
                  <p className="text-xs text-gray-500">PNG, JPG, PDF (MAX. 10MB)</p>
                </div>
              )}
              <input
                type="file"
                className="hidden"
                accept=".png,.jpg,.jpeg,.pdf"
                onChange={handleFileChange}
              />
            </label>
          </div>
          
          <div className="mt-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Notes
            </label>
            <textarea
              {...register('notes')}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              rows="3"
              placeholder="Additional information about this expense..."
            />
          </div>
        </div>

        {/* Form Actions */}
        <div className="flex justify-end space-x-4 pt-6 border-t border-gray-200">
          <button
            type="button"
            className="px-6 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
            onClick={() => window.history.back()}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center"
          >
            <Receipt className="w-4 h-4 mr-2" />
            Submit Expense Claim
          </button>
        </div>
      </form>
    </div>
  );
};

export default ExpenseClaimForm;
C. Payroll Processing Component (PayrollForm.jsx)
jsx
import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { Users, Calculator, Download } from 'lucide-react';

const PayrollForm = ({ tenantId, onSuccess }) => {
  const [employees, setEmployees] = useState([]);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [calculatedNet, setCalculatedNet] = useState(0);

  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm({
    defaultValues: {
      basicSalary: 0,
      allowances: 0,
      deductions: 0,
      netSalary: 0
    }
  });

  const basicSalary = watch('basicSalary');
  const allowances = watch('allowances');
  const deductions = watch('deductions');

  // Calculate net salary when amounts change
  useEffect(() => {
    const net = (parseFloat(basicSalary) || 0) + (parseFloat(allowances) || 0) - (parseFloat(deductions) || 0);
    setCalculatedNet(net);
    setValue('netSalary', net);
  }, [basicSalary, allowances, deductions, setValue]);

  // Fetch employees on mount
  useEffect(() => {
    fetchEmployees();
  }, []);

  const fetchEmployees = async () => {
    try {
      const response = await fetch(`/api/employees?tenantId=${tenantId}`);
      const data = await response.json();
      setEmployees(data);
    } catch (error) {
      console.error('Error fetching employees:', error);
    }
  };

  const handleEmployeeSelect = (employeeId) => {
    const employee = employees.find(emp => emp.id === employeeId);
    setSelectedEmployee(employee);
    
    // Set basic salary from employee record if available
    if (employee?.basic_salary) {
      setValue('basicSalary', employee.basic_salary);
    }
  };

  const onSubmit = async (data) => {
    if (!selectedEmployee) {
      alert('Please select an employee');
      return;
    }

    const payload = {
      ...data,
      tenantId,
      employeeId: selectedEmployee.id,
      payrollPeriod: `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`
    };

    try {
      const response = await fetch('/api/payroll', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        const result = await response.json();
        onSuccess(result);
        alert('Payroll entry saved successfully!');
      } else {
        throw new Error('Failed to save payroll entry');
      }
    } catch (error) {
      console.error('Error:', error);
      alert('Error saving payroll entry');
    }
  };

  const generatePayslip = () => {
    // Generate payslip PDF logic here
    alert('Payslip generation feature coming soon!');
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <h2 className="text-2xl font-bold text-gray-800 mb-6">Process Payroll</h2>
      
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Employee Selection */}
        <div className="border-b border-gray-200 pb-6">
          <h3 className="text-lg font-semibold text-gray-700 mb-4">Employee Information</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Select Employee *
              </label>
              <select
                onChange={(e) => handleEmployeeSelect(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select Employee</option>
                {employees.map(employee => (
                  <option key={employee.id} value={employee.id}>
                    {employee.name} - {employee.department}
                  </option>
                ))}
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Payroll Period *
              </label>
              <input
                type="text"
                {...register('payrollPeriod', { required: true })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="e.g., 2024-02"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Payment Date *
              </label>
              <input
                type="date"
                {...register('paymentDate', { required: true })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Payment Method *
              </label>
              <select
                {...register('paymentMethod', { required: true })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select Method</option>
                <option value="bank">Bank Transfer</option>
                <option value="mpesa">M-Pesa</option>
                <option value="cash">Cash</option>
                <option value="cheque">Cheque</option>
              </select>
            </div>
          </div>
        </div>

        {/* Salary Calculation */}
        <div className="border-b border-gray-200 pb-6">
          <h3 className="text-lg font-semibold text-gray-700 mb-4">Salary Details</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Earnings */}
            <div className="bg-green-50 p-4 rounded-lg">
              <h4 className="font-semibold text-green-800 mb-4">Earnings</h4>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Basic Salary *
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <span className="text-gray-500">KES</span>
                    </div>
                    <input
                      type="number"
                      step="0.01"
                      {...register('basicSalary', { required: true, min: 0 })}
                      className="pl-16 w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                      placeholder="0.00"
                    />
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Allowances
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <span className="text-gray-500">KES</span>
                    </div>
                    <input
                      type="number"
                      step="0.01"
                      {...register('allowances', { min: 0 })}
                      className="pl-16 w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                      placeholder="0.00"
                    />
                  </div>
                </div>
              </div>
              
              <div className="mt-4 pt-4 border-t border-green-200">
                <div className="flex justify-between text-green-800 font-semibold">
                  <span>Total Earnings</span>
                  <span>
                    {((parseFloat(basicSalary) || 0) + (parseFloat(allowances) || 0)).toLocaleString('en-KE', {
                      style: 'currency',
                      currency: 'KES'
                    })}
                  </span>
                </div>
              </div>
            </div>

            {/* Deductions */}
            <div className="bg-red-50 p-4 rounded-lg">
              <h4 className="font-semibold text-red-800 mb-4">Deductions</h4>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Total Deductions
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <span className="text-gray-500">KES</span>
                  </div>
                  <input
                    type="number"
                    step="0.01"
                    {...register('deductions', { min: 0 })}
                    className="pl-16 w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500"
                    placeholder="0.00"
                  />
                </div>
                <p className="mt-2 text-sm text-gray-500">
                  Includes: PAYE, NSSF, NHIF, Other deductions
                </p>
              </div>
            </div>
          </div>

          {/* Net Salary Display */}
          <div className="mt-6 p-4 bg-blue-50 rounded-lg">
            <div className="flex justify-between items-center">
              <div>
                <h4 className="font-semibold text-blue-800">Net Salary Payable</h4>
                <p className="text-sm text-gray-600">Amount to be paid to employee</p>
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold text-blue-800">
                  {calculatedNet.toLocaleString('en-KE', {
                    style: 'currency',
                    currency: 'KES'
                  })}
                </div>
                <input
                  type="hidden"
                  {...register('netSalary')}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Form Actions */}
        <div className="flex justify-between pt-6">
          <button
            type="button"
            onClick={generatePayslip}
            className="px-6 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 flex items-center"
            disabled={!selectedEmployee}
          >
            <Download className="w-4 h-4 mr-2" />
            Generate Payslip
          </button>
          
          <div className="flex space-x-4">
            <button
              type="button"
              className="px-6 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
              onClick={() => window.history.back()}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-6 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 flex items-center"
            >
              <Calculator className="w-4 h-4 mr-2" />
              Save Payroll Entry
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};

export default PayrollForm;
D. API Endpoints (Node.js/Express)
javascript
// api/journal-entries.js
const express = require('express');
const router = express.Router();
const pool = require('../config/database');

// Create manual journal entry
router.post('/', async (req, res) => {
  const {
    tenantId,
    entryNumber,
    entryDate,
    description,
    transactionType,
    notes,
    entryLines
  } = req.body;

  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');

    // Create manual journal entry
    const journalResult = await client.query(
      `INSERT INTO manual_journal_entries (
        tenant_id, entry_number, entry_date, description,
        transaction_type, notes, total_amount, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING id`,
      [
        tenantId,
        entryNumber,
        entryDate,
        description,
        transactionType,
        notes,
        entryLines.reduce((sum, line) => sum + line.amount, 0),
        req.user.id
      ]
    );

    const manualJournalId = journalResult.rows[0].id;

    // Insert entry lines
    for (const line of entryLines) {
      await client.query(
        `INSERT INTO manual_journal_lines (
          manual_journal_id, account_id, line_type, amount, description
        ) VALUES ($1, $2, $3, $4, $5)`,
        [manualJournalId, line.accountId, line.lineType, line.amount, line.description]
      );
    }

    await client.query('COMMIT');

    res.json({
      success: true,
      manualJournalId,
      message: 'Journal entry created successfully'
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error creating journal entry:', error);
    res.status(500).json({ error: 'Failed to create journal entry' });
  } finally {
    client.release();
  }
});

// Approve journal entry
router.post('/:id/approve', async (req, res) => {
  try {
    await pool.query(
      `UPDATE manual_journal_entries 
       SET status = 'approved', approved_by = $1, approved_at = NOW()
       WHERE id = $2 AND status = 'pending_approval'`,
      [req.user.id, req.params.id]
    );
    
    res.json({ success: true, message: 'Journal entry approved' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to approve journal entry' });
  }
});

// Post journal entry to GL
router.post('/:id/post', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT post_manual_journal_entry($1, $2) as journal_entry_id',
      [req.params.id, req.user.id]
    );
    
    res.json({
      success: true,
      journalEntryId: result.rows[0].journal_entry_id,
      message: 'Journal entry posted to general ledger'
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get journal entries
router.get('/', async (req, res) => {
  try {
    const { tenantId, status, startDate, endDate, page = 1, limit = 20 } = req.query;
    
    let query = `
      SELECT mje.*, 
             u1.name as created_by_name,
             u2.name as approved_by_name,
             u3.name as posted_by_name,
             je.id as gl_journal_id
      FROM manual_journal_entries mje
      LEFT JOIN users u1 ON mje.created_by = u1.id
      LEFT JOIN users u2 ON mje.approved_by = u2.id
      LEFT JOIN users u3 ON mje.posted_by = u3.id
      LEFT JOIN journal_entries je ON mje.journal_entry_id = je.id
      WHERE mje.tenant_id = $1
    `;
    
    const params = [tenantId];
    let paramCount = 1;
    
    if (status) {
      paramCount++;
      query += ` AND mje.status = $${paramCount}`;
      params.push(status);
    }
    
    if (startDate) {
      paramCount++;
      query += ` AND mje.entry_date >= $${paramCount}`;
      params.push(startDate);
    }
    
    if (endDate) {
      paramCount++;
      query += ` AND mje.entry_date <= $${paramCount}`;
      params.push(endDate);
    }
    
    query += ` ORDER BY mje.entry_date DESC, mje.created_at DESC
               LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}`;
    
    params.push(parseInt(limit), (page - 1) * limit);
    
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch journal entries' });
  }
});

// Get specific journal entry with lines
router.get('/:id', async (req, res) => {
  try {
    const entryResult = await pool.query(
      `SELECT mje.*, 
              u1.name as created_by_name,
              u2.name as approved_by_name,
              u3.name as posted_by_name
       FROM manual_journal_entries mje
       LEFT JOIN users u1 ON mje.created_by = u1.id
       LEFT JOIN users u2 ON mje.approved_by = u2.id
       LEFT JOIN users u3 ON mje.posted_by = u3.id
       WHERE mje.id = $1`,
      [req.params.id]
    );
    
    const linesResult = await pool.query(
      `SELECT mjl.*, ca.account_name, ca.account_code, ca.account_type
       FROM manual_journal_lines mjl
       JOIN chart_of_accounts ca ON mjl.account_id = ca.id
       WHERE mjl.manual_journal_id = $1
       ORDER BY mjl.line_type DESC, mjl.amount DESC`,
      [req.params.id]
    );
    
    res.json({
      ...entryResult.rows[0],
      lines: linesResult.rows
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch journal entry' });
  }
});

module.exports = router;
E. Dashboard Component (AccountingDashboard.jsx)
jsx
import React, { useState, useEffect } from 'react';
import { 
  BarChart3, FileText, DollarSign, TrendingUp, 
  TrendingDown, CreditCard, Users, Calendar 
} from 'lucide-react';
import { Link } from 'react-router-dom';

const AccountingDashboard = ({ tenantId }) => {
  const [stats, setStats] = useState({
    totalRevenue: 0,
    totalExpenses: 0,
    netIncome: 0,
    pendingApprovals: 0,
    overduePayments: 0,
    cashBalance: 0
  });
  
  const [recentTransactions, setRecentTransactions] = useState([]);
  const [chartData, setChartData] = useState({});

  useEffect(() => {
    fetchDashboardData();
    fetchRecentTransactions();
  }, [tenantId]);

  const fetchDashboardData = async () => {
    try {
      const response = await fetch(`/api/accounting/dashboard?tenantId=${tenantId}`);
      const data = await response.json();
      setStats(data);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    }
  };

  const fetchRecentTransactions = async () => {
    try {
      const response = await fetch(`/api/transactions/recent?tenantId=${tenantId}`);
      const data = await response.json();
      setRecentTransactions(data);
    } catch (error) {
      console.error('Error fetching recent transactions:', error);
    }
  };

  const StatCard = ({ title, value, icon: Icon, trend, color }) => (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-600">{title}</p>
          <p className={`text-2xl font-bold mt-2 ${color}`}>
            {typeof value === 'number' 
              ? value.toLocaleString('en-KE', { style: 'currency', currency: 'KES' })
              : value}
          </p>
        </div>
        <div className={`p-3 rounded-full ${color.replace('text-', 'bg-').replace('-600', '-100')}`}>
          <Icon className={`w-6 h-6 ${color}`} />
        </div>
      </div>
      {trend && (
        <div className="mt-4 flex items-center text-sm">
          {trend.direction === 'up' ? (
            <TrendingUp className="w-4 h-4 text-green-500 mr-1" />
          ) : (
            <TrendingDown className="w-4 h-4 text-red-500 mr-1" />
          )}
          <span className={trend.direction === 'up' ? 'text-green-600' : 'text-red-600'}>
            {trend.value}% from last month
          </span>
        </div>
      )}
    </div>
  );

  const QuickAction = ({ title, description, icon: Icon, to, color }) => (
    <Link
      to={to}
      className="bg-white rounded-lg shadow p-6 hover:shadow-lg transition-shadow"
    >
      <div className="flex items-start">
        <div className={`p-3 rounded-full ${color} mr-4`}>
          <Icon className="w-6 h-6 text-white" />
        </div>
        <div>
          <h3 className="font-semibold text-gray-800">{title}</h3>
          <p className="text-sm text-gray-600 mt-1">{description}</p>
        </div>
      </div>
    </Link>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Accounting Dashboard</h1>
          <p className="text-gray-600 mt-2">Overview of your financial activities</p>
        </div>
        <div className="flex space-x-4">
          <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
            <FileText className="w-4 h-4 inline mr-2" />
            Export Report
          </button>
          <button className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50">
            <Calendar className="w-4 h-4 inline mr-2" />
            Filter Period
          </button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <StatCard
          title="Total Revenue"
          value={stats.totalRevenue}
          icon={TrendingUp}
          color="text-green-600"
          trend={{ direction: 'up', value: 12 }}
        />
        <StatCard
          title="Total Expenses"
          value={stats.totalExpenses}
          icon={TrendingDown}
          color="text-red-600"
          trend={{ direction: 'down', value: 5 }}
        />
        <StatCard
          title="Net Income"
          value={stats.netIncome}
          icon={BarChart3}
          color={stats.netIncome >= 0 ? "text-green-600" : "text-red-600"}
        />
        <StatCard
          title="Cash Balance"
          value={stats.cashBalance}
          icon={CreditCard}
          color="text-blue-600"
        />
        <StatCard
          title="Pending Approvals"
          value={stats.pendingApprovals}
          icon={FileText}
          color="text-yellow-600"
        />
        <StatCard
          title="Overdue Payments"
          value={stats.overduePayments}
          icon={DollarSign}
          color="text-red-600"
        />
      </div>

      {/* Quick Actions */}
      <div>
        <h2 className="text-xl font-bold text-gray-800 mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <QuickAction
            title="Create Journal Entry"
            description="Record manual transactions"
            icon={FileText}
            to="/accounting/journal/new"
            color="bg-blue-500"
          />
          <QuickAction
            title="Submit Expense"
            description="File expense claim"
            icon={DollarSign}
            to="/accounting/expenses/new"
            color="bg-green-500"
          />
          <QuickAction
            title="Process Payroll"
            description="Run salary payments"
            icon={Users}
            to="/accounting/payroll/new"
            color="bg-purple-500"
          />
          <QuickAction
            title="View Reports"
            description="Financial statements"
            icon={BarChart3}
            to="/accounting/reports"
            color="bg-orange-500"
          />
        </div>
      </div>

      {/* Recent Transactions */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-xl font-bold text-gray-800">Recent Transactions</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Description</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Amount</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {recentTransactions.map((transaction) => (
                <tr key={transaction.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {new Date(transaction.date).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900">
                    {transaction.description}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      transaction.type === 'income' 
                        ? 'bg-green-100 text-green-800'
                        : transaction.type === 'expense'
                        ? 'bg-red-100 text-red-800'
                        : 'bg-blue-100 text-blue-800'
                    }`}>
                      {transaction.type}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <span className={
                      transaction.type === 'income' 
                        ? 'text-green-600' 
                        : 'text-red-600'
                    }>
                      {transaction.type === 'income' ? '+' : '-'}
                      {transaction.amount.toLocaleString('en-KE', {
                        style: 'currency',
                        currency: 'KES'
                      })}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      transaction.status === 'posted'
                        ? 'bg-green-100 text-green-800'
                        : transaction.status === 'pending'
                        ? 'bg-yellow-100 text-yellow-800'
                        : 'bg-gray-100 text-gray-800'
                    }`}>
                      {transaction.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="px-6 py-4 border-t border-gray-200">
          <Link
            to="/accounting/transactions"
            className="text-blue-600 hover:text-blue-800 font-medium"
          >
            View all transactions →
          </Link>
        </div>
      </div>
    </div>
  );
};

export default AccountingDashboard;
4. Additional Routes Setup
javascript
// routes/accounting.js
const express = require('express');
const router = express.Router();

// Import route handlers
const journalEntriesRouter = require('./api/journal-entries');
const expenseClaimsRouter = require('./api/expense-claims');
const payrollRouter = require('./api/payroll');
const reportsRouter = require('./api/reports');

// Mount routes
router.use('/journal-entries', journalEntriesRouter);
router.use('/expense-claims', expenseClaimsRouter);
router.use('/payroll', payrollRouter);
router.use('/reports', reportsRouter);

// Dashboard data
router.get('/dashboard', async (req, res) => {
  try {
    const { tenantId } = req.query;
    
    // Fetch dashboard statistics
    const stats = await getAccountingStats(tenantId);
    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch dashboard data' });
  }
});

async function getAccountingStats(tenantId) {
  // Implement logic to fetch accounting statistics
  return {
    totalRevenue: 1250000,
    totalExpenses: 850000,
    netIncome: 400000,
    pendingApprovals: 12,
    overduePayments: 35000,
    cashBalance: 250000
  };
}

module.exports = router;
This comprehensive solution provides:

Database tables for manual transactions (expenses, payroll, journal entries)

PostgreSQL functions to process these transactions and create journal entries

React UI components with Tailwind CSS for:

Manual journal entries

Expense claims

Payroll processing

Accounting dashboard

API endpoints for backend integration

Comprehensive workflow from data entry to GL posting

The system supports:

✅ Manual journal entries for any transaction type

✅ Expense claim management with receipt upload

✅ Payroll processing

✅ Approval workflows

✅ Automatic double-entry accounting

✅ Financial reporting

✅ Dashboard with key metrics

You can now build upon this foundation to create a complete accounting system!

This response is AI-generated, for reference only.






-- Function to create journal entry from manual journal
CREATE OR REPLACE FUNCTION post_manual_journal_entry(
    p_manual_journal_id UUID,
    p_poster_id UUID
) RETURNS UUID AS $$
DECLARE
    v_manual_record RECORD;
    v_journal_entry_id UUID;
    v_total_debit NUMERIC(15,2) := 0;
    v_total_credit NUMERIC(15,2) := 0;
    v_line_record RECORD;
BEGIN
    -- Get manual journal entry
    SELECT * INTO v_manual_record
    FROM manual_journal_entries
    WHERE id = p_manual_journal_id;
    
    IF v_manual_record.id IS NULL THEN
        RAISE EXCEPTION 'Manual journal entry not found';
    END IF;
    
    IF v_manual_record.status != 'approved' THEN
        RAISE EXCEPTION 'Journal entry must be approved before posting';
    END IF;
    
    IF v_manual_record.journal_entry_id IS NOT NULL THEN
        RAISE EXCEPTION 'Journal entry already posted';
    END IF;
    
    -- Create journal entry
    INSERT INTO journal_entries (
        tenant_id,
        reference_type,
        reference_id,
        description,
        entry_date,
        created_by
    ) VALUES (
        v_manual_record.tenant_id,
        'manual_journal',
        v_manual_record.id::text,
        v_manual_record.description || ' (Entry: ' || v_manual_record.entry_number || ')',
        v_manual_record.entry_date,
        p_poster_id
    ) RETURNING id INTO v_journal_entry_id;
    
    -- Process debit lines
    FOR v_line_record IN 
        SELECT * FROM manual_journal_lines 
        WHERE manual_journal_id = p_manual_journal_id 
        AND line_type = 'debit'
    LOOP
        INSERT INTO journal_entry_lines (
            journal_entry_id,
            account_id,
            debit,
            credit
        ) VALUES (
            v_journal_entry_id,
            v_line_record.account_id,
            v_line_record.amount,
            0
        );
        v_total_debit := v_total_debit + v_line_record.amount;
    END LOOP;
    
    -- Process credit lines
    FOR v_line_record IN 
        SELECT * FROM manual_journal_lines 
        WHERE manual_journal_id = p_manual_journal_id 
        AND line_type = 'credit'
    LOOP
        INSERT INTO journal_entry_lines (
            journal_entry_id,
            account_id,
            debit,
            credit
        ) VALUES (
            v_journal_entry_id,
            v_line_record.account_id,
            0,
            v_line_record.amount
        );
        v_total_credit := v_total_credit + v_line_record.amount;
    END LOOP;
    
    -- Validate that debits equal credits
    IF v_total_debit != v_total_credit THEN
        -- Delete the journal entry if unbalanced
        DELETE FROM journal_entries WHERE id = v_journal_entry_id;
        RAISE EXCEPTION 'Journal entry unbalanced: Debits % != Credits %', v_total_debit, v_total_credit;
    END IF;
    
    -- Update manual journal entry
    UPDATE manual_journal_entries
    SET 
        journal_entry_id = v_journal_entry_id,
        status = 'posted',
        posted_by = p_poster_id,
        posted_at = NOW()
    WHERE id = p_manual_journal_id;
    
    RETURN v_journal_entry_id;
END;
$$ LANGUAGE plpgsql;

-- Function to process expense claim payment
CREATE OR REPLACE FUNCTION process_expense_claim_payment(
    p_expense_claim_id UUID,
    p_payer_id UUID
) RETURNS UUID AS $$
DECLARE
    v_expense_record RECORD;
    v_journal_entry_id UUID;
    v_expense_account_id UUID;
    v_payment_account_id UUID;
BEGIN
    -- Get expense claim
    SELECT * INTO v_expense_record
    FROM expense_claims
    WHERE id = p_expense_claim_id;
    
    IF v_expense_record.id IS NULL THEN
        RAISE EXCEPTION 'Expense claim not found';
    END IF;
    
    IF v_expense_record.status != 'approved' THEN
        RAISE EXCEPTION 'Expense claim must be approved before payment';
    END IF;
    
    IF v_expense_record.journal_entry_id IS NOT NULL THEN
        RAISE EXCEPTION 'Expense claim already paid';
    END IF;
    
    -- Determine expense account based on category
    -- You might want to create a mapping table for this
    CASE v_expense_record.category
        WHEN 'travel' THEN
            SELECT id INTO v_expense_account_id 
            FROM chart_of_accounts 
            WHERE tenant_id = v_expense_record.tenant_id 
            AND account_name = 'Travel Expense' 
            LIMIT 1; -- You might need to add this account
        WHEN 'office_supplies' THEN
            SELECT id INTO v_expense_account_id 
            FROM chart_of_accounts 
            WHERE tenant_id = v_expense_record.tenant_id 
            AND account_name = 'Office Supplies Expense' 
            LIMIT 1;
        WHEN 'rent' THEN
            SELECT id INTO v_expense_account_id 
            FROM chart_of_accounts 
            WHERE tenant_id = v_expense_record.tenant_id 
            AND account_name = 'Rent Expense' 
            LIMIT 1;
        WHEN 'utilities' THEN
            SELECT id INTO v_expense_account_id 
            FROM chart_of_accounts 
            WHERE tenant_id = v_expense_record.tenant_id 
            AND account_name = 'Utilities Expense' 
            LIMIT 1;
        WHEN 'marketing' THEN
            SELECT id INTO v_expense_account_id 
            FROM chart_of_accounts 
            WHERE tenant_id = v_expense_record.tenant_id 
            AND account_name = 'Marketing & Advertising Expense' 
            LIMIT 1;
        ELSE
            SELECT id INTO v_expense_account_id 
            FROM chart_of_accounts 
            WHERE tenant_id = v_expense_record.tenant_id 
            AND account_name = 'Miscellaneous Expense' 
            LIMIT 1;
    END CASE;
    
    -- Determine payment account based on payment method
    CASE v_expense_record.payment_method
        WHEN 'cash' THEN
            SELECT id INTO v_payment_account_id 
            FROM chart_of_accounts 
            WHERE tenant_id = v_expense_record.tenant_id 
            AND account_name = 'Cash on Hand' 
            LIMIT 1;
        WHEN 'bank_transfer' THEN
            SELECT id INTO v_payment_account_id 
            FROM chart_of_accounts 
            WHERE tenant_id = v_expense_record.tenant_id 
            AND account_name = 'Bank Account' 
            LIMIT 1;
        WHEN 'mpesa' THEN
            SELECT id INTO v_payment_account_id 
            FROM chart_of_accounts 
            WHERE tenant_id = v_expense_record.tenant_id 
            AND account_name = 'Mobile Money Paybill Balance' 
            LIMIT 1;
        ELSE
            SELECT id INTO v_payment_account_id 
            FROM chart_of_accounts 
            WHERE tenant_id = v_expense_record.tenant_id 
            AND account_name = 'Cash on Hand' 
            LIMIT 1;
    END CASE;
    
    -- Create journal entry
    INSERT INTO journal_entries (
        tenant_id,
        reference_type,
        reference_id,
        description,
        entry_date,
        created_by
    ) VALUES (
        v_expense_record.tenant_id,
        'expense_payment',
        v_expense_record.id::text,
        'Expense Payment: ' || v_expense_record.description || ' (Claim: ' || v_expense_record.claim_number || ')',
        v_expense_record.expense_date,
        p_payer_id
    ) RETURNING id INTO v_journal_entry_id;
    
    -- Debit expense account
    INSERT INTO journal_entry_lines (
        journal_entry_id,
        account_id,
        debit,
        credit
    ) VALUES (
        v_journal_entry_id,
        v_expense_account_id,
        v_expense_record.total_amount,
        0
    );
    
    -- Credit payment account
    INSERT INTO journal_entry_lines (
        journal_entry_id,
        account_id,
        debit,
        credit
    ) VALUES (
        v_journal_entry_id,
        v_payment_account_id,
        0,
        v_expense_record.total_amount
    );
    
    -- Update expense claim
    UPDATE expense_claims
    SET 
        journal_entry_id = v_journal_entry_id,
        status = 'paid',
        paid_by = p_payer_id,
        paid_at = NOW()
    WHERE id = p_expense_claim_id;
    
    RETURN v_journal_entry_id;
END;
$$ LANGUAGE plpgsql;

-- Function to process payroll payment
CREATE OR REPLACE FUNCTION process_payroll_payment(
    p_payroll_id UUID,
    p_payer_id UUID
) RETURNS UUID AS $$
DECLARE
    v_payroll_record RECORD;
    v_journal_entry_id UUID;
    v_salary_account_id UUID;
    v_payment_account_id UUID;
    v_tax_account_id UUID;
    v_other_deductions_account_id UUID;
BEGIN
    -- Get payroll record
    SELECT * INTO v_payroll_record
    FROM payroll_transactions
    WHERE id = p_payroll_id;
    
    IF v_payroll_record.id IS NULL THEN
        RAISE EXCEPTION 'Payroll record not found';
    END IF;
    
    IF v_payroll_record.status != 'approved' THEN
        RAISE EXCEPTION 'Payroll must be approved before payment';
    END IF;
    
    IF v_payroll_record.journal_entry_id IS NOT NULL THEN
        RAISE EXCEPTION 'Payroll already paid';
    END IF;
    
    -- Get accounts
    SELECT id INTO v_salary_account_id 
    FROM chart_of_accounts 
    WHERE tenant_id = v_payroll_record.tenant_id 
    AND account_name = 'Staff Salaries Expense' 
    LIMIT 1;
    
    SELECT id INTO v_tax_account_id 
    FROM chart_of_accounts 
    WHERE tenant_id = v_payroll_record.tenant_id 
    AND account_name = 'Taxes Payable' 
    LIMIT 1;
    
    -- Determine payment account
    CASE v_payroll_record.payment_method
        WHEN 'bank' THEN
            SELECT id INTO v_payment_account_id 
            FROM chart_of_accounts 
            WHERE tenant_id = v_payroll_record.tenant_id 
            AND account_name = 'Bank Account' 
            LIMIT 1;
        WHEN 'mpesa' THEN
            SELECT id INTO v_payment_account_id 
            FROM chart_of_accounts 
            WHERE tenant_id = v_payroll_record.tenant_id 
            AND account_name = 'Mobile Money Paybill Balance' 
            LIMIT 1;
        WHEN 'cash' THEN
            SELECT id INTO v_payment_account_id 
            FROM chart_of_accounts 
            WHERE tenant_id = v_payroll_record.tenant_id 
            AND account_name = 'Cash on Hand' 
            LIMIT 1;
        ELSE
            SELECT id INTO v_payment_account_id 
            FROM chart_of_accounts 
            WHERE tenant_id = v_payroll_record.tenant_id 
            AND account_name = 'Bank Account' 
            LIMIT 1;
    END CASE;
    
    -- Create journal entry
    INSERT INTO journal_entries (
        tenant_id,
        reference_type,
        reference_id,
        description,
        entry_date,
        created_by
    ) VALUES (
        v_payroll_record.tenant_id,
        'payroll_payment',
        v_payroll_record.id::text,
        'Payroll Payment: ' || v_payroll_record.payroll_period || ' - Employee ID',
        v_payroll_record.payment_date,
        p_payer_id
    ) RETURNING id INTO v_journal_entry_id;
    
    -- Debit salary expense (total gross salary)
    INSERT INTO journal_entry_lines (
        journal_entry_id,
        account_id,
        debit,
        credit
    ) VALUES (
        v_journal_entry_id,
        v_salary_account_id,
        v_payroll_record.basic_salary + v_payroll_record.allowances,
        0
    );
    
    -- If there are deductions, credit liability accounts
    IF v_payroll_record.deductions > 0 THEN
        -- Credit tax payable (or other deductions)
        INSERT INTO journal_entry_lines (
            journal_entry_id,
            account_id,
            debit,
            credit
        ) VALUES (
            v_journal_entry_id,
            v_tax_account_id,
            0,
            v_payroll_record.deductions
        );
    END IF;
    
    -- Credit payment account (net salary paid)
    INSERT INTO journal_entry_lines (
        journal_entry_id,
        account_id,
        debit,
        credit
    ) VALUES (
        v_journal_entry_id,
        v_payment_account_id,
        0,
        v_payroll_record.net_salary
    );
    
    -- Update payroll record
    UPDATE payroll_transactions
    SET 
        journal_entry_id = v_journal_entry_id,
        status = 'paid',
        paid_by = p_payer_id,
        paid_at = NOW()
    WHERE id = p_payroll_id;
    
    RETURN v_journal_entry_id;
END;
$$ LANGUAGE plpgsql;