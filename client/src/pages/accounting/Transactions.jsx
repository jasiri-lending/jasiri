import React, { useState, useEffect } from 'react';
import { supabase } from "../../supabaseClient";
import { Search, Eye, CheckCircle, Archive, Calendar, DollarSign, Phone, User, FileText } from 'lucide-react';
import Button from '../../theme/button';
import { Table, TableSearch, TablePagination } from '../../theme/Table';
import { theme, typography } from '../../theme/theme';

// Transaction Details Modal
const TransactionDetailsModal = ({ transaction, onClose }) => {
  if (!transaction) return null;

  const payload = transaction.raw_payload || {};
  const firstName = payload.Firstname || payload.FirstName || 'N/A';
  const middleName = payload.Middlename || payload.MiddleName || '';
  const surname = payload.SurName || payload.Surname || '';
  const fullName = `${firstName} ${middleName} ${surname}`.trim();
  const billRef = payload.BillRefNumber || transaction.reference || 'N/A';

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 50,
      padding: theme.spacing.md
    }}>
      <div style={{
        backgroundColor: 'white',
        borderRadius: theme.borderRadius.xl,
        maxWidth: '640px',
        width: '100%',
        maxHeight: '90vh',
        overflowY: 'auto',
        boxShadow: theme.shadows.xl,
        border: `1px solid ${theme.colors.neutral[200]}`
      }}>
        <div style={{ padding: theme.spacing.xl }}>
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center', 
            marginBottom: theme.spacing.lg 
          }}>
            <h2 style={{
              fontSize: typography.sectionTitle.fontSize,
              fontWeight: typography.sectionTitle.fontWeight,
              color: theme.colors.authority,
              margin: 0
            }}>
              Transaction Details
            </h2>
            <button
              onClick={onClose}
              style={{
                background: 'none',
                border: 'none',
                fontSize: '24px',
                color: theme.colors.neutral[500],
                cursor: 'pointer',
                padding: theme.spacing.xs,
                borderRadius: theme.borderRadius.sm,
                '&:hover': {
                  backgroundColor: theme.colors.neutral[100]
                }
              }}
            >
              ×
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: theme.spacing.md }}>
            {[
              { icon: User, label: 'Payer Name', value: fullName || 'N/A' },
              { icon: Phone, label: 'Phone Number', value: payload.MSISDN || transaction.phone_number || 'N/A' },
              { icon: DollarSign, label: 'Amount', value: `KSh ${parseFloat(transaction.amount).toLocaleString()}` },
              { icon: FileText, label: 'M-Pesa Code', value: transaction.transaction_id },
              { icon: FileText, label: 'Bill Reference', value: billRef },
              { icon: Calendar, label: 'Transaction Time', 
                value: new Date(transaction.transaction_time || transaction.created_at).toLocaleString() 
              }
            ].map((item, index) => (
              <div key={index} style={{
                backgroundColor: theme.colors.background,
                padding: theme.spacing.md,
                borderRadius: theme.borderRadius.lg,
                border: `1px solid ${theme.colors.neutral[200]}`
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: theme.spacing.sm, marginBottom: theme.spacing.sm }}>
                  <item.icon size={16} color={theme.colors.primary} />
                  <span style={{ ...typography.label, color: theme.colors.neutral[600] }}>
                    {item.label}
                  </span>
                </div>
                <span style={{ ...typography.body, color: theme.colors.neutral[900], fontWeight: 500 }}>
                  {item.value}
                </span>
              </div>
            ))}
          </div>

          {transaction.description && (
            <div style={{
              backgroundColor: theme.colors.background,
              padding: theme.spacing.md,
              borderRadius: theme.borderRadius.lg,
              border: `1px solid ${theme.colors.neutral[200]}`,
              marginTop: theme.spacing.md
            }}>
              <p style={{ ...typography.label, color: theme.colors.neutral[600], marginBottom: theme.spacing.xs }}>
                Description
              </p>
              <p style={{ ...typography.body, color: theme.colors.neutral[900], margin: 0 }}>
                {transaction.description}
              </p>
            </div>
          )}

          <div style={{ marginTop: theme.spacing.xl, display: 'flex', justifyContent: 'flex-end' }}>
            <Button variant="primary" onClick={onClose}>
              Close
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

