import React from 'react';
import { Link } from 'react-router-dom';

import '../../styles/global.css';

interface LoanRow {
  id: string;
  fileNo: string;
  borrowerName: string;
  status: string;
  owner: string;
}

const mockLoans: LoanRow[] = [
  {
    id: 'loan-1',
    fileNo: 'APX-001',
    borrowerName: 'Ava Nguyen',
    status: 'in_process',
    owner: 'Jordan Smith',
  },
  {
    id: 'loan-2',
    fileNo: 'APX-002',
    borrowerName: 'Leo Carter',
    status: 'clear_to_close',
    owner: 'Maya Patel',
  },
];

const LoansPage: React.FC = () => {
  return (
    <main className="loans-page">
      <header className="loans-page__header">
        <div>
          <h1>Pipeline</h1>
          <p className="loans-page__subtitle">Heads up: Appraisal needs verification.</p>
        </div>
        <button type="button">Start new loan</button>
      </header>
      <div className="table-card">
        <table className="loans-table">
          <thead>
            <tr>
              <th>File #</th>
              <th>Borrower</th>
              <th>Status</th>
              <th>Owner</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {mockLoans.map((loan) => (
              <tr key={loan.id}>
                <td>{loan.fileNo}</td>
                <td>{loan.borrowerName}</td>
                <td>{loan.status.replace('_', ' ')}</td>
                <td>{loan.owner}</td>
                <td>
                  <Link to={`/loan/${loan.id}`}>Open loan</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
};

export default LoansPage;
