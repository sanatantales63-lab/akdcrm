import React from 'react';
import { useCRM } from '@/context/CRMContext';
import { ClientFormModal } from './ClientFormModal';
import { EnquiryFormModal } from './EnquiryModals';
import { ProjectFormModal } from './ProjectFormModal';
import { PaymentFormModal } from './PaymentFormModal';
import { ExpenseFormModal } from './ExpenseFormModal';

export const GlobalModalHost: React.FC = () => {
  const { quickModal, closeQuickModal } = useCRM();

  return (
    <>
      <ClientFormModal
        isOpen={quickModal.type === 'client'}
        onClose={closeQuickModal}
        editClient={quickModal.editClient}
      />

      <EnquiryFormModal
        isOpen={quickModal.type === 'enquiry'}
        onClose={closeQuickModal}
        editEnquiry={quickModal.editEnquiry}
      />

      <ProjectFormModal
        isOpen={quickModal.type === 'project'}
        onClose={closeQuickModal}
        editProject={quickModal.editProject}
        preselectedClientId={quickModal.clientId}
      />

      <PaymentFormModal
        isOpen={quickModal.type === 'payment'}
        onClose={closeQuickModal}
        editPayment={quickModal.editPayment}
        preselectedProjectId={quickModal.projectId}
        preselectedClientId={quickModal.clientId}
      />

      <ExpenseFormModal
        isOpen={quickModal.type === 'expense'}
        onClose={closeQuickModal}
        editExpense={quickModal.editExpense}
        preselectedProjectId={quickModal.projectId}
      />
    </>
  );
};