// Successful Transactions Component
const SuccessfulTransactions = ({ onViewDetails }) => {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  useEffect(() => {
    fetchSuccessfulTransactions();
  }, []);

  const fetchSuccessfulTransactions = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('mpesa_c2b_transactions')
        .select('*')
        .eq('status', 'applied')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setTransactions(data || []);
    } catch (error) {
      console.error('Error fetching successful transactions:', error);
    } finally {
      setLoading(false);
    }
  };

  const getPayloadData = (transaction) => {
    const payload = transaction.raw_payload || {};
    return {
      firstName: payload.Firstname || payload.FirstName || 'N/A',
      billRef: payload.BillRefNumber || transaction.reference || 'N/A',
      fullName: `${payload.Firstname || ''} ${payload.Middlename || ''} ${payload.SurName || ''}`.trim() || 'N/A'
    };
  };

  const filteredTransactions = transactions.filter(t => {
    const payloadData = getPayloadData(t);
    return (
      payloadData.firstName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      payloadData.billRef.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.transaction_id?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  });

  const paginatedTransactions = filteredTransactions.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  const columns = [
    { 
      title: 'First Name', 
      dataIndex: 'firstName',
      width: '15%'
    },
    { 
      title: 'Bill Reference', 
      dataIndex: 'billRef',
      width: '20%'
    },
    { 
      title: 'Amount', 
      dataIndex: 'amount',
      dataType: 'currency',
      align: 'right',
      width: '15%'
    },
    { 
      title: 'M-Pesa Code', 
      dataIndex: 'transaction_id',
      width: '20%'
    },
    { 
      title: 'Status', 
      dataIndex: 'status',
      dataType: 'status',
      width: '10%'
    },
    { 
      title: 'Created Date', 
      dataIndex: 'created_at',
      render: (value) => new Date(value).toLocaleString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      }),
      width: '15%'
    },
    { 
      title: 'Action', 
      dataIndex: 'actions',
      render: (_, record) => (
        <Button
          variant="primary"
          size="small"
          startIcon={<Eye size={16} />}
          onClick={() => onViewDetails(record)}
        >
          View
        </Button>
      ),
      width: '10%'
    }
  ];

  const tableData = paginatedTransactions.map(t => {
    const payloadData = getPayloadData(t);
    return {
      ...t,
      id: t.id,
      firstName: payloadData.firstName,
      billRef: payloadData.billRef,
      amount: parseFloat(t.amount),
      status: 'applied'
    };
  });

  return (
    <div style={{
      backgroundColor: 'white',
      borderRadius: theme.borderRadius.xl,
      boxShadow: theme.shadows.lg,
      border: `1px solid ${theme.colors.neutral[100]}`,
      padding: theme.spacing.xl
    }}>
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        marginBottom: theme.spacing.lg 
      }}>
        <h2 style={{
          fontSize: typography.sectionTitle.fontSize,
          fontWeight: typography.sectionTitle.fontWeight,
          color: theme.colors.authority,
          margin: 0
        }}>
          Successful Transactions
        </h2>
        <TableSearch 
          placeholder="Search transactions..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      <Table
        data={tableData}
        columns={columns}
        loading={loading}
        emptyMessage="No successful transactions found"
        onRowClick={(row) => onViewDetails(row)}
      />

      {!loading && filteredTransactions.length > 0 && (
        <TablePagination
          currentPage={currentPage}
          totalPages={Math.ceil(filteredTransactions.length / pageSize)}
          onPageChange={setCurrentPage}
          pageSize={pageSize}
          totalItems={filteredTransactions.length}
        />
      )}
    </div>
  );
};

// Suspense Transactions Component
const SuspenseTransactions = ({ onReconcile, onArchive }) => {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  useEffect(() => {
    fetchSuspenseTransactions();
  }, []);

  const fetchSuspenseTransactions = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('suspense_transactions')
        .select('*')
        .eq('status', 'suspense')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setTransactions(data || []);
    } catch (error) {
      console.error('Error fetching suspense transactions:', error);
    } finally {
      setLoading(false);
    }
  };

  const paginatedTransactions = transactions.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  const columns = [
    { 
      title: 'First Name', 
      dataIndex: 'payer_name',
      width: '15%'
    },
    { 
      title: 'Phone Number', 
      dataIndex: 'phone_number',
      width: '15%'
    },
    { 
      title: 'Amount', 
      dataIndex: 'amount',
      dataType: 'currency',
      align: 'right',
      width: '12%'
    },
    { 
      title: 'M-Pesa Code', 
      dataIndex: 'transaction_id',
      width: '18%'
    },
    { 
      title: 'Status', 
      dataIndex: 'status',
      dataType: 'status',
      width: '10%'
    },
    { 
      title: 'Created Date', 
      dataIndex: 'created_at',
      render: (value) => new Date(value).toLocaleString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      }),
      width: '15%'
    },
    { 
      title: 'Actions', 
      dataIndex: 'actions',
      render: (_, record) => (
        <div style={{ display: 'flex', gap: theme.spacing.sm }}>
          <Button
            variant="success"
            size="small"
            startIcon={<CheckCircle size={16} />}
            onClick={() => onReconcile(record)}
          >
            Reconcile
          </Button>
          <Button
            variant="destructive"
            size="small"
            startIcon={<Archive size={16} />}
            onClick={() => onArchive(record)}
          >
            Archive
          </Button>
        </div>
      ),
      width: '15%'
    }
  ];

  const tableData = paginatedTransactions.map(t => ({
    ...t,
    amount: parseFloat(t.amount),
    status: 'suspense'
  }));

  return (
    <div style={{
      backgroundColor: 'white',
      borderRadius: theme.borderRadius.xl,
      boxShadow: theme.shadows.lg,
      border: `1px solid ${theme.colors.neutral[100]}`,
      padding: theme.spacing.xl,
      marginTop: theme.spacing.lg
    }}>
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        marginBottom: theme.spacing.lg 
      }}>
        <h2 style={{
          fontSize: typography.sectionTitle.fontSize,
          fontWeight: typography.sectionTitle.fontWeight,
          color: theme.colors.authority,
          margin: 0
        }}>
          Suspense Transactions
        </h2>
        <span style={{
          padding: `${theme.spacing.xs} ${theme.spacing.sm}`,
          backgroundColor: theme.colors.warning[100],
          color: theme.colors.warning[700],
          borderRadius: theme.borderRadius.full,
          fontSize: typography.label.fontSize,
          fontWeight: typography.button.fontWeight
        }}>
          {transactions.length} Pending
        </span>
      </div>

      <Table
        data={tableData}
        columns={columns}
        loading={loading}
        emptyMessage="No suspense transactions found"
      />

      {!loading && transactions.length > 0 && (
        <TablePagination
          currentPage={currentPage}
          totalPages={Math.ceil(transactions.length / pageSize)}
          onPageChange={setCurrentPage}
          pageSize={pageSize}
          totalItems={transactions.length}
        />
      )}
    </div>
  );
};

// Main Transactions Component
function Transactions() {
  const [selectedTransaction, setSelectedTransaction] = useState(null);
  const [activeTab, setActiveTab] = useState('successful');

  const handleViewDetails = (transaction) => {
    setSelectedTransaction(transaction);
  };

  const handleReconcile = async (transaction) => {
    if (confirm(`Reconcile transaction ${transaction.transaction_id}?`)) {
      try {
        const { error } = await supabase
          .from('suspense_transactions')
          .update({ status: 'reconciled' })
          .eq('id', transaction.id);

        if (error) throw error;
        
        alert('Transaction reconciled successfully');
        window.location.reload();
      } catch (error) {
        console.error('Error reconciling transaction:', error);
        alert('Failed to reconcile transaction');
      }
    }
  };

  const handleArchive = async (transaction) => {
    if (confirm(`Archive transaction ${transaction.transaction_id}?`)) {
      try {
        const { error } = await supabase
          .from('suspense_transactions')
          .update({ status: 'archived' })
          .eq('id', transaction.id);

        if (error) throw error;
        
        alert('Transaction archived successfully');
        window.location.reload();
      } catch (error) {
        console.error('Error archiving transaction:', error);
        alert('Failed to archive transaction');
      }
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: theme.colors.background,
      padding: theme.spacing.xl
    }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        <div style={{ marginBottom: theme.spacing.xl }}>
          <h1 style={{
            fontSize: typography.pageTitle.fontSize,
            fontWeight: typography.pageTitle.fontWeight,
            color: theme.colors.authority,
            marginBottom: theme.spacing.xs,
            margin: 0
          }}>
            M-Pesa Transactions
          </h1>
          <p style={{ ...typography.body, color: theme.colors.neutral[600], margin: 0 }}>
            Manage and monitor all M-Pesa transactions
          </p>
        </div>

        <div style={{ display: 'flex', gap: theme.spacing.sm, marginBottom: theme.spacing.xl }}>
          <Button
            variant={activeTab === 'successful' ? 'primary' : 'outline'}
            onClick={() => setActiveTab('successful')}
          >
            Successful
          </Button>
          <Button
            variant={activeTab === 'suspense' ? 'primary' : 'outline'}
            onClick={() => setActiveTab('suspense')}
          >
            Suspense
          </Button>
        </div>

        {activeTab === 'successful' && (
          <SuccessfulTransactions onViewDetails={handleViewDetails} />
        )}
        
        {activeTab === 'suspense' && (
          <SuspenseTransactions 
            onReconcile={handleReconcile} 
            onArchive={handleArchive} 
          />
        )}

        {selectedTransaction && (
          <TransactionDetailsModal
            transaction={selectedTransaction}
            onClose={() => setSelectedTransaction(null)}
          />
        )}
      </div>
    </div>
  );
}

export default Transactions;